var pull = require('pull-stream')
var remoteRequire = require('remote-require')
var ssb = remoteRequire('ssb')

module.exports = {
  name: 'phoenix-feed',
  version: '0.0.0',
  permissions: {
    // anonymous: {allow: ['has', 'get']}, :TODO:
  }
}

exports.init = function() {
  var msgs = {}
  var replies = {}
  var allFeed = []
  var inboxFeed = []
  var userFeeds = {}

  var userId = null // :TODO:

  // handle received messages
  function process(msgEnvelope) {
    var msg = msgEnvelope.value
    msg.id = msgEnvelope.key

    // index
    msgs[msg.id] = msg
    allFeed.push(msg)
    (userFeeds[m.author] = (userFeeds[m.author]||[])).push(m)
    mlib.indexLinks(m.content, function(link) {
      if (link.rel == 'rebroadcasts') indexRebroadcast(msg, link)
      if (link.rel == 'replies-to')   indexReply(msg, link)
      if (link.rel == 'mentions')     indexMentions(msg, link)
    })
  }

  function indexRebroadcast(msg, link) {
    try {
      if (!link.msg) return
      if (msg.isInboxed) return
      msg.isRebroadcast = true
    } catch(e) { console.warn('failed to index rebroadcast', msg, e) }
  }

  function indexReply(msg, link) {
    try {
      if (!link.msg) return
      if (msg.isInboxed) return
      (replies[link.msg] = (replies[link.msg]||[]).push(msg)
      msg.repliesToLink = link

      // add to inbox if it's a reply to the user's message
      var target = msgs[link.msg]
      if (target && target.author == userId && msg.author != userId) {
        inboxFeed.push(msg)
        msg.isInboxed = true
      }
    } catch(e) { console.warn('failed to index reply', msg, e) }
    return false
  }

  function indexMentions(state, msg, link) {
    try {
      if (msg.isInboxed) return // already handled
      if (link.feed != userId) return // not for current user
      inboxFeed.push(msg)
      msg.isInboxed = true
    } catch(e) { console.warn('failed to index mention', msg, e) }
  }

  // publish a post
  function post(msg, cb) {
    // extract any @-mentions
    var match
    var mentionRegex = /(\s|^)@([A-z0-9\/=\.\+]+)/g;
    while ((match = mentionRegex.exec(msg.text))) {
      var mention = match[2]
      if (!msg.mentions)
        msg.mentions = []
      try {
        msg.mentions.push({ feed: mention, rel: 'mentions' })
      } catch (e) { /* :TODO: bad hash, tell user? */ console.warn('Invalid hash used in @-mention', mention) }
    }
    ssb.add(msg, cb)
  }

  return {
    // new messages sink-stream
    in: function() { return pull.drain(process) },

    // output streams
    all: function() { return pull.values(allFeed) }
    inbox: function() { return pull.values(inboxFeed) },
    user: function(id) { return pull.values(userFeeds[id]) },

    // getters
    get: function(id, cb) {
      if (id in msgs) return cb(null, msgs[id])
      cb(new Error('Not Found'))
    },
    getReplies: function(id, cb) {
      if (id in msgs) return cb(null, replies[id]||[])
      cb(new Error('Not Found'))
    },

    // posts to the feed
    postText: function(text, cb) {
      if (!text.trim()) return cb(new Error('Can not post an empty string to the feed'))
      post({type: 'post', postType: 'text', text: text}, cb)
    }

    // posts to the feed
    postReply: function(text, parent, cb) {
      if (!text.trim()) return cb(new Error('Can not post an empty string to the feed'))
      if (!parent) return cb(new Error('Must provide a parent message to the reply'))
      post({type: 'post', postType: 'text', text: text, repliesTo: {msg: parent, rel: 'replies-to'}}, cb)
    }

    // posts to the feed
    postAction: function(text, cb) {
      if (!text.trim()) return cb(new Error('Can not post an empty string to the feed'))
      post({type: 'post', postType: 'action', text: text}, cb)
    }

    // posts to the feed
    postReaction: function(text, parent, cb) {
      if (!text.trim()) return cb(new Error('Can not post an empty string to the feed'))
      if (!parent) return cb(new Error('Must provide a parent message to the reply'))
      post({type: 'post', postType: 'action', text: text, repliesTo: {msg: parent, rel: 'replies-to'}}, cb)
    }

    // posts a copy of the given message to the feed
    rebroadcast: function(msg, cb) {
      if (!msg.content.rebroadcasts) {
        msg.content.rebroadcasts = {
          rel: 'rebroadcasts',
          msg: msg.id,
          feed: msg.author,
          timestamp: msg.timestamp
        }
      }
      ssb.add(msg.content, cb)
    }
  }
}
}