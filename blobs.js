var fs   = require('fs')
var path = require('path')
var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')

function toBuffer() {
  return pull.map(function (s) { return Buffer.isBuffer(s) ? s : new Buffer(s, 'base64') })
}

module.exports = function(server) {
  return function(req, res, next) {
    function pathStarts(v) { return req.url.indexOf(v) === 0; }

    if (pathStarts('/ext/')) {
      var hash = req.url.slice(5)
      return server.blobs.has(hash, function(err, has) {
        if (!has) {
          res.writeHead(404)
          res.end('File not found')
          return
        }
        pull(
          server.blobs.get(hash),
          toBuffer(),
          toPull(res)
        )
      })
    }
    next()
  }
}