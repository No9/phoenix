'use strict'
var h = require('hyperscript')
var multicb = require('multicb')
var com = require('../com')

module.exports = function (app) {
  var opts = { start: 0 }
  var done = multicb({ pluck: 1 })
  app.ssb.phoenix.getInboxCount(done())
  app.ssb.phoenix.getInbox(opts, done())
  done(function (err, data) {
    var inboxCount = data[0]
    var msgs = data[1]

    // track read messages
    app.unreadMessages = 0
    localStorage.readMessages = inboxCount

    // markup
    
    var content
    if (msgs.length === 0) {
      content = [
        h('p', h('strong', 'Your inbox is empty!')),
        h('p', 'When somebody @-mentions you or replies to your posts, you\'ll see their message here.')
      ]
    } else {
      content = h('table.table.message-feed', msgs.map(function (msg) {
        if (msg.value) return com.messageSummary(app, msg)
      }))
    }

    var composeBtn = h('button.btn.btn-primary.btn-strong.compose-btn', 'Compose')
    var loadMoreBtn = (msgs.length === 30) ? h('p', h('button.btn.btn-primary.btn-block', { onclick: loadMore }, 'Load More')) : ''
    app.setPage('feed', h('.row',
      h('.col-xs-2.col-md-1', com.sidenav(app)),
      h('.col-xs-10.col-md-9',
        h('p', composeBtn),
        com.postFormExpandable(app, composeBtn),
        content,
        loadMoreBtn
      ),
      h('.hidden-xs.hidden-sm.col-md-2',
        com.adverts(app),
        h('hr'),
        com.sidehelp(app)
      )
    ))

    // handlers

    function loadMore (e) {
      e.preventDefault()
      opts.start += 30
      app.ssb.phoenix.getInbox(opts, function (err, moreMsgs) {
        if (moreMsgs.length > 0) {
          moreMsgs.forEach(function (msg) { 
            if (msg.value) content.appendChild(com.messageSummary(app, msg))
          })
        }
        // remove load more btn if it looks like there arent any more to load
        if (moreMsgs.length < 30)
          loadMoreBtn.parentNode.removeChild(loadMoreBtn)
      })
    }
  })
}