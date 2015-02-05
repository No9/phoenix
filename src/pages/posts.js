'use strict'
var h = require('hyperscript')
var com = require('../com')

var mustRenderOpts = { mustRender: true }
module.exports = function (app) {

  var opts = { start: 0 }
  app.ssb.phoenix.getPosts(opts, function (err, msgs) {

    // markup

    var content = h('table.table.message-feed', msgs.map(function (msg) {
      if (msg.value) return com.messageSummary(app, msg, mustRenderOpts)
    }))

    var help = h('.row',
      h('.col-xs-4',
        com.panel(h('span', 'Join a Pub Server ', h('small', 'recommended')),
          h('div',
            h('p', 'Ask the owner of a pub server for an ', com.a('#/help/pubs', 'invite code'), '.'),
            h('button.btn.btn-primary', { onclick: app.followPrompt }, 'Use an invite')
          )
        )
      ),
      h('.col-xs-4',
        com.panel('Connect over WiFi',
          h('p', 'Open the ', com.a('#/address-book', 'address book'), ' and find peers on your WiFi in the ', h('strong', 'Network'), ' column.')
        )
      ),
      h('.col-xs-4',
        com.panel(h('span', 'Start a Pub Server ', h('small', 'advanced')),
          h('p',
            com.a('https://github.com/ssbc/scuttlebot#running-a-pub-server', 'Follow these instructions'),
            ' then hand out invite codes to friends.'
          )
        )
      )
    )
    var composeBtn = h('button.btn.btn-primary.btn-strong.compose-btn', 'Compose')   
    var loadMoreBtn = (msgs.length === 30) ? h('p', h('button.btn.btn-primary.btn-block', { onclick: loadMore, style: 'margin-bottom: 24px' }, 'Load More')) : ''
    app.setPage('posts', h('.row',
      h('.col-xs-2.col-md-1', com.sidenav(app)),
      h('.col-xs-10.col-md-9',
        h('p',
          composeBtn,
          h('span#get-latest.hidden', h('button.btn.btn-primary', { onclick: app.refreshPage }, 'Get Latest'))
        ),
        com.postFormExpandable(app, composeBtn),
        content,
        loadMoreBtn, 
        help
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
      app.ssb.phoenix.getPosts(opts, function (err, moreMsgs) {
        if (moreMsgs.length > 0) {
          moreMsgs.forEach(function (msg) { 
            if (msg.value) content.appendChild(com.messageSummary(app, msg, mustRenderOpts))
          })
        }
        // remove load more btn if it looks like there arent any more to load
        if (moreMsgs.length < 30)
          loadMoreBtn.parentNode.removeChild(loadMoreBtn)
      })
    }
  })
}