'use strict'

const request = require('request-promise')
const logger = require('winston')
const db = require('../database')
const config = require('../../config/server')
const RuleParser = require('./ruleParser')

class RulesEngine {
  constructor () {
    this.ruleParsers = new Map()
    this.init()
  }

  init () {
    this.getToken()
      .then((token) => {
        Promise.all([
          this.getRules(),
          this.getDevices({ token })
        ])
          .then((response) => {
            this.rules = response[0]
            this.devices = response[1]

            this.devices.forEach((device) => {
              const ruleParser = new RuleParser(device, this.rules)
              this.ruleParsers.set(device.id, ruleParser)
            })
          })
      })
      .catch((error) => {
        logger.error(error)
      })
  }

  getRules () {
    return db.selectRules().then((rules) => rules.map((rule) => rule.ruleConfig))
  }

  updateRules () {
    this.getRules()
      .then((rules) => {
        this.ruleParsers.forEach((ruleParser) => ruleParser.updateRules(rules))
      })
  }

  getDevices (options) {
    return request({
      url: `https://${config.account.blueprintHost}/api/v1/devices`,
      method: 'GET',
      qs: {
        accountId: config.account.accountId,
        pageSize: 100 // FIXME: this sux
      },
      headers: {
        authorization: `Bearer ${options.token}`
      },
      json: true
    })
      .then((response) => response.devices.results)
      .catch((error) => {
        logger.error(error)
      })
  }

  getToken () {
    return request({
      method: 'POST',
      url: `https://${config.account.idmHost}/api/v1/auth/login-user`,
      json: {
        emailAddress: config.account.emailAddress,
        password: config.account.password,
        accountId: config.account.accountId
      }
    })
      .then((response) => response.jwt)
      .catch((error) => {
        logger.error(error)
      })
  }
}

module.exports = new RulesEngine()