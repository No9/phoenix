var document = require('global/document')
var window = require('global/window')
var mercury = require('mercury')

var models = require('./lib/models')
var bus = require('./lib/business')
var createEvents = require('./home/events')
var render = require('./home/render')
var handlers = require('./home/handlers')

// init app
var state = createApp()
mercury.app(document.body, state, render)
handlers.setRoute(state, window.location.hash)

// put some things on the window object for debugging
window.state = state
window.models = models

module.exports = createApp
function createApp() {
  var initState = {
    publishFormMap: { feed: 0 },
    publishForms: [{
      id: 'feed',
      type: 'text',
      textPlaceholder: 'Publish...',
      permanent: true
    }]
  }

  var events = createEvents()
  var state = models.homeApp(events, initState)
  bus.setupHomeApp(state)
  wireUpEvents(state, events)
  return state
}

function wireUpEvents(state, events) {
  for (var k in handlers) {
    events[k](handlers[k].bind(null, state))
  }
}