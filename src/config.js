const Configstore = require('configstore')
const pkg = require('../package.json')
const configStore = new Configstore(pkg.name)
module.exports = configStore
