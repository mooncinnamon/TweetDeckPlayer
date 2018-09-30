const electron = require('electron');
const {app, BrowserWindow, dialog, session, Menu, ipcMain, shell} = electron;
const fs = require('fs');
const mzFS = require('mz/fs');
const path = require('path');
const mime = require('mime');
const mkdirp = require('mkdirp');
const request = require('request');
const child_process = require('child_process');
const URL = require('url');
const Util = require('./util');

// set to userdata folder
app.setPath('userData', Util.getUserDataPath());

// 설정
const Config = require('./config');

const createUUIDv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

let win, settingsWin, twtlibWin, gTranslatorWin;
ipcMain.on('load-config', event => {
  event.returnValue = Config.load();
});

ipcMain.on('save-config', (event, config) => {
  Config.data = config;
  Config.save();
});

ipcMain.on('apply-config', () => {
  try {
    win.webContents.send('apply-config');
  } catch (e) {
    console.error(e);
  }
});

ipcMain.on('cloud-load-config', event => {
  let uuid = createUUIDv4();
  try {
    ipcMain.once(uuid, (e, p) => {
      event.returnValue = p;
    });
    win.webContents.send('cloud-load-config', uuid);
    return;
  } catch (e) {
    console.error(e);
  }
  ipcMain.removeAllListeners(uuid);
  event.returnValue = null;
  return;
});

ipcMain.on('cloud-save-config', (event, title) => {
  let uuid = createUUIDv4();
  try {
    ipcMain.once(uuid, (e, p) => {
      event.returnValue = p;
    });
    win.webContents.send('cloud-save-config', uuid, title);
    return;
  } catch (e) {
    console.error(e);
  }
  ipcMain.removeAllListeners(uuid);
  event.returnValue = null;
  return;
});

ipcMain.on('cloud-remove-config', (event, title) => {
  let uuid = createUUIDv4();
  try {
    ipcMain.once(uuid, (e, p) => {
      event.returnValue = p;
    });
    win.webContents.send('cloud-remove-config', uuid, title);
    return;
  } catch (e) {
    console.error(e);
  }
  ipcMain.removeAllListeners(uuid);
  event.returnValue = null;
  return;
});

ipcMain.on('request-theme', event => {
  try {
    const script = `(() => {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    })()`;
    win.webContents.executeJavaScript(script, false, theme => {
      event.returnValue = theme;
    });
  } catch (e) {
    event.returnValue = 'light';
  }
});

ipcMain.on('open-settings', () => {
  openSetting(win);
});


// global keyState
global.keyState = {};
global.keyState.shift = false;
global.keyState.ctrl = false;
global.keyState.alt = false;

// 프로그램 시작시 설정파일을 로드
Config.load();

// 프로그램의 중복실행 방지
var existInst = app.makeSingleInstance(() => {
  // 새로운 인스턴스가 실행되었을 때 기존 프로그램의 작동
  if (win) {
    win.show();
    win.focus();
  }
});
if (existInst) {
  app.quit();
}
// Electron v3에선 makeSingleInstance가 deprecated되었음.
/*
var existInst = app.requestSingleInstanceLock();
// 인스턴스가 존재하는 경우 프로그램 종료
if (!existInst) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 새로운 인스턴스가 실행되었을 때 기존 프로그램의 작동
    if (win) {
      win.show();
      win.focus();
    }
  });
}
*/

// 렌더러 프로세스가 죽었을때 이벤트
app.on('gpu-process-crashed', () => {});

// setting window
const openSetting = () => {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
  const width = 500;
  const height = 620;
  const b = win.getBounds();
  const x = Math.floor(b.x + (b.width - width) / 2);
  const y = Math.floor(b.y + (b.height - height) / 2);
  settingsWin = new BrowserWindow({
    width, height, x, y,
    parent: win,
    icon: path.join(__dirname, 'tweetdeck.ico'),
    modal: false,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  settingsWin.on('close', () => {
    settingsWin = null;
  });
  settingsWin.loadURL('file:///' + path.join(__dirname, 'setting.html'));
};


function openGoogleTranslatorWindow (text) {
  if (!gTranslatorWin) {
    gTranslatorWin = new BrowserWindow({
      width: 900,
      height: 600,
      title: 'Google Translator',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    gTranslatorWin.on('close', () => {
      gTranslatorWin = null;
    });
  }
  const encodedText = encodeURIComponent(text);
  gTranslatorWin.loadURL(`https://translate.google.com/#auto/ko/${encodedText}`);
}

//
// edit
//

const sub_cut = webContents => ({
  label: 'Cut',
  click: () => webContents.send('command', 'cut'),
});
const sub_copy = webContents => ({
  label: 'Copy',
  click: () => webContents.send('command', 'copy'),
});
const sub_paste = webContents => ({
  label: 'Paste',
  click: () => webContents.send('command', 'paste'),
});
const sub_delete = webContents => ({
  label: 'Delete',
  click: () => webContents.send('command', 'delete'),
});
const sub_selectall = webContents => ({
  label: 'Select All',
  click: () => webContents.send('command', 'selectall'),
});

//
// page control
//

const sub_reload = webContents => ({
  label: 'Reload',
  click: () => webContents.send('command', 'reload'),
});

//
// setting
//

const sub_alwaystop = window => ({
  label: 'Always on top',
  type: 'checkbox',
  checked: window.isAlwaysOnTop(),
  click () {
    const flag = !window.isAlwaysOnTop();
    window.setAlwaysOnTop(flag);
  },
});

const sub_setting = () => ({
  label: 'Setting',
  click: () => openSetting(),
});

//
// image
//

const sub_copy_img = webContents => ({
  label: 'Copy image',
  click: () => webContents.send('command', 'copyimage'),
});
const sub_save_img = (webContents, Addr) => ({
  label: 'Save image as..',
  click () {
    // 원본 해상도 이미지 경로를 가져온다
    const path = Util.getOrigPath(Addr.img);
    const filename = Util.getFileName(path);
    const ext = Util.getFileExtension(path);
    const filters = [];

    // Save dialog에 들어갈 파일 필터 정의
    switch (ext) {
      case 'jpg':
        filters.push({name: 'JPG File', extensions: ['jpg']});
        break;
      case 'png':
        filters.push({name: 'PNG File', extensions: ['png']});
        break;
      case 'gif':
        filters.push({name: 'GIF File', extensions: ['gif']});
        break;
      default:
        filters.push({name: ext.toUpperCase() + ' File', extensions: [ext.toLowerCase()]});
    }
    filters.push({name: 'All Files', extensions: ['*']});

    // 모든 포인터 이벤트를 잠시 없앤다
    webContents.send('no-pointer', true);

    // Save Dialog를 띄운다
    const savepath = dialog.showSaveDialog({
      defaultPath: filename,
      filters,
    });

    // 포인터 이벤트를 되살린다
    webContents.send('no-pointer', false);

    // savepath가 없는 경우 리턴
    if (typeof savepath === 'undefined') return;

    session.defaultSession.cookies.get({url: 'https://twitter.com'}, (error, cookies) => {
      const jar = request.jar();
      cookies.forEach(cookie => {
        const cookieString = `${cookie.name}=${cookie.value};`;
        jar.setCookie(request.cookie(cookieString), 'https://ton.twitter.com');
      });
      // http 요청을 보내고 저장
      request({
        url: path,
        jar,
      }).pipe(fs.createWriteStream(savepath));
    });
  },
});
const sub_copy_img_url = webContents => ({
  label: 'Copy image URL',
  click: () => webContents.send('command', 'copyimageurl'),
});
const sub_open_img = webContents => ({
  label: 'Open image in browser',
  click: () => webContents.send('command', 'openimage'),
});
const sub_open_img_popup = webContents => ({
  label: 'Open image in popup',
  click: () => webContents.send('command', 'openimagepopup'),
});
const sub_search_img_google = webContents => ({
  label: 'Search image with Google',
  click: () => webContents.send('command', 'googleimage'),
});

//
// link
//
const sub_open_link = webContents => ({
  label: 'Open link',
  click: () => webContents.send('command', 'openlink'),
});

const sub_open_link_popup = webContents => ({
  label: 'Open link in Popup',
  click: () => webContents.send('command', 'openlinkpopup'),
});

const sub_save_link = (webContents, Addr) => ({
  label: 'Save link as..',
  click () {
    let url = Addr.link;
    const filters = [];
    const reqOption = {
      url,
      method: 'HEAD',
      followAllRedirects: true,
    };
    request(reqOption, (error, response) => {
      if (error) return;
      const realUrl = response.request.uri.href;
      let filename = Util.getFileName(realUrl);
      let contentType = response.headers['content-type'];
      const parsedUrl = URL.parse(realUrl);
      if (parsedUrl.hostname === 'i.imgur.com' && realUrl.endsWith('.gifv')) {
        // force download gif (instead of gifv (mp4 video))
        url = realUrl.replace(/\.gifv$/i, '.gif');
        filename = filename.replace(/\.gifv$/i, '.gif');
        contentType = 'image/gif';
      }
      if (typeof contentType === 'string') {
        contentType = contentType.toLowerCase();
        let extension = mime.getExtension(contentType);
        if (extension) {
          if (extension === 'jpeg') {
            extension = 'jpg';
          }
          if (!filename.endsWith(`.${extension}`)) {
            filename += `.${extension}`;
          }
          filters.push({
            name: `${extension} File`,
            extensions: [extension],
          });
        } else {
          filters.push({
            name: 'File',
            extensions: ['*'],
          });
        }
      }
      // 모든 포인터 이벤트를 잠시 없앤다
      webContents.send('no-pointer', true);

      const savepath = dialog.showSaveDialog({
        defaultPath: filename,
        filters,
      });

      // 포인터 이벤트를 되살린다
      webContents.send('no-pointer', false);

      if (typeof savepath === 'undefined') return;

      // http 요청해서 링크를 저장
      request({
        url,
        followAllRedirects: true,
      }).pipe(fs.createWriteStream(savepath));
    });
  },
});

const sub_copy_link = webContents => ({
  label: 'Copy link URL',
  click: () => webContents.send('command', 'copylink'),
});

// quote
const sub_quote_without_notification = webContents => ({
  label: 'Quote without notification',
  click: () => webContents.send('command', 'quotewithoutnotification'),
});

const sub_copy_tweet = webContents => ({
  label: 'Copy Tweet',
  click: () => webContents.send('command', 'copy-tweet'),
});

const sub_copy_tweet_with_author = webContents => ({
  label: 'Copy Tweet (with @author)',
  click: () => webContents.send('command', 'copy-tweet-with-author'),
});

const sub_open_google_translator = webContents => ({
  label: 'Translate Tweet via Google Translator',
  click: () => webContents.send('command', 'open-google-translator'),
});

app.on('ready', () => {
  const preference = (Config.data && Config.data.bounds) ? Config.data.bounds : {};
  preference.icon = path.join(__dirname, 'tweetdeck.ico');
  preference.autoHideMenuBar = true;
  preference.webPreferences = {
    nodeIntegration: false,
    preload: path.join(__dirname, 'preload.js'),
  };
  win = new BrowserWindow(preference);
  win.loadURL('https://tweetdeck.twitter.com');
  win.setAlwaysOnTop(Config.data.defaultTopmost && true || false);

  if (Config.data.isMaximized) {
    win.maximize();
  }

  if (Config.data.isFullScreen) {
    win.setFullScreen(true);
  }

  // application menu
  let template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Setting...',
          click () {
            openSetting(win);
          },
        },
        {
          role: 'quit',
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          role: 'undo',
        },
        {
          role: 'redo',
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
        },
        {
          role: 'copy',
        },
        {
          role: 'paste',
        },
        {
          role: 'selectall',
        },
        {
          role: 'delete',
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload();
          },
        },
        {
          role: 'togglefullscreen',
        },
        {
          type: 'separator',
        },
        {
          role: 'resetzoom',
        },
        {
          role: 'zoomin',
        },
        {
          role: 'zoomout',
        },
        {
          type: 'separator',
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      role: 'window',
      submenu: [
        {
          label: 'Always on top',
          type: 'checkbox',
          checked: win.isAlwaysOnTop(),
          click () {
            var flag = !win.isAlwaysOnTop();
            win.setAlwaysOnTop(flag);
          },
        },
        {
          role: 'minimize',
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About TweetDeck Player...',
          click () {
            require('electron').shell.openExternal('https://github.com/sokcuri/TweetDeckPlayer');
          },
        },
      ],
    },
  ];

  let menu = Menu.buildFromTemplate(template);
  win.setMenu(menu);

  // devtool 열기
  //win.webContents.openDevTools()

  // electron post 리다이렉트 문제 해결 코드
  win.webContents.on('did-get-redirect-request', (e, oldURL, newURL, isMainFrame) => {
    if (isMainFrame) {
      setTimeout(() => win.webContents.send('redirect-url', newURL), 100);
      e.preventDefault();
    }
  });

  win.webContents.on('did-finish-load', () => {
    //let paceCSS = fs.readFileSync(path.join(__dirname, 'css/pace.css'), 'utf8');
    //win.webContents.insertCSS(paceCSS);
    const extraCSS = fs.readFileSync(path.join(__dirname, 'css/extra.css'), 'utf8');
    win.webContents.insertCSS(extraCSS);
    win.webContents.insertCSS(`
      .no-pointer {
        pointer-events: none;
      }
    `);
    if (Config.data.blockGoogleAnalytics) {
      const gaurl = ['*://*.google-analytics.com'];
      const ses = win.webContents.session;
      ses.webRequest.onBeforeRequest(gaurl, (details, callback) => {
        const block = /google-analytics/i.test(details.url);
        callback({
          cancel: block,
          requestHeaders: details.requestHeaders,
        });
      });
    }
  });

  ipcMain.on('page-ready-tdp', () => {
    // destroyed contents when loading
    const emojipadCSS = fs.readFileSync(path.join(__dirname, 'css/emojipad.css'), 'utf8');
    win.webContents.insertCSS(emojipadCSS);
    win.webContents.insertCSS(`
      .list-account .emoji {
        width: 1em;
        height: 1em;
      }
      .customize-columns .column {
        width: var(--column-size) !important;
        margin-right: 6px;
      }
    `);
    win.webContents.send('apply-config');

    // 유저 스크립트 로딩
    const noop = () => {};
    const loadUserAssets = async () => {
      const rootPath = Util.getWritableRootPath();
      const userScriptsPath = path.join(rootPath, 'scripts');
      const userStylesPath = path.join(rootPath, 'styles');
      mkdirp(userScriptsPath, noop);
      mkdirp(userStylesPath, noop);
      const styleFiles = await mzFS.readdir(userStylesPath);
      const styles = styleFiles.filter(f => f.endsWith('.css'));
      for (const style of styles) {
        const cssPath = path.join(userStylesPath, style);
        const css = await mzFS.readFile(cssPath, 'utf8');
        win.webContents.insertCSS(css);
      }
      const scriptFiles = await mzFS.readdir(userScriptsPath);
      const scripts = scriptFiles.filter(f => f.endsWith('.js'));
      for (const script of scripts) {
        const jsPath = path.join(userScriptsPath, script);
        const js = await mzFS.readFile(jsPath, 'utf8');
        win.webContents.executeJavaScript(js);
      }
    };
    loadUserAssets();
  });

  win.on('close', e => {
    try {
      Config.load();

      Config.data.isMaximized = win.isMaximized();
      Config.data.isFullScreen = win.isFullScreen();

      e.sender.hide();
      if (e.sender.isMaximized()) {
        e.sender.unmaximize();
      }
      if (e.sender.isFullScreen()){
        e.sender.setFullScreen(false);
      }

      Config.data.bounds = win.getBounds();
      Config.save();
      win = null;
    } catch (e) {
      console.error(e);
    }
  });

  win.webContents.on('new-window', (e, url) => {
    // 트윗덱 계정추가 시 뜨는 팝업은 예외적으로 내부 브라우저로 열게 한다.
    // 나머지 사이트는 외부 브라우저를 사용하도록.
    const isTwitterAuth = url.startsWith('https://twitter.com/teams/authorize');
    if (!isTwitterAuth) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // MacOS Application menu
  template = [
    {
      label: 'Edit',
      submenu: [
        {
          role: 'undo',
        },
        {
          role: 'redo',
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
        },
        {
          role: 'copy',
        },
        {
          role: 'paste',
        },
        {
          role: 'selectall',
        },
        {
          role: 'delete',
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload();
          },
        },
        {
          role: 'togglefullscreen',
        },
        {
          type: 'separator',
        },
        {
          role: 'resetzoom',
        },
        {
          role: 'zoomin',
        },
        {
          role: 'zoomout',
        },
        {
          type: 'separator',
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          role: 'about',
        },
        {
          type: 'separator',
        },
        {
          label: 'Setting...',
          click () {
            openSetting(win);
          },
        },
        {
          type: 'separator',
        },
        {
          role: 'hide',
        },
        {
          role: 'hideothers',
        },
        {
          role: 'unhide',
        },
        {
          type: 'separator',
        },
        {
          role: 'quit',
        },
      ],
    });

    template[3] = {
      role: 'window',
      submenu: [
        {
          label: 'Always on top',
          type: 'checkbox',
          checked: Config.data.defaultTopmost,
          click () {
            if (win) {
              var flag = !win.isAlwaysOnTop();
              win.setAlwaysOnTop(flag);
            }
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.close();
          },
        },
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
        },
        {
          label: 'Zoom',
          role: 'zoom',
        },
        {
          type: 'separator',
        },
        {
          label: 'Bring All to Front',
          role: 'front',
        },
      ],
    },

    template[4] = {
      role: 'help',
      submenu: [
        {
          label: 'About TweetDeck Player...',
          click () {
            require('electron').shell.openExternal('https://github.com/sokcuri/TweetDeckPlayer');
          },
        },
      ],
    };
  } else {
    template.unshift({
      label: 'File',
      submenu: [
        {
          label: 'Close',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.close();
          },
        },
      ],
    });
  }

  menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// disable-gpu 항목으로 재시작이 필요할 때
ipcMain.on('nogpu-relaunch', () => {
  app.releaseSingleInstance();
  existInst = null;
  const x = `${process.execPath} ${process.argv[1]} --disable-gpu --relaunch`;
  child_process.exec(x);
  setTimeout(() => app.quit(), 100);
});

// 컨텍스트 메뉴
ipcMain.on('context-menu', (event, menu, isRange, Addr) => {

  const template = [];
  const separator = { type: 'separator' };

  switch (menu) {
    case 'main':
      if (isRange) {
        template.push(sub_copy(event.sender));
        template.push(separator);
      }
      template.push(sub_reload(event.sender));
      break;

    case 'text':
      template.push({ label: 'Cut', enabled: false });
      template.push({ label: 'Copy', enabled: false });
      template.push(separator);
      template.push(sub_paste(event.sender));
      template.push({ label: 'Delete', enabled: false });
      template.push(separator);
      template.push(sub_selectall(event.sender));
      break;

    case 'input_sel':
      template.push(sub_cut(event.sender));
      template.push(sub_copy(event.sender));
      template.push(separator);
      template.push(sub_paste(event.sender));
      template.push(sub_delete(event.sender));
      template.push(separator);
      template.push(sub_selectall(event.sender));
      break;

    case 'text_sel':
      template.push(sub_copy(event.sender));
      break;

    case 'setting':
      template.push(sub_alwaystop(win));
      template.push(sub_setting(win));
      template.push(separator);
      template.push(sub_reload(event.sender));
      break;

    case 'selection':
      template.push(sub_copy(event.sender));
      template.push(separator);
      template.push(sub_reload(event.sender));
      break;

    case 'image':
      template.push(sub_copy_img(event.sender));
      template.push(sub_save_img(event.sender, Addr));
      template.push(sub_copy_img_url(event.sender));
      if (Config.data.enableOpenImageinPopup) {
        template.push(separator);
        template.push(sub_open_img(event.sender));
        template.push(sub_open_img_popup(event.sender));
        template.push(separator);
      } else {
        template.push(sub_open_img(event.sender));
      }
      template.push(sub_search_img_google(event.sender));
      template.push(separator);
      template.push(sub_reload(event.sender));
      break;

    case 'link':
      if (!Config.data.enableOpenLinkinPopup) {
        template.push(sub_open_link(event.sender));
      } else {
        template.push(sub_open_link(event.sender));
        template.push(sub_open_link_popup(event.sender));
        template.push(separator);
      }
      template.push(sub_save_link(event.sender, Addr));
      template.push(sub_copy_link(event.sender));
      template.push(separator);
      if (isRange) {
        template.push(sub_copy(event.sender));
        template.push(separator);
      }
      template.push(sub_reload(event.sender));
      break;

    case 'linkandimage':
      template.push(sub_save_link(event.sender, Addr));
      template.push(sub_copy_link(event.sender));
      if (!Config.data.enableOpenLinkinPopup) {
        template.push(sub_open_link(event.sender));
        template.push(separator);
      } else {
        template.push(sub_open_link(event.sender));
        template.push(sub_open_link_popup(event.sender));
        template.push(separator);
      }

      template.push(sub_copy_img(event.sender));
      template.push(sub_save_img(event.sender, Addr));
      template.push(sub_copy_img_url(event.sender));
      if (Config.data.enableOpenImageinPopup) {
        template.push(separator);
        template.push(sub_open_img(event.sender));
        template.push(sub_open_img_popup(event.sender));
        template.push(separator);
      } else {
        template.push(sub_open_img(event.sender));
      }
      template.push(sub_search_img_google(event.sender));
      template.push(separator);
      template.push(sub_reload(event.sender));
      break;

    case 'tweet':
      if (Addr.id !== '') {
        template.push(sub_quote_without_notification(event.sender));
        template.push(separator);
      }
      if (Addr.text !== '') {
        template.push(sub_copy_tweet(event.sender));
        template.push(sub_copy_tweet_with_author(event.sender));
        template.push(separator);
        template.push(sub_open_google_translator(event.sender));
        template.push(separator);
      }
      template.push(sub_reload(event.sender));
      break;
  }

  const contextMenu = Menu.buildFromTemplate(template);
  contextMenu.popup(win);
  return;
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('twtlib-open', () => {
  if (twtlibWin) {
    twtlibWin.focus();
    return;
  }
  const width = 500;
  const height = 480;
  const b = win.getBounds();
  const x = Math.floor(b.x + (b.width - width) / 2);
  const y = Math.floor(b.y + (b.height - height) / 2);
  twtlibWin = new BrowserWindow({
    width, height, x, y,
    parent: win,
    modal: false,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });
  twtlibWin.on('close', () => {
    twtlibWin = null;
    win.focus();
  });
  twtlibWin.loadURL('file:///' + path.join(__dirname, 'ui/twtlib.html'));
});

ipcMain.on('twtlib-send-text', (event, arg) => {
  win.webContents.send('twtlib-add-text', arg);
});

ipcMain.on('open-google-translator', (event, arg) => {
  openGoogleTranslatorWindow(arg.text);
});
