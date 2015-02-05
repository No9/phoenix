var h = require('hyperscript')
var postForm = require('./post-form')

module.exports = function (app, toggleBtn, parent, opts) {
  var initBtnText = toggleBtn.textContent
  var form = postForm(app, parent, opts)
  var formContainer = h('.post-form-container', form)
  formContainer.classList.add('collapsed')
  toggleBtn.onclick = function (e) {
    e.preventDefault()
    formContainer.classList.toggle('collapsed')
    toggleBtn.classList.toggle('btn-strong')
    if (formContainer.classList.contains('collapsed'))
      toggleBtn.textContent = initBtnText
    else
      toggleBtn.textContent = 'Cancel'
  }
  return h('.post-form-expandable', formContainer)
}