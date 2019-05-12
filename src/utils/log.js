/* eslint-disable no-console */

const chalk = require('chalk')

const info = message => console.log(chalk.bgCyan(message))
const error = message => console.error(chalk.bgRed(message))

module.exports = {
  info,
  error
}
