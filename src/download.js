const path = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')
const slsk = require('./utils/slsk')
const inquirer = require('inquirer')
const prettyBytes = require('pretty-bytes')
const ora = require('ora')
const moment = require('moment')
const cd = require('./utils/cd')
const pLimit = require('p-limit')
const log = require('./utils/log')
const pkg = require('../package.json')
const open = require('open')
const prettyMs = require('pretty-ms')
const debug = require('debug')(pkg.name)

const PKG_NAME = pkg.name

const download = async ({
  username,
  password,
  downloadConcurrency = 6,
  searchDuration = 2000,
  maxDownloadTime = 30000,
  maxExpireRetries = 2,
  maxFailRetries = 2
}) => {
  let _downloadFolder = null

  const getTrackNameFromRes = res => {
    const { file } = res
    const match = file.match(/[^\\]+$/)
    return match[0] ? match[0] : file
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

    const files = searchRes
      .filter(it => path.extname(it.file) === '.mp3')
      .filter(it => it.bitrate === 320)
      .sort((a, b) => (a.size / a.speed) - (b.size / b.speed))
      .filter(it => it.slots)

    const choices = files
      .reduce((output, track) => {
        const name = getTrackNameFromRes(track)

        track.__expireTries = 0
        track.__failTries = 0

        output.push({
          name: `${name} (${prettyBytes(track.size)}) - ${track.file} - ${track.bitrate}kbps - ${track.speed}`,
          value: track
        })

        return output
      }, [])

    if (choices.length === 0) {
      return false
    }

    const answers = await inquirer.prompt({
      type: 'list',
      name: searchQuery,
      message: `Select a download for your track:`,
      choices
    })

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

    if (selectedFile === false) {
      log.info('No search results found. Please try a new search query.')
      return getTrackList(currentTrackList)
    }

    currentTrackList.push(selectedFile)

    const { shouldContinue } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldContinue',
      message: 'Do you want to add more tracks?',
      default: true
    }])

    if (shouldContinue) {
      return getTrackList(currentTrackList)
    }

    return currentTrackList
  }

  const downloadStreams = {}

  const downloadTrack = async (track) => new Promise(async (resolve, reject) => {
    const name = getTrackNameFromRes(track)
    const downloadPath = path.resolve(await getDownloadFolder(), name)
    const spinner = ora(`Downloading file at: ${downloadPath}`).start()
    const writeStream = fs.createWriteStream(downloadPath)

    setTimeout(async () => {
      downloadStream.destroy()
      spinner.stop()
      reject(new Error('expired'))
    }, maxDownloadTime)

    const downloadStream = await slsk.downloadStream({
      file: track
    })

    downloadStream.on('data', (chunk) => {
      writeStream.write(chunk)
    })

    downloadStream.on('error', (error) => {
      reject(error)
    })

    downloadStream.on('end', () => {
      writeStream.end()
      spinner.stop()
      resolve()
    })

    downloadStreams[name] = downloadStream
  })

  const downloadTracks = async (trackList, downloadedTrackCount = 0) => {
    const limit = pLimit(downloadConcurrency)
    const expiredDownloads = []
    const failedDownloads = []

    debug('Starting to download tracks with concurrency: ' + downloadConcurrency)

    await Promise.all(trackList.map((track) => {
      return limit(async () => {
        await downloadTrack(track)
          .then(() => {
            downloadedTrackCount++
          })
          .catch((error) => {
            const name = getTrackNameFromRes(track)

            if (error.message === 'expired') {
              log.warn(`Download '${name}' expired (max: ${prettyMs(maxDownloadTime)})`)

              if (track.__expireTries < maxExpireRetries) {
                expiredDownloads.push(track)
              }

              track.__expireTries++
            } else {
              log.warn(`Download '${name}' failed: ${error}`)

              if (track.__failTries < maxFailRetries) {
                failedDownloads.push(track)
              }

              track.__failTries++
            }
          })
      })
    })).catch(error => {
      console.error(error)
    })

    let retries = []

    if (expiredDownloads.length > 0) {
      retries = [
        ...retries,
        ...expiredDownloads
      ]
    }

    if (failedDownloads.length > 0) {
      retries = [
        ...retries,
        ...failedDownloads
      ]
    }

    if (retries.length > 0) {
      return downloadTracks(retries, downloadedTrackCount)
    }

    return {
      downloadedTrackCount
    }
  }

  if (!downloadConcurrency || downloadConcurrency === 0) {
    throw new Error(`Download concurrency was ${downloadConcurrency}. Please re-start dj-tools configure, and set a correct concurrency value`)
  }

  // Here we go:

  debug('Connecting to Soulseek')

  await slsk.connect({
    username,
    password
  })

  log.info(`Connected to Soulseek.`)

  const trackList = await getTrackList()

  debug('Tracklist complete, has ' + trackList.length + ' items')

  const { downloadedTrackCount } = await downloadTracks(trackList)

  if (downloadedTrackCount === 0) {
    log.warn('Downloaded no tracks.')
    return true
  }

  const shouldBurn = await getShouldBurn()
  const downloadFolder = await getDownloadFolder()

  if (shouldBurn) {
    await cd.burnFolder({
      folderName: downloadFolder
    })

    await open(downloadFolder)
  } else {
    const shouldKeepFolder = await getShouldKeepFolder()

    if (!shouldKeepFolder) {
      await fsExtra.remove(downloadFolder)
    } else {
      await open(downloadFolder)
    }
  }

  return true
}

module.exports = download
