'use strict'
var h = require('hyperscript')
var suggestBox = require('suggest-box')
var schemas = require('ssb-msg-schemas')
var createHash = require('multiblob/util').createHash
var pull = require('pull-stream')
var pushable = require('pull-pushable')
var com = require('./index')
var util = require('../lib/util')
var markdown = require('../lib/markdown')

module.exports = function (app, parent) {

  var attachments = []
  var namesList = {} // a name->name map for the previews
  for (var id in app.names)
    namesList[app.names[id]] = app.names[id]

  // markup

  var preview = h('.preview')
  var hiddenFilesInput = h('input.hidden', { type: 'file', multiple: true, onchange: filesAdded })  
  var filesList = h('ul')
  var postBtn = h('button.btn.btn-primary.btn-strong.pull-right', { disabled: true }, 'Post')
  var form, textarea, titleInput, mainFileInput

  if (parent) {
    textarea = h('textarea', { name: 'post-body', placeholder: 'Compose your message', rows: 6, onkeyup: onPostTextChange })
    suggestBox(textarea, app.suggestOptions)

    form = h('form.post-form.reply-form', { onsubmit: post },
      h('small.text-muted', 'All posts are public. Markdown, @-mentions, and emojis are supported.'),
      h('div',
        h('.post-form-textarea.with-attachments', textarea),
        h('.post-form-attachments',
          filesList,
          h('a', { href: 'javascript:void(0)', onclick: addFile }, 'Click here to add an attachment'),
          hiddenFilesInput
        )
      ),
      h('p.post-form-btns', postBtn, h('button.btn.btn-primary', { onclick: cancel }, 'Cancel')),
      h('.preview-wrapper.panel.panel-default.hidden',
        h('.panel-heading', h('small', 'Preview:')),
        h('.panel-body', preview)
      )
    )
  } else {
    titleInput = h('input.form-control', { name: 'title', placeholder: 'Post title', onkeyup: onPostTextChange })
    mainFileInput = h('input.text-control', { type: 'file', multiple: false })
    textarea = h('textarea', { name: 'post-body', placeholder: 'Post body (optional). Supports markdown, emojis, and @-mentions.', rows: 6, onkeyup: onPostTextChange })
    suggestBox(titleInput, app.suggestOptions)
    suggestBox(textarea, app.suggestOptions)

    form = h('form.post-form', { onsubmit: post },
      h('.post-form-title', titleInput),
      h('.post-form-textarea', textarea),
      h('.preview-wrapper.panel.panel-default.hidden',
        h('.panel-heading', h('small', 'Preview:')),
        h('.panel-body', preview)
      ),
      h('p.post-form-btns', 
        postBtn,
        h('a.btn.btn-primary', { onclick: addFile }, 'Add file')
      ),
      h('.post-form-files',
        filesList,
        hiddenFilesInput
      )
    )
  }

  function disable () {
    postBtn.setAttribute('disabled', true)
  }

  function enable () {
    postBtn.removeAttribute('disabled')
  }

  // handlers

  function onPostTextChange (e) {
    var v = (parent) ? textarea.value : titleInput.value
    if (v.trim()) enable()
    else          disable()

    if (textarea.value.trim()) {
      preview.innerHTML = markdown.mentionLinks(markdown.block(textarea.value), namesList, true)
      preview.parentNode.parentNode.classList.remove('hidden')
    } else
      preview.parentNode.parentNode.classList.add('hidden')
  }

  function post (e) {
    e.preventDefault()

    var text = (!parent) ? titleInput.value : textarea.value
    if (!text.trim())
      return

    disable()
    uploadFiles(function (err, extLinks) {
      if (err)
        return enable(), swal('Error Uploading Attachments', err.message, 'error')
      app.setStatus('info', 'Publishing...')

      // prep text
      app.ssb.phoenix.getIdsByName(function (err, idsByName) {

        // collect any mentions and replace the nicknames with ids
        var mentions = []
        var mentionRegex = /(\s|>|^)@([^\s^<]+)/g;
        text = text.replace(mentionRegex, function(full, $1, $2) {
          var id = idsByName[$2] || $2
          if (schemas.isHash(id))
            mentions.push(id)
          return ($1||'') + '@' + id
        })

        // post
        var opts = null
        if (mentions.length)
          opts = { mentions: mentions }
        var post = (parent) ? schemas.schemas.replyPost(text, opts, parent) : schemas.schemas.post(text, opts)
        if (extLinks.length)
          post.attachments = extLinks
        app.ssb.add(post, function (err) {
          app.setStatus(null)
          enable()
          if (err) swal('Error While Publishing', err.message, 'error')
          else {
            if (parent)
              app.refreshPage()
            else
              window.location.hash = '#/'
          }
        })
      })
    })
  }

  function cancel (e) {
    e.preventDefault()
    if (parent)
      form.parentNode.removeChild(form)
    else
      window.location.hash = '#/'
  }

  function addFile (e) {
    e.preventDefault()
    hiddenFilesInput.click() // trigger file-selector
  }

  function removeFile (index) {
    return function (e) {
      e.preventDefault()
      e.stopPropagation()
      attachments.splice(index, 1)
      renderAttachments()
    }
  }

  function filesAdded (e) {
    var wasEmpty = !attachments.length
    for (var i=0; i < hiddenFilesInput.files.length; i++)
      attachments.push(hiddenFilesInput.files[i])
    if (wasEmpty)
      attachments[0].isMain = true
    renderAttachments()
  }

  function toggleMainFile (index) {
    return function (e) {
      e.preventDefault()
      attachments[index].isMain = !attachments[index].isMain
      for (var i = 0; i < attachments.length; i++) {
        if (i !== index)
          attachments[i].isMain = false
      }
      renderAttachments()
    }
  }

  function uploadFiles (cb) {
    var links = [], hasPostBody = (!parent && textarea.value)
    if (attachments.length === 0 && !hasPostBody)
      return cb(null, links)

    app.setStatus('info', 'Uploading ('+attachments.length+' files left)...')
    attachments.forEach(function (file) {
      var link = { rel: (file.isMain) ? 'main' : 'attachment', ext: null, name: file.name, size: file.size }
      links.push(link)
      addBlob(readFile(file), link)
    })
    if (hasPostBody) {
      var link = { rel: 'post-body', ext: null, name: 'post-body.md', size: util.stringByteLength(textarea.value) }
      links.push(link)
      addBlob(pull.values([textarea.value]), link)
    }

    function readFile (file) {
      var ps = pushable()
      var reader = new FileReader()
      reader.onload = function () {
        ps.push(new Buffer(new Uint8Array(reader.result)))
        ps.end()
      }
      reader.onerror = function (e) {
        console.error(e)
        ps.end(new Error('Failed to upload '+file.name))
      }
      reader.readAsArrayBuffer(file)
      return ps
    }

    function addBlob (source, link) {
      // hash and store
      var hasher = createHash()
      pull(
        source,
        hasher,
        pull.map(function (buf) { 
          if (typeof buf == 'string')
            return buf
          return new Buffer(new Uint8Array(buf)).toString('base64')
        }),
        app.ssb.blobs.add(function (err) {
          if(err) return next(err)
          link.ext  = hasher.digest
          link.size = link.size || hasher.size
          next()
        })
      )
    }

    var n
    function next (err) {
      n = n || 0
      if (n < 0) return
      if (err) {
        n = -1
        app.setStatus(null)
        return cb (err)
      }
      n++
      if (n === links.length) {
        app.setStatus(null)
        cb(null, links)
      } else
        app.setStatus('info', 'Uploading ('+(links.length-n)+' files left)...')
    }
  }

  function renderAttachments () {
    filesList.innerHTML = ''
    attachments.forEach(function (file, i) {
      filesList.appendChild(h('li' + (file.isMain ? '.main' : ''), { onclick: toggleMainFile(i) },
        h('a.btn.btn-primary', { href: 'javascript:void(0)', onclick: removeFile(i) }, com.icon('remove')),
        ' ', file.name, ' (', h('span.text-muted', util.bytesHuman(file.size)), ')',
        (file.isMain ? h('small.text-primary.pull-right', 'main') : '')
      ))
    })
  }

  return form
}