import React from '../dist/mini-react'

class Cat extends React.Component {
  render() {
    return (
      // React.createElement(
      //     'div',
      //     { style: { 'color': this.props.color, cursor: 'pointer', 'user-select': 'none' } },
      //     'i am a ',
      //     this.props.color,
      //     ' cat, click me to change color'
      // )
      <div style={{ color: this.props.color, cursor: 'pointer', 'user-select': 'none' }}>
        i am a {this.props.color} cat, click me to change color
      </div>
    )
  }
}

const colorArray = ['red', 'blue', 'black', 'grey', 'green']

class Animal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      color: 'green'
    }
  }

  handleClick = () => {
    this.setState({
      color: colorArray[parseInt(Math.random() * 5)]
    })
  }

  render() {
    return (
      // React.createElement(
      //     'div',
      //     { onClick: this.handleClick },
      //     React.createElement(Cat, { color: this.state.color })
      // )
      <div onClick={this.handleClick}>
        <Cat color={this.state.color} />
      </div>
    )
  }
}

React.render(<Animal />, document.getElementById('app'))
