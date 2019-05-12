#!/usr/bin/env node

const program = require('commander')
const path = require('path')
const djTools = require('../src')
const pkg = require('../package.json')

// login

progra
  .version(pkg.version)
  .command('login')

program
  .version(pkg.version)
  .parse(process.argv)


console.log(program)
