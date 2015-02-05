var h = require('hyperscript')
var postForm = require('./post-form')

module.exports = function (app, toggleBtn, parent, opts) {
  var initBtnText = toggleBtn.textContent
  var form = postForm(app, parent, opts)
  var formContainer = h('.post-form-container', form)

  if (localStorage.postFormExpanded != 1)
    formContainer.classList.add('collapsed')
  update()

  toggleBtn.onclick = function (e) {
    e && e.preventDefault()
    formContainer.classList.toggle('collapsed')
    update()
  }
  
  function update () {
    if (formContainer.classList.contains('collapsed')) {
      toggleBtn.textContent = initBtnText
      toggleBtn.classList.add('btn-strong')
      localStorage.postFormExpanded = 0
      localStorage.postFormDraft = form.querySelector('textarea').value = ''
    }
    else {
      toggleBtn.textContent = 'Cancel'
      toggleBtn.classList.remove('btn-strong')
      form.querySelector('textarea').focus()
      localStorage.postFormExpanded = 1
    }
  }
  return h('.post-form-expandable', formContainer)
}