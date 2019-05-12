#!/usr/bin/env node

const program = require('commander')
const djTools = require('../src')
const pkg = require('../package.json')
const config = require('../src/config')

program
  .version(pkg.version)

program
  .command('configure')
  .description('Configures Soulseek, and DJ tools settings')
  .action(async () => {
    await djTools.configure()
    process.exit()
  })

program
  .command('download')
  .description('Downloads tracks')
  .action(async () => {
    await djTools.download({
      username: config.get('SLSK_USERNAME'),
      password: config.get('SLSK_PASSWORD'),
      downloadConcurrency: config.get('DOWNLOAD_CONCURRENCY'),
      searchDuration: config.get('SEARCH_DURATION')
    })

    process.exit()
  })

program.parse(process.argv)
