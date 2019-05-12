const { spawn } = require('child_process')

const burnFolder = ({ folderName }) => new Promise(resolve => {
  const spawnedBurn = spawn('drutil', [
    'burn',
    '-noverify',
    '-eject',
    '-speed',
    '52',
    folderName
  ], {
    stdio: 'inherit'
  })

  spawnedBurn.on('exit', () => {
    resolve()
  })
})

module.exports = {
  burnFolder
}
