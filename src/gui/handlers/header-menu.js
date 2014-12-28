var memo = require('../../lib/memo')

exports.toggle = function(state, el, e) {
  var headerMenu = document.getElementById('header-menu')
  headerMenu.classList.toggle('open')
}

exports.setRenderMode = function(state, el, e) {
  state.page.renderMode = el.dataset.mode
  memo.clear('msg:') // need to rerender all msgs
  memo.clear('thread:')
  state.sync()
}

exports.setFeedMode = function(state, el, e) {
  state.page.feedMode = el.dataset.mode
  state.sync()
}