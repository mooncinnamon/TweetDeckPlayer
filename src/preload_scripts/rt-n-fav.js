const Config = require('../config');
const config = Config.load();

const singleActionButton = `
  <li class="tweet-action-item pull-left margin-r--10">
    <a class="js-show-tip tweet-action position-rel" href="#" data-action="rtAndFav" rel="rtAndFav">
      <i class="js-icon-mark-read icon icon-mark-read txt-center pull-left"></i>
      <span class="is-vishidden"> {{_i}}RT and FAV{{/i}} </span>
    </a>
  </li>
`;

const detailActionButton = `
  <li class="tweet-detail-action-item">
    <a class="js-show-tip tweet-detail-action position-rel" href="#" data-action="rtAndFav" rel="rtAndFav">
      <i class="js-icon-mark-read icon icon-mark-read txt-center"></i>
      <span class="is-vishidden"> RT and FAV </span>
    </a>
  </li>
`;

module.exports = () => {
  if (!config.enableRtAndFav) return;
  const $ = window.$;

  window.TD_mustaches['status/tweet_single_actions.mustache'] = window.TD_mustaches['status/tweet_single_actions.mustache']
    .replace('{{_i}}Like{{/i}} </span> </a> </li>', `{{_i}}Like{{/i}} </span> </a> </li> ${singleActionButton}`);
  window.TD_mustaches['status/tweet_detail_actions.mustache'] = window.TD_mustaches['status/tweet_detail_actions.mustache']
    .replace(/<ul (class="tweet-detail-actions.+")>.?<li/g, '<ul $1 style="display:flex;"> <li');
  window.TD_mustaches['status/tweet_detail_actions.mustache'] = window.TD_mustaches['status/tweet_detail_actions.mustache']
    .replace('{{_i}}Like{{/i}} </span> </a> {{/account}} </li>', `{{_i}}Like{{/i}} </span> </a> {{/account}} </li> ${detailActionButton}`);

  $(document.body).on('click', 'a[data-action="rtAndFav"]', event => {
    event.preventDefault();

    let article = event.target.closest('article');
    let tweetID = article.getAttribute('data-tweet-id');
    let accountKey = article.getAttribute('data-account-key');

    let favBtn = article.querySelector('a[rel="favorite"]');
    if (!favBtn.querySelector('i.icon-heart-filled')) {
      favBtn.click();
    }
    $(document).trigger('uiRetweet', {
      id: tweetID,
      from: [accountKey],
    });

    article.querySelector('div.js-tweet').classList.add('is-retweet', 'is-favorite');
    let retweetIcon = article.querySelector('a[rel="retweet"] i');
    retweetIcon.classList.remove('icon-retweet');
    retweetIcon.classList.add('icon-retweet-filled');
  });
};
