const path = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')
const slsk = require('./utils/slsk')
const inquirer = require('inquirer')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const prettyBytes = require('pretty-bytes')
const ora = require('ora')
const moment = require('moment')
const cd = require('./utils/cd')
const pLimit = require('p-limit')
const log = require('./utils/log')
const pkg = require('../package.json')
const open = require('open')

const PKG_NAME = pkg.name

const download = async ({
  username,
  password,
  downloadConcurrency = 6,
  searchDuration = 2000
}) => {
  let _downloadFolder = null

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
    if (_downloadFolder) {
      return _downloadFolder
    }

    const name = moment.utc().format('YYYY-MM-DD-X')
    const downloadFolder = path.resolve(process.cwd(), `${PKG_NAME}-downloads/${name}`)
    await fsExtra.ensureDir(downloadFolder)
    _downloadFolder = downloadFolder
    return downloadFolder
  }

  const getTrackFile = async (searchDuration, searchQuery) => {
    const searchRes = await slsk.search({
      req: searchQuery,
      timeout: searchDuration
    })

    const questions = getTrackResQuestion(searchQuery, searchRes)
    const answers = await inquirer.prompt(questions)
    return answers[searchQuery]
  }

  const getTrackList = async (currentTrackList = []) => {
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

  const downloadTrack = async (track) => {
    const name = getTrackNameFromRes(track)
    const downloadPath = path.resolve(await getDownloadFolder(), name)

    const spinner = ora(`Downloading file at: ${downloadPath}`).start()

    const downloadRes = await slsk.download({
      file: track,
      path: downloadPath
    })

    await writeFile(downloadPath, downloadRes.buffer)
    spinner.stop()
  }

  const downloadTracks = async trackList => {
    const limit = pLimit(downloadConcurrency)

    return Promise.all(trackList.map((track) => {
      return limit(async () => {
        await downloadTrack(track)
      })
    })).catch(error => {
      console.error(error)
    })
  }

  // Here we go:

  await slsk.connect({
    username,
    password
  })

  log.info(`Connected to Soulseek.`)

  const trackList = await getTrackList()
  await downloadTracks(trackList)

  const shouldBurn = await getShouldBurn()
  const shouldKeepFolder = await getShouldKeepFolder()

  if (shouldBurn) {
    await cd.burnFolder({
      folderName: await getDownloadFolder()
    })
  }

  if (!shouldKeepFolder) {
    await fsExtra.remove(await getDownloadFolder())
  } else {
    await open(await getDownloadFolder())
  }

  return true
}

module.exports = download
