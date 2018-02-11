const fs = require('fs');
const request = require('request');
const path = require('path');
const Async = require('async');
const Config = require('../config');
const Util = require('../util');
const {remote} = require('electron');

const config = Config.load();

function download (url, filename, callback = null) {
  console.info(`download start: ${url}`);
  if (config.autoSaveFavUrlName) {
    filename = Util.getFileName(url);
  }
  const savepath = (config.autoSavePath || '').trim()
    || path.join(Util.getWritableRootPath(), 'Favorited Images');
  try {
    fs.mkdirSync(savepath);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      window.toastErrorMessage('Failed - Save Image : Cannot make folder');
      return;
    }
  }
  const filepath = path.join(savepath, filename);
  try {
    const req = request(url);
    if (typeof callback === 'function') {
      req.on('error', err => {
        callback(err, {
          ok: false,
        });
      });
      req.on('end', () => {
        callback(null, {
          ok: true,
          filepath,
        });
      });
    }
    req.pipe(fs.createWriteStream(filepath));
  } catch (e) {
    window.toastErrorMessage(`Failed - Save Image : Cannot save image to ${filepath}`);
  }
}

function generateFilename (imgurl, index) {
  const splitted = imgurl.split('.');
  const ext = splitted[splitted.length - 1]
    .replace(/:\w+/, '');
  const now = new Date();
  let [date, time] = now.toISOString().split(/T|Z/);
  time = time.replace(/:/g, '');
  const result = `${date} ${time}-${index}.${ext}`;
  return result;
}

function favoriteAutoSave (tweet) {
  // Already favorited. quit function
  // if (tweet.hasClass('is-favorite')) return;

  // in detail view
  const images = tweet.find('img.media-img');
  const filesToDownload = [];
  let index = 1;
  if (images.length > 0) {
    images.each((i, elem) => {
      let url = Util.getOrigPath(elem.src);
      let filename = generateFilename(url, index++);
      filesToDownload.push({url, filename});
    });
  } else {
    // in timeline
    const images = tweet.find('a.js-media-image-link');
    images.each((i, elem) => {
      let match = elem.style.backgroundImage.match(/url\("(.+)"\)/);
      if (!match) return;
      let url = Util.getOrigPath(match[1]);
      let filename = generateFilename(url, index++);
      filesToDownload.push({url, filename});
    });
  }
  // find GIF
  const video = tweet.find('video.js-media-gif');
  if (video.length > 0) {
    const url = video[0].currentSrc;
    const filename = generateFilename(url);
    filesToDownload.push({url, filename});
  }
  if (config.disableParallelDownload) {
    Async.eachSeries(filesToDownload, (file, callback) => {
      download(file.url, file.filename, (err, result) => {
        callback(err, result);
      });
    }, error => {
      if (!error) return;
      window.toastErrorMessage(`Failed - ${error}`);
    });
  } else {
    filesToDownload.forEach(file => {
      download(file.url, file.filename);
    });
  }
}

function tossElement (e) {
  if (typeof e === 'undefined') return;
  const keyState = remote.getGlobal('keyState');
  const isMacOS = process.platform === 'darwin';
  const macIgnore = isMacOS ? keyState.alt : keyState.ctrl;
  if (macIgnore) {
    return;
  } else if (config.enableAutoSaveFav) {
    favoriteAutoSave(window.$(`[data-key="${e}"]`).eq(0));
  }
}

module.exports = tossElement;
