'use strict'
var h = require('hyperscript')
var com = require('./index')

var messageOpts = { mustRender: false, asTop: false }
module.exports = function (app, thread, opts) {
  opts = opts || messageOpts
  var r = replies(app, thread)
  console.log(thread)
  opts.asTop      = !thread.parent // render as top thread if no parent
  opts.mustRender = !!r // always render if there are replies
  var m = com.message(app, thread, opts)
  return (m) ? h('.message-thread', [m, r]) : ''
}

function replies (app, thread) {
  // collect replies
  var r = []
  ;(thread.replies || []).forEach(function(reply) {
    r.push(com.message(app, reply))
    r.push(replies(app, reply))
  })

  if (r.length)
    return h('.message-replies', r)
  return ''
}