// Twtlib - 자주쓰는 상용구 기능 지원
const electron = require('electron');
const {ipcRenderer} = electron;

function makeButton (text, clickEventHandler) {
  const $ = window.$;
  const btn = $('<button>')
    .addClass('needsclick btn btn-on-blue full-width txt-left margin-b--12 padding-v--6');
  $('<span>')
    .addClass('label padding-ls')
    .text(text)
    .appendTo(btn);
  const btnContainer = $('.js-add-image-button').parent();
  return btn
    .on('click', clickEventHandler)
    .appendTo(btnContainer);
}

function clickHandler (event) {
  event.preventDefault();
  ipcRenderer.send('twtlib-open');
}

function main () {
  makeButton('Tweet library™', clickHandler);
  const $ = window.$;
  ipcRenderer.on('twtlib-add-text', (event, arg) => {
    if (!$('.app-content').hasClass('is-open')) {
      $(document).trigger('uiComposeTweet', { type: 'tweet' });
    }
    $('textarea.compose-text')
      .val(arg)
      .trigger('change');
  });
}

function TwtLib () {
  window.$(document).on('TD.ready', main);
}

module.exports = TwtLib;
