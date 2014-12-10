var mercury     = require('mercury')
var h           = require('mercury').h
var baseEmoji   = require('base-emoji')
var valueEvents = require('./value-events')
var widgets     = require('./widgets')
var com         = require('./com')
var util        = require('./util')


// puts the given vdom parts in columns given a `layout` config
// - `parts`: an object mapping names to vdom elements, eg { main: h(...), side: h(...) }
// - `layout`: an array of arrays choosing the layout, eg [['main', 8], ['side', 4]]
var columns = exports.columns = function(parts, layout) {
  parts.blank = ''
  return layout.map(function(col) {
    return h('.col-xs-' + col[1], parts[col[0]])
  })
}

// connection status alert
var connStatus = exports.connStatus = function(events, connStatus) {
  if (!connStatus.hasError)
    return h('div')
  return h('#conn-status.container', h('.alert.alert-danger', connStatus.explanation))
}

// notification system, types are "info", "warning", "error" and "success"
var actionFeedback = exports.actionFeedback = function(events, bubble) {
  if (!bubble.show)
    return h('div')
  return h('#action-feedback.container', h('.alert.alert-' + bubble.type, bubble.msg))
}

// not found message
var notfound = exports.notfound = function(what, suggestion) {
  return h('div', [
    h('h3', 'Sorry, '+what+' was not found.' + (suggestion || '')),
    h('p', h('small', 'here\'s a cuddly kitty to help you through this trying time')),
    randomcat()
  ])
}

// random cat giferator
var cats = ['lick-the-door']
var randomcat = exports.randomcat = function() {
  var cat = cats[Math.round(Math.random() * cats.length)] || cats[0]
  return img('/img/'+cat+'.gif')
}

// feed view
// - `feed`: which feed to render
// - `feedView`: app state object
// - `events`: app state object
// - `user`: app state object
// - `nicknameMap`: app state object
// - `reverse`: bool, reverse the feed?
// - `threaded`: bool, render threads?
var feed = exports.feed = function(messages, feedView, events, user, nicknameMap, reverse, threaded) {
  var moreBtn
  if (reverse) messages = [].concat(messages).reverse()
  if (feedView.pagination) {
    if (feedView.pagination.end < messages.length) {
      moreBtn = h('div.load-more', jsa('Load More', events.loadMore, undefined, { className: 'btn btn-default' }))
    }
    messages = messages.slice(feedView.pagination.start, feedView.pagination.end)
  }
  var renderfn = (threaded) ? msgThread : com.message
  messages = messages.map(function(msg) { return renderfn(msg, feedView, events, user, nicknameMap, true) })
  if (moreBtn)
    messages.push(moreBtn)
  return h('.feed', messages)
}

// message thread view
// - `msg`: message object to render
// - `feedView`: app state object
// - `events`: app state object
// - `user`: app state object
// - `nicknameMap`: app state object
// - `isTopRender`: bool, is the message the topmost being rendered now, regardless of its position in the thread?
var msgThread = exports.msgThread = function(msg, feedView, events, user, nicknameMap, isTopRender) {
  return h('.feed', [
    com.message(msg, feedView, events, user, nicknameMap, isTopRender),
    msgThreadTree(msg, feedView, events, user, nicknameMap)
  ])
}

// helper, recursively renders reply-tree of a thread
// - `msg`: message object to render
// - `feedView`: app state object
// - `events`: app state object
// - `user`: app state object
// - `nicknameMap`: app state object
function msgThreadTree(msg, feedView, events, user, nicknameMap) {
  // collect replies
  var replies = []
  ;(feedView.replies[msg.id] || []).forEach(function(replyData) {
    // fetch and render message
    var msgi  = feedView.messageMap[replyData.id] // look up index
    var reply = (typeof msgi != 'undefined') ? feedView.messages[feedView.messages.length - msgi - 1] : null
    if (reply && (reply.content.type == 'post' && (reply.content.postType == 'text' || reply.content.postType == 'gui')) && !reply.hidden) {
      replies.push(com.message(reply, feedView, events, user, nicknameMap, false))

      // build and render subtree
      var subtree = msgThreadTree(reply, feedView, events, user, nicknameMap, false)
      if (subtree)
        replies.push(subtree)
    }
  })

  if (replies.length)
    return h('.feed.subfeed', replies)
  return ''
}


// Helper Elements
// ===============

var firstWords = exports.firstWords = function(str, n) {
  var words = str.split(/\s/g)
  if (words.length < n) return words.join(' ')
  return words.slice(0, n).join(' ') + '...'
}

var syncButton = exports.syncButton = function(events, syncMsgsWaiting, isSyncing) {
  if (isSyncing) {
    return h('button.btn.btn-default', { disabled: true }, 'Syncing...')
  }
  var num = ''
  if (syncMsgsWaiting > 0)
    num = ' ('+syncMsgsWaiting+')'
  return h('button.btn.btn-default', { 'ev-click': events.sync }, 'Sync' + num)
}

var userlink = exports.userlink = function(id, text, user, events, opts) {
  opts = opts || {}
  opts.className = (opts.className || '') + ' user-link'
  var profileLink = a('#/profile/'+id, text, opts)
  var followLink = followlink(id, user, events)

  return h('span', [profileLink, ' ', followLink])
}

var followlink = exports.followlink = function(id, user, events) {
  var notMe = user.id !== id
  var notFollowed = user.followedUsers.indexOf(id) < 0

  return notMe && notFollowed ?
    a('javascript:;', '', { className: 'glyphicon glyphicon-plus', 'ev-click': valueEvents.click(events.follow, { id: id }) }) :
    ''
}

var dropdown = exports.dropdown = function (text, items) {
  return h('.dropdown', [
    new widgets.DropdownBtn(text),
    h('ul.dropdown-menu', items.map(function(item) {
      if (item.length == 2)
        return h('li', a(item[0], item[1]))
      return h('li', jsa(item[0], item[1], item[2]))
    }))
  ])
}

var splitdown = exports.splitdown = function (btn, items) {
  return h('.btn-group', [
    btn,
    new widgets.DropdownBtn(),
    h('ul.dropdown-menu', items.map(function(item) {
      return h('li', jsa(item[0], item[1], item[2]))
    }))
  ])
}

var icon = exports.icon = function (i) {
  return h('span.glyphicon.glyphicon-'+i)
}

var stylesheet = exports.stylesheet = function (href) {
  return h('link', { rel: 'stylesheet', href: href })
}

var a = exports.a =  function (href, text, opts) {
  opts = opts || {}
  opts.href = href
  return h('a', opts, text)
}

var jsa = exports.jsa =  function (text, event, evData, opts) {
  opts = opts || {}
  opts['ev-click'] = valueEvents.click(event, evData, { preventDefault: true })
  return a('javascript:void()', text, opts)
}

var img = exports.img = function (src) {
  return h('img', { src: src })
}

var shortString = exports.shortString = function (str) {
  return str.slice(0, 6) + '...' + str.slice(-2)
}

var toEmoji = exports.toEmoji = function (buf, size) {
  size = size || 20
  if (!buf)
    return ''
  if (typeof buf == 'string')
    buf = new Buffer(buf.slice(0, buf.indexOf('.')), 'base64')
  return baseEmoji.toCustom(buf, function(v, emoji) {
    return '<img class="emoji" width="'+size+'" height="'+size+'" src="/img/emoji/'+emoji.name+'.png" alt=":'+emoji.name+':" title="'+((+v).toString(16))+'">'
  })
}