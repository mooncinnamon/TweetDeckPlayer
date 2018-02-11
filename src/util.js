const URL = require('url');
const path = require('path');
module.exports = {
  twimg_media: 'twimg.com/media',
  twimg_profile: 'twimg.com/profile_images',

  // 트위터 이미지의 원본 크기를 가리키는 링크를 반환
  getOrigPath (url) {
    if (url.includes('pbs.twimg.com')) {
      return url.replace(/:small$/, ':orig');
    } else if (url.includes('ton/data/dm')) {
      return url.replace(/:small$/, ':large');
    } else {
      return url;
    }
  },

  // 주어진 링크의 파일 이름을 반환
  getFileName (url) {
    const parsed = URL.parse(url);
    const pathname = parsed.pathname;
    let filename = pathname.split('/').pop();
    // remove ':small' or ':orig' in twitter's image url
    filename = filename.replace(/:\w*$/, '');
    return filename;
  },

  // 파일의 확장자를 반환
  getFileExtension (_href) {
    // 파일 경로에서 파일 이름을 가져옴
    const filename = this.getFileName(_href);
    if (filename.lastIndexOf('.') > -1) {
      return filename.substr(filename.lastIndexOf('.') + 1);
    } else {
      // 확장자가 없는 경우 공백 반환
      return '';
    }

  },
  // 유저 데이터 폴더를 리턴함
  // 일반적인 환경 : __dirname/data/
  // MacOS 패키징 : __dirname/<package-name> (ex. /TweetDeckPlayer.app -> /TweetDeckPlayer)
  getUserDataPath () {
    const rootPath = this.getWritableRootPath();
    return path.join(rootPath, 'data');
  },
  getWritableRootPath () {
    const tdpDirname = __dirname
      .replace(/\.asar$/, '')
      .replace('.app/Contents/Resources/app', '');
    const isMacOS = __dirname.endsWith('.app/Contents/Resources/app');
    if (isMacOS) {
      return tdpDirname;
    } else {
      return path.join(tdpDirname, '..');
    }
  },
};
