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
      h('.post-form-files',
        filesList,
        hiddenFilesInput
      ),
      h('p.post-form-btns', 
        postBtn,
        h('button.btn.btn-primary', { onclick: cancel }, 'Cancel'),
        ' | ',
        h('a.btn.btn-primary', { onclick: addFile }, 'Add file')
      ),
      h('.preview-wrapper.panel.panel-default.hidden',
        h('.panel-heading', h('small', 'Preview:')),
        h('.panel-body', preview)
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
    var v, hasPreview = false
    if (parent) {
      preview.innerHTML = markdown.mentionLinks(markdown.block(textarea.value), namesList, true)
      hasPreview = !!textarea.value
      v = textarea.value
    } else {
      preview.innerHTML = markdown.mentionLinks('<h2>'+markdown.emojis(titleInput.value)+'</h2>'+markdown.block(textarea.value), namesList, true)
      hasPreview = !!titleInput.value || !!textarea.value
      v = titleInput.value
    }
    if (hasPreview) preview.parentNode.parentNode.classList.remove('hidden')
    else            preview.parentNode.parentNode.classList.add('hidden')
    if (v.trim()) enable()
    else          disable()
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
    var links = []
    if (attachments.length === 0)
      return cb(null, links)

    app.setStatus('info', 'Uploading ('+attachments.length+' files left)...')
    attachments.forEach(function (file) {
      var link = { rel: (file.isMain) ? 'main' : 'attachment', ext: null, name: null, size: null }
      links.push(link)

      // read file
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

      // hash and store
      var hasher = createHash()
      pull(
        ps,
        hasher,
        pull.map(function (buf) { return new Buffer(new Uint8Array(buf)).toString('base64') }),
        app.ssb.blobs.add(function (err) {
          if(err) return next(err)
          link.name = file.name
          link.ext  = hasher.digest
          link.size = file.size || hasher.size
          next()
        })
      )
    })

    var n = 0
    function next (err) {
      if (n < 0) return
      if (err) {
        n = -1
        app.setStatus(null)
        return cb (err)
      }
      n++
      if (n === attachments.length) {
        app.setStatus(null)
        cb(null, links)
      } else
        app.setStatus('info', 'Uploading ('+(attachments.length-n)+' files left)...')
    }
  }

  function renderAttachments () {
    filesList.innerHTML = ''
    attachments.forEach(function (file, i) {
      var mainLink = h('a', { onclick: toggleMainFile(i), href: 'javascript:void(0)', title: 'Set as main file' }, com.icon((file.isMain ? 'ok-sign' : 'ok-circle')))
      filesList.appendChild(h('li' + (file.isMain ? '.main' : ''), 
        mainLink, ' ', file.name, ' ', 
        h('a', { href: 'javascript:void(0)', onclick: removeFile(i) }, 'remove'),
        (file.isMain) ? h('span.pull-right', 'main link') : ''
      ))
    })
  }

  return form
}