# dj-tools
Searches the internet for 320kbps mp3 files, download them, and optionally burn them to disk. It's the perfect solution for DJ's still using cd's.

It's using Soulseek under the hood, so please setup an account.

This repo is for educational purposes only, we don't support illegal downloading and you should always support artists by buying tracks, checkout [Beatport](http://beatport.com).

## Installation

```
npm install dj-tools -g
```

## Getting started

DJ-tools uses Soulseek to download everything, to get started please run `configure` and insert your Soulseek credentials.


![](https://raw.githubusercontent.com/mikevercoelen/dj-tools/master/docs/images/configure.gif)


```
dj-tools configure
```

## Downloading songs

![](https://raw.githubusercontent.com/mikevercoelen/dj-tools/master/docs/images/download.gif)

```
dj-tools download
```

## Debugging

```
DEBUG=dj-tools dj-tools download
```

For full details (including the underlying slsk-client):

```
DEBUG=* dj-tools download
```

## Future

Currently working on an Electron version, so we can easily find high quality mp3 tunes, download the and optionally burn them.

## Ideas

- Automatically download spotify playlists
- A lot of DJ's these don't use CD's anymore, they use USB sticks, there could be an option to copy files to an USB stick, after all they still have the same problem: downloading and organizing tracks and then moving them to a USB stick. 
