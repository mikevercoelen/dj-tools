const path = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')
const slsk = require('./utils/slsk')
const inquirer = require('inquirer')
const config = require('./config')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const prettyBytes = require('pretty-bytes')
const ora = require('ora')
const moment = require('moment')
const cd = require('./utils/cd')
const pLimit = require('p-limit')
const log = require('./utils/log')
const pkg = require('../package.json')

const PKG_NAME = pkg.name

const getTrackNameFromRes = res => {
  const { file } = res
  const match = file.match(/[^\\]+$/)
  return match[0] ? match[0] : file
}

const getTrackResQuestion = (searchQuery, searchRes) => {
  const files = searchRes
    .filter(it => path.extname(it.file) === '.mp3')
    .filter(it => it.bitrate === 320)
    .sort((a, b) => (a.size / a.speed) - (b.size / b.speed))
    .filter(it => it.slots)

  const choices = files
    .reduce((output, res) => {
      const name = getTrackNameFromRes(res)

      output.push({
        name: `${name} (${prettyBytes(res.size)}) - ${res.file} - ${res.bitrate}kbps - ${res.speed}`,
        value: res
      })

      return output
    }, [])

  return {
    type: 'list',
    name: searchQuery,
    message: `Select a download for your track:`,
    choices
  }
}

const getShouldBurn = async () => {
  const { shouldBurn } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldBurn',
    message: 'Do you wish to burn a disk?',
    default: true
  }])

  return shouldBurn
}

const getShouldKeepFolder = async () => {
  const { shouldKeepFolder } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldKeepFolder',
    message: 'Do you want to keep the folder',
    default: true
  }])

  return shouldKeepFolder
}

const getDownloadFolder = async () => {
  const name = moment.utc().format('YYYY-MM-DD-X')
  const downloadFolder = path.resolve(process.cwd(), `${PKG_NAME}-downloads/${name}`)
  await fsExtra.ensureDir(downloadFolder)
  return downloadFolder
}

const getTrackFile = async (searchQuery, searchDuration) => {
  const searchRes = await slsk.search({
    req: searchQuery,
    timeout: searchDuration
  })

  const questions = getTrackResQuestion(searchQuery, searchRes)
  const answers = await inquirer.prompt(questions)
  return answers[searchQuery]
}

const getTrackList = async (searchDuration, currentTrackList = []) => {
  const { searchQuery } = await inquirer.prompt([{
    type: 'input',
    name: 'searchQuery',
    message: 'Search for a track:',
    default: 'gesaffelstein atmosphere'
  }])

  const selectedFile = await getTrackFile(searchDuration, searchQuery)
  currentTrackList.push(selectedFile)

  const { shouldContinue } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldContinue',
    message: 'Do you want to add more tracks?',
    default: true
  }])

  if (shouldContinue) {
    return getTrackList(searchDuration, currentTrackList)
  }

  return currentTrackList
}

const downloadTrack = async (downloadFolder, track) => {
  const name = getTrackNameFromRes(track)
  const downloadPath = path.resolve(downloadFolder, name)

  const spinner = ora(`Downloading file at: ${downloadPath}`).start()

  const downloadRes = await slsk.download({
    file: track,
    path: downloadPath
  })

  await writeFile(downloadPath, downloadRes.buffer)
  spinner.stop()
}

const downloadTracks = async ({
  downloadFolder,
  trackList,
  concurrency
}) => {
  const limit = pLimit(concurrency)

  return Promise.all(trackList.map((track) => {
    return limit(async () => {
      await downloadTrack(downloadFolder, track)
    })
  })).catch(error => {
    console.error(error)
  })
}

const download = async () => {
  const SLSK_USERNAME = config.get('SLSK_USERNAME')
  const SLSK_PASSWORD = config.get('SLSK_PASSWORD')
  const DOWNLOAD_CONCURRENCY = config.get('DOWNLOAD_CONCURRENCY') || 6
  const SEARCH_DURATION = config.get('SEARCH_DURATION') || 2000

  if (!SLSK_PASSWORD || !SLSK_USERNAME) {
    return log.error(`No Soulseek credentials were configured. Please run '${PKG_NAME} configure'.`)
  }

  const downloadFolder = await getDownloadFolder()

  await slsk.connect({
    username: SLSK_USERNAME,
    password: SLSK_PASSWORD,
    sharedFolders: [
      path.resolve(downloadFolder)
    ]
  })

  const trackList = await getTrackList(SEARCH_DURATION)

  await downloadTracks({
    downloadFolder,
    trackList,
    concurrency: DOWNLOAD_CONCURRENCY
  })

  const shouldBurn = await getShouldBurn()
  const shouldKeepFolder = await getShouldKeepFolder()

  if (!shouldKeepFolder) {
    await fsExtra.remove(downloadFolder)
  }

  if (shouldBurn) {
    await cd.burnFolder({
      folderName: downloadFolder
    })
  }

  return true
}

module.exports = download
