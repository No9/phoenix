'use strict'
var h = require('hyperscript')
var mlib = require('ssb-msgs')
var com = require('./index')
var util = require('../lib/util')
var markdown = require('../lib/markdown')

function extUrl (msg, link) {
  return (link.name) ? '/msg/'+msg.key+'/ext/'+link.name : '/ext/'+link.ext
}

function isImage (name) {
  var ext = name.split('.').slice(-1)[0]
  return (ext == 'jpg' || ext == 'jpeg' || ext == 'png' || ext == 'bmp' || ext == 'gif' || ext == 'svg')
}

var attachmentOpts = { toext: true, rel: 'attachment' }, mainAttachmentOpts = { toext: true, rel: 'main' }
module.exports = function (app, msg, opts) {
  var content
  if (opts && opts.raw) {
    content = messageRaw(app, msg)
  } else {
    if (msg.value.content.type == 'post') {
      content = msg.value.content.text
      if ((!opts || !opts.fullLength) && content.length >= 512) {
        content = content.slice(0, 512) + '... [read more](#/msg/'+msg.key+')'
      }
      if (!opts || !opts.asTop)
        content = h('div', { innerHTML: markdown.block(content, app.names) })
      else {
        content = util.escapePlain(content)
        content = markdown.emojis(content)
        content = markdown.mentionLinks(content, app.names)
      }
    } else {
      if (!opts || !opts.mustRender)
        return ''
      content = messageRaw(app, msg)
    }
  }

  if (opts && opts.asTop)
    return renderPost(app, msg, content)    
  return renderReply(app, msg, content)
}

function messageRaw (app, msg) {
  var obj = (false/*app.page.renderMode == 'rawfull'*/) ? msg.value : msg.value.content
  var json = util.escapePlain(JSON.stringify(obj, null, 2))

  // turn feed references into links
  json = json.replace(/\"feed\": \"([^\"]+)\"/g, function($0, $1) {
    var name = app.names[$1] || $1
    return '"feed": "<a class="user-link" href="/#/profile/'+$1+'">'+name+'</a>"'
  })

  // turn message references into links
  json = json.replace(/\"msg\": \"([^\"]+)\"/g, function($0, $1) {
    return '"msg": "<a href="/#/msg/'+$1+'">'+$1+'</a>"'
  })

  return h('.message-raw', { innerHTML: json })
}

function renderPost (app, msg, content) {

  // markup

  var mainUrl = '#/msg/'+msg.key
  var name = app.names[msg.value.author] || util.shortString(msg.value.author)
  var nameConfidence = com.nameConfidence(msg.value.author, app)

  var mainExt = mlib.getLinks(msg.value.content, mainAttachmentOpts)[0]
  var attachmentExts = mlib.getLinks(msg.value.content, attachmentOpts)
  var numAttachments = attachmentExts.length
  if (mainExt) {
    numAttachments++
    mainUrl = extUrl(msg, mainExt)
  }

  var header = h('.header',
    h('h2', com.a(mainUrl, { innerHTML: content })),
    h('p.text-muted',
      com.userlink(msg.value.author, name), nameConfidence, ' ', util.prettydate(new Date(msg.value.timestamp), true),
      ' (', msg.numThreadReplies||0, ' comment', (msg.numThreadReplies !== 1) ? 's' : '',
      ', ',
      numAttachments, ' file', (numAttachments !== 1) ? 's' : '',
      ') ',
      h('span', {innerHTML: ' &middot; '}),
      h('a', { title: 'Reply', href: '#', onclick: reply }, 'reply')
    ),
    h('h4', numAttachments, ' files'),
    renderAttachments(app, msg, mainExt, attachmentExts),
    h('h4', msg.numThreadReplies||0, ' comments')
  )

  // handlers

  function reply (e) {
    e.preventDefault()

    if (!header.nextSibling || !header.nextSibling.classList || !header.nextSibling.classList.contains('reply-form')) {
      var form = com.postForm(app, msg.key)
      if (header.nextSibling)
        header.parentNode.insertBefore(form, header.nextSibling)
      else
        header.parentNode.appendChild(form)
    }
  }

  return header
}

function renderAttachments (app, msg, main, others) {
  var markup = []
  if (main) markup.push(render(main))
  others.forEach(function (other) {
    markup.push(render(other))
  })
  function render (link) {
    var thumbnail
    if (link.name && isImage(link.name))
      thumbnail = h('img', { src: '/ext/'+link.ext, alt: link.name, title: link.name })
    else
      thumbnail = com.icon('file')
    return h('.attachment', com.a(extUrl(msg, link), [thumbnail, link.name||link.ext]))
  }
  return h('.attachments', markup)
}

function renderReply (app, msg, content) {

  // markup 

  var nReplies = (msg.replies) ? msg.replies.length : 0
  var repliesStr = ''
  if (nReplies == 1) repliesStr = ' (1 reply)'
  if (nReplies > 1) repliesStr = ' ('+nReplies+' replies)'

  var msgfooter
  var attachments = mlib.getLinks(msg.value.content, attachmentOpts).concat(mlib.getLinks(msg.value.content, mainAttachmentOpts))
  if (attachments.length) {
    msgfooter = h('.panel-footer',
      h('ul', attachments.map(function (link) {
        var url = '#/ext/'+link.ext
        if (link.name)
          url += '?name='+encodeURIComponent(link.name)+'&msg='+encodeURIComponent(msg.key)
        return h('li', h('a', { href: url }, link.name || util.shortString(link.ext)))
      }))
    )
  }

  var msgbody = h('.data', content)
  var msgpanel = h('.message',
    msgbody,
    h('.metadata',
      com.userlink(msg.value.author, app.names[msg.value.author]), com.nameConfidence(msg.value.author, app),
      ' ', com.a('#/msg/'+msg.key, util.prettydate(new Date(msg.value.timestamp), true)+repliesStr, { title: 'View message thread' }),
      h('span.in-response-to'), // may be populated by the message page
      h('span', {innerHTML: ' &middot; '}), h('a', { title: 'Reply', href: '#', onclick: reply }, 'reply')
    ),
    msgfooter
  )

  // handlers

  function reply (e) {
    e.preventDefault()

    if (!msgpanel.nextSibling || !msgpanel.nextSibling.classList || !msgpanel.nextSibling.classList.contains('reply-form')) {
      var form = com.postForm(app, msg.key)
      if (msgpanel.nextSibling)
        msgpanel.parentNode.insertBefore(form, msgpanel.nextSibling)
      else
        msgpanel.parentNode.appendChild(form)
    }
  }

  return msgpanel
}