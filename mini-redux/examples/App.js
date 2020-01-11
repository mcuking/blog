import React, { Component } from 'react'
import { connect } from '../dist/mini-react-redux'
import { addGun, removeGun, addGunAsync, addTwice } from './index.redux'

class App extends Component {
  render() {
    return (
      <div>
        <h1>
          现有房子
          {this.props.num}套
        </h1>
        <button onClick={this.props.addGun}>再买一套</button>
        <button onClick={this.props.removeGun}>卖一套</button>
        <button onClick={this.props.addGunAsync}>过几天再买一套</button>
        <button onClick={this.props.addTwice}>再买两套</button>
      </div>
    )
  }
}

const mapStateToProps = state => {
  return {
    num: state
  }
}

const mapDispatchToProps = {
  addGun,
  removeGun,
  addGunAsync,
  addTwice
}

App = connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
export default App
