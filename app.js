require('dotenv').config();

const Twitter = require('twitter');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('/tmp/db.json');
const db = low(adapter);
db.defaults({ tweets: [], users: [] }).write();

const _ = db._;

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET
});

function tweetContainsExactString(tweet, str) {
  return _.toLower(tweet.text).includes(_.toLower(str)) === true;
}

function tweetIsRetweet(tweet) {
  try {
    return tweet.retweeted_status.id_str !== null;
  } catch (e) {
    return false;
  }
}

function tweetIsQuoteTweet(tweet) {
  try {
    return tweet.quoted_status.id_str !== null;
  } catch (e) {
    return false;
  }
}

function tweetIsReply(tweet) {
  try {
    return tweet.in_reply_to_status_id !== null;
  } catch (e) {
    return false;
  }
}

function tweetIsUnique(tweet) {
  const isRetweet = tweetIsRetweet(tweet);
  const isQuoteTweet = tweetIsQuoteTweet(tweet);
  const isReply = tweetIsReply(tweet);

  if (isRetweet || isQuoteTweet || isReply) {
    return false;
  }

  const dbTweets = db.get('tweets');
  const tweetInDb = dbTweets.filter({ id: tweet.id_str }).value();
  if (!!tweetInDb) {
    return true;
  }

  return false;
}

function addToDb(tweet) {
  db
    .get('tweets')
    .push({ id: tweet.id_str })
    .write();
}

function replyToTweet(tweet) {
  client
    .post('statuses/update', {
      status: `@${tweet.user.screen_name} It is known.`,
      in_reply_to_status_id: tweet.id_str
    })
    .then(res => {
      console.log(
        `Successfully replied to tweet ${tweet.text} from @${tweet.user
          .screen_name}`
      );
    })
    .catch(e => {
      console.log('error posting reply', e);
    });
}

function run() {
  const searchString = 'Let it be known';

  const stream = client.stream('statuses/filter', { track: searchString });
  stream.on('data', tweet => {
    if (!!tweet) {
      if (
        tweetContainsExactString(tweet, searchString) &&
        tweetIsUnique(tweet)
      ) {
        addToDb(tweet);

        setTimeout(replyToTweet, 60 * 1000); // wait a minute to not seem so thirsty
      }
    }
  });

  stream.on('error', error => {
    console.error(error);
  });
}

run();
