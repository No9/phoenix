module.exports = {
  // protocol
  auth: 'async',

  // output streams
  createFeedStream: 'source',
  createHistoryStream: 'source',
  createLogStream: 'source',
  messagesByType: 'source',
  messagesLinkedToMessage: 'source',
  messagesLinkedToFeed: 'source',
  messagesLinkedFromFeed: 'source',
  feedsLinkedToFeed: 'source',
  feedsLinkedFromFeed: 'source',
  followedUsers: 'source',

  // getters
  get: 'async',
  getPublicKey: 'async',
  getLatest: 'async',
  whoami: 'async',
  getLocal: 'async',

  // publishers
  add: 'async',

  // invites
  invite: {
    addMe: 'async'
  },

  // gossip
  gossip: {
    peers: 'sync'
  },

  // friends
  friends: {
    all: 'sync',
    hops: 'sync'
  },

  // phoenxi api
  phoenix: require('phoenix-api/manifest')
}