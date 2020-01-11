import React from 'react'
import ReactDOM from 'react-dom'
import { createStore, applyMiddleware } from '../dist/mini-redux'
import { Provider } from '../dist/mini-react-redux'
import { counter } from './index.redux'
import thunk from '../dist/mini-redux-thunk'
import arrThunk from '../dist/mini-redux-arrThunk'
import App from './App'

const store = createStore(counter, applyMiddleware(thunk, arrThunk))

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('app')
)
