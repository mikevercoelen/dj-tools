/* eslint-disable no-console */

const chalk = require('chalk')

const info = message => console.log(chalk.bgCyan(message))
const error = message => console.error(chalk.bgRed(message))
const warn = message => console.error(chalk.bgYellow(message))

module.exports = {
  info,
  error,
  warn
}
