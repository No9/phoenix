var muxrpc     = require('muxrpc')
var pull       = require('pull-stream')
var ws         = require('pull-ws-server')
var Serializer = require('pull-serializer')

var HOST = 'localhost'
var PORT = 2000
var AUTH_PATH = '/auth.html'

module.exports = function (addr) {
  addr = addr || { host: HOST, port: PORT }
  var domain = 'http://'+(addr.host||HOST)+':'+(addr.port||PORT)
  var reconnectTimeout
  var wsStream, rpcStream
  var appAuth = require('./ssb-app-auth')(addr)
  var rpcapi = muxrpc(require('../mans/ssb'), {auth: 'async'}, serialize)({auth: auth})

  rpcapi.connect = function (opts) {
    opts = opts || {}
    opts.reconnect = opts.reconnect || 10000
    if (reconnectTimeout)
      clearTimeout(reconnectTimeout)
    reconnectTimeout = null

    if (wsStream)
      rpcapi._emit('socket:reconnecting')

    wsStream = ws.connect(addr)
    rpcStream = rpcapi.createStream()
    pull(wsStream, rpcStream, wsStream)

    wsStream.socket.onopen = function() {
      rpcapi._emit('socket:connect')
      appAuth.getToken(function(err, token) {
        rpcapi.auth(token, function(err) {
          if (err) {
            rpcapi._emit('perms:error', err)
            wsStream.socket.close()
          }
          else rpcapi._emit('perms:authed')
        })
      })
    }

    wsStream.socket.onclose = function() {
      rpcStream.close(function(){})
      rpcapi._emit('socket:error', new Error('Close'))
      if (!reconnectTimeout && opts.reconnect)
        reconnectTimeout = setTimeout(rpcapi.connect.bind(rpcapi, opts), opts.reconnect)
    }
  }

  rpcapi.close = function(cb) {
    rpcStream.close(cb || function(){})
    wsStream.socket.close()
  }

  rpcapi.getAuthUrl = appAuth.getAuthUrl.bind(appAuth)
  rpcapi.openAuthPopup = appAuth.openAuthPopup.bind(appAuth)
  rpcapi.deauth = appAuth.deauth.bind(appAuth)

  return rpcapi
}

function auth(req, cb) {
  cb(null, false)
}

function serialize (stream) {
  return Serializer(stream, JSON, {split: '\n\n'})
}