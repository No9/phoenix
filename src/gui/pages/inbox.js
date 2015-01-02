var h = require('hyperscript')
var pull = require('pull-stream')
var com = require('../com')

module.exports = function(state) {
  var msgs = []
  for (var i=state.inbox.length-1; i>=0; i--) {
    msgs.push(com.message(state, state.msgsById[state.inbox[i]]))
  }

  state.setPage(com.page(state, 'feed', h('.row',
    h('.col-xs-2.col-md-1', com.sidenav(state)),
    h('.col-xs-8', h('.message-feed', msgs)),
    h('.col-xs-2.col-md-3', com.adverts(state))
  )))
}