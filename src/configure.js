const config = require('./config')
const inquirer = require('inquirer')
const slsk = require('./utils/slsk')
const log = require('./utils/log')

const configure = async () => {
  const newConfig = await inquirer.prompt([{
    type: 'input',
    name: 'SLSK_USERNAME',
    message: 'What is your Soulseek username?'
  }, {
    type: 'password',
    name: 'SLSK_PASSWORD',
    message: 'What is your Soulseek password?'
  }, {
    type: 'input',
    name: 'DOWNLOAD_CONCURRENCY',
    message: 'How many simultaneous downloads do you prefer?',
    default: 6
  }, {
    type: 'input',
    name: 'SEARCH_DURATION',
    message: 'How long do you want dj-tools to search? (in miliseconds)',
    default: 2000
  }])

  try {
    await slsk.connect({
      username: newConfig.SLSK_USERNAME,
      password: newConfig.SLSK_PASSWORD
    })

    config.set(newConfig)

    log.info(`Succesfully connected to Soulseek. You can now start using DJ tools.`)
    return true
  } catch (error) {
    log.error(`Your Soulseek credentials were incorrect. Please try again`)
    return configure()
  }
}

module.exports = configure
