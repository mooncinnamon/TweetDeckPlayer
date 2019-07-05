const package = require('../package.json');
const URL = require('url');
const path = require('path');
module.exports = {
  twimg_media: 'twimg.com/media',
  twimg_profile: 'twimg.com/profile_images',

  // 트위터 이미지의 원본 크기를 가리키는 링크를 반환
  /* NOTE 2018-06-27:
  트위터 이미지 URL 포맷이 바뀜
  예: "https://pbs.twimg.com/media/Dgn9V-aUwAEPBek.jpg?format=jpg&name=360x360"
  name= 부분엔 small, orig 등이 올 수 있음.
  일단 URL 끝에 ":orig" 넣어도 원본 크기의 이미지를 가져올 수 있음.
  */
  getOrigPath (url) {
    const parsed = URL.parse(url);
    if (parsed.hostname === 'pbs.twimg.com') {
      const extensionMatch = /\bformat=(\w+?)\b/.exec(parsed.search)
      const extension = '.' + (extensionMatch ? extensionMatch[1] : 'jpg')
      let filename = parsed.href
        .replace(parsed.search, '')
        .replace(/:\w*$/, '')
      if (!filename.endsWith(extension)) {
        filename += extension
      }
      filename += ':orig';
      return filename;
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
  // MacOS 패키징 : __dirname/<package-name> (pacakge-name = /TweetDeckPlayer.app -> /TweetDeckPlayer)
  getUserDataPath () {
    const rootPath = this.getWritableRootPath();
    return path.join(rootPath, 'data');
  },
  /* 트윗덱 플레이어의 root path를 리턴함
  npm (or yarn) start를 통해 실행한 경우: TweetDeckPlayer/src
  윈도우즈에서 __dirname: TweetDeckPlayer/app.asar/src
  macOS에서 __dirname: TweetDeckPlayer/TDP.app/Contents/Resources/app.asar/src
  리턴값 예: TweetDeckPlayer
  */
  getWritableRootPath () {
    const sep = path.sep;
    let tdpDirname = __dirname;
    if (tdpDirname.endsWith(`${sep}src`)) {
      tdpDirname = path.join(tdpDirname, '..');
    }
    const appName = `${package.name}.app`;
    // macOS의 "/TDP.app/Contents/Resources" 부분 제거
    const macOSResourceDir = path.join(sep, appName, 'Contents', 'Resources');
    tdpDirname = tdpDirname.replace(macOSResourceDir, '');
    // app.asar 및 하위 디렉토리부분 제거;
    while (tdpDirname.search(/\bapp\.asar\b/) !== -1) {
      tdpDirname = path.join(tdpDirname, '..');
    }
    return tdpDirname;
  },
};
