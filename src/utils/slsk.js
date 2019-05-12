const slsk = require('slsk-client')

let _client = null

const connect = ({
  username: user,
  password: pass
}) => new Promise((resolve, reject) => {
  slsk.connect({
    user,
    pass
  }, (error, client) => {
    if (error) {
      return reject(error)
    }

    _client = client
    resolve(client)
  })
})

const search = options => new Promise((resolve, reject) => {
  _client.search(options, (error, res) => {
    if (error) {
      return reject(error)
    }

    resolve(res)
  })
})

const download = options => new Promise((resolve, reject) => {
  _client.download(options, (error, res) => {
    if (error) {
      return reject(error)
    }

    resolve(res)
  })
})

const downloadStream = options => new Promise((resolve, reject) => {
  _client.downloadStream(options, (error, res) => {
    if (error) {
      return reject(error)
    }

    resolve(res)
  })
})

module.exports = {
  connect,
  search,
  download,
  downloadStream
}
