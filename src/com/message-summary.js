'use strict'
var h = require('hyperscript')
var mlib = require('ssb-msgs')
var com = require('./index')
var util = require('../lib/util')
var markdown = require('../lib/markdown')

function isImage (name) {
  var ext = name.split('.').slice(-1)[0]
  return (ext == 'jpg' || ext == 'jpeg' || ext == 'png' || ext == 'bmp' || ext == 'gif' || ext == 'svg')
}

var attachmentOpts = { toext: true, rel: 'attachment' }, mainAttachmentOpts = { toext: true, rel: 'main' }
module.exports = function (app, msg, opts) {

  // markup

  var content, isRaw
  if (msg.value.content.type == 'post') {
    content = msg.value.content.text
  } else {
    if (!opts || !opts.mustRender)
      return ''
    content = JSON.stringify(msg.value.content)
    isRaw = true
  }
  content = util.escapePlain(content)
  content = markdown.emojis(content)
  content = markdown.mentionLinks(content, app.names, true)

  var len = noHtmlLen(content)
  if (len > 240 || content.length > 2048) {
    content = content.slice(0, Math.min(240 + (content.length - len), 2048)) + '...'
  }

  var mainUrl = '#/msg/'+msg.key
  var name = app.names[msg.value.author] || util.shortString(msg.value.author)
  var nameConfidence = com.nameConfidence(msg.value.author, app)

  var thumbnail
  var numAttachments = mlib.getLinks(msg.value.content, attachmentOpts).length
  var mainExt = mlib.getLinks(msg.value.content, mainAttachmentOpts)[0]
  if (mainExt) {
    numAttachments++
    mainUrl = (mainExt.name) ? '/msg/'+msg.key+'/ext/'+mainExt.name : '/ext/'+mainExt.ext
    thumbnail = isImage(mainExt.name) ? h('img.thumbnail', { src: mainUrl, title: mainExt.name, alt: mainExt.name }) : com.icon('link')
  } else
    thumbnail = com.icon('comment')

  return h('.message-summary',
    h('h4', com.a(mainUrl, [thumbnail, ' ', h('span', { innerHTML: content })])),
    h('p.text-muted',
      h('small', 'published by ', com.userlink(msg.value.author, name), nameConfidence, ' ', util.prettydate(new Date(msg.value.timestamp), true))
    ),
    h('p.text-muted',
      h('small.related', com.a('#/msg/'+msg.key, [
        msg.numThreadReplies||0, ' comment', (msg.numThreadReplies !== 1) ? 's' : '',
        ', ',        
        numAttachments, ' file', (numAttachments !== 1) ? 's' : ''
      ]))
    )
  )
}

function noHtmlLen (str) {
  var entityLen = 0
  str.replace(/<.*>/g, function($0) {
    entityLen += $0.length
  })
  return str.length - entityLen
}