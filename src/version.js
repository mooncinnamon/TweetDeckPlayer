const package = require('../package.json');
const version = package.version;
module.exports.value = version;
module.exports.message = `TweetDeck Player v${version} by @sokcuri @d57_kr @gaeulbyul`;
