/* globals TD */
// based on Bluemark ( https://github.com/gaeulbyul/Bluemark )

const bookmarked = new Set();

function apiRequest (url, params) {
  const headers = new Headers();
  const bearerToken = TD.util.getBearerTokenAuthHeader();
  const csrfToken = TD.util.getCsrfTokenHeader();
  headers.append('content-type', 'application/x-www-form-urlencoded; charset=UTF-8');
  headers.append('authorization', bearerToken);
  headers.append('x-csrf-token', csrfToken);
  headers.append('x-twitter-active-user', 'yes');
  headers.append('x-twitter-auth-type', 'OAuth2Session');
  const fetchOptions = {
    method: 'POST',
    headers,
    credentials: 'include',
    body: new URLSearchParams(),
  };
  Object.entries(params).forEach(pair => {
    const [key, value] = pair;
    fetchOptions.body.append(key, value);
  });
  return fetch(url, fetchOptions);
}

const BookmarkAPI = {
  async add (tweetID) {
    const response = await apiRequest('https://api.twitter.com/1.1/bookmark/entries/add.json', {
      tweet_id: tweetID,
      tweet_mode: 'extended',
    });
    const responseJSON = await response.json();
    if (responseJSON.errors && responseJSON.errors.length > 0) {
      const firstError = responseJSON.errors[0];
      if (firstError.code === 405) {
        // 이미 북마크에 있는 트윗
        return false;
      }
      const errorMessage = `Error(${firstError.code}): ${firstError.message}`;
      throw new Error(errorMessage);
    }
    return true;
  },
  async remove (tweetID) {
    const response = await apiRequest('https://api.twitter.com/1.1/bookmark/entries/remove.json', {
      tweet_id: tweetID,
      tweet_mode: 'extended',
    });
    const responseJSON = await response.json();
    if (responseJSON.errors && responseJSON.errors.length > 0) {
      const firstError = responseJSON.errors[0];
      if (firstError.code === 34) {
        // 해당 트윗은 북마크에 없음
        return false;
      }
      const errorMessage = `Error(${firstError.code}): ${firstError.message}`;
      throw new Error(errorMessage);
    }
    return true;
  },
};

function makeMenuItem (options) {
  const { action, text, href } = options;
  const menuItem = document.createElement('li');
  menuItem.className = 'is-selectable';
  menuItem.style.cursor = 'pointer';
  menuItem.addEventListener('mouseenter', event => {
    event.target.classList.add('is-selected');
  });
  menuItem.addEventListener('mouseleave', event => {
    event.target.classList.remove('is-selected');
  });
  const link = document.createElement('a');
  link.setAttribute('data-action', action);
  link.className = action;
  link.textContent = text;
  if (href) {
    link.href = href;
    link.target = '_blank';
  } else {
    link.addEventListener('click', event => {
      event.preventDefault();
    });
  }
  menuItem.appendChild(link);
  return menuItem;
}

function insertBookmarkMenu (tweet) {
  const tweetId = tweet.getAttribute('data-tweet-id') || tweet.getAttribute('data-key');
  const userNickName = tweet.querySelector('b.fullname').textContent;
  const addBookmarkMenuItem = makeMenuItem({
    action: 'bluemark-add-bookmark',
    text: 'Add to Bookmark',
    href: null,
  });
  const removeBookmarkMenuItem = makeMenuItem({
    action: 'bluemark-remove-bookmark',
    text: 'Remove from Bookmark',
    href: null,
  });
  const insertMe = bookmarked.has(tweetId) ? removeBookmarkMenuItem : addBookmarkMenuItem;
  insertMe.setAttribute('data-bm-tweet-id', tweetId);
  insertMe.setAttribute('data-bm-user-nickname', userNickName);
  const whoQuote = tweet.querySelector('a[data-action="search-for-quoted"]');
  if (whoQuote) {
    whoQuote.parentElement.before(insertMe);
    return;
  }
}

function handleMenuEvent () {
  document.body.addEventListener('click', event => {
    const { target } = event;
    const parent = target.parentElement;
    // modal 등
    if (!parent) {
      return;
    }
    const tweetId = parent.getAttribute('data-bm-tweet-id');
    const userNickName = parent.getAttribute('data-bm-user-nickname');
    if (target.matches('.bluemark-add-bookmark')) {
      BookmarkAPI.add(tweetId).then(result => {
        bookmarked.add(tweetId);
        if (result) {
          window.toastMessage(`Added ${userNickName}'s tweet to Bookmark.`);
        } else {
          window.toastMessage('Already added in Bookmark.');
        }
      }, errorMessage => {
        window.toastErrorMessage(`Failed to add Bookmark:\n${errorMessage}`);
      });
    } else if (target.matches('.bluemark-remove-bookmark')) {
      BookmarkAPI.remove(tweetId).then(result => {
        bookmarked.delete(tweetId);
        if (result) {
          window.toastMessage(`Removed ${userNickName}'s tweet from Bookmark.`);
        } else {
          window.toastMessage('Already removed from Bookmark.');
        }
      }, errorMessage => {
        window.toastErrorMessage(`Failed to remove Bookmark:\n${errorMessage}`);
      });
    }
  });
}

module.exports = () => {
  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== node.ELEMENT_NODE) {
          continue;
        }
        if (!node.matches('.js-dropdown')) {
          continue;
        }
        const tweet = node.closest('[data-tweet-id]');
        if (tweet) {
          insertBookmarkMenu(tweet);
          continue;
        }
        // 자기 자신의 트윗은 data-tweet-id 속성이 없다.
        const tweet2 = node.closest('[data-key]');
        const key = tweet2 && tweet2.getAttribute('data-key');
        if (/^\d+$/.test(key)) {
          insertBookmarkMenu(tweet2);
        }
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
  });
  handleMenuEvent();
};
