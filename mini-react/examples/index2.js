import React from '../dist/mini-react'

const style = {
  item: {
    width: '30px',
    color: 'red',
    fontSize: '12px',
    fontWeight: 600,
    height: '20px',
    textAlign: 'center',
    margin: '5px',
    padding: '5px',
    border: '1px solid red',
    position: 'relative',
    left: '10px',
    top: '10px'
  }
}

class AppWithNoVDOM extends React.Component {
  constructor() {
    super()
  }

  test() {
    let result = []
    for (let i = 0; i < 10000; i++) {
      result.push(
        <div style={style.item} title={i}>
          {i}
        </div>
      )
    }
    return result
  }

  render() {
    return (
      <div width={100}>
        <a
          onClick={e => {
            this.setState({})
            console.log('lalal')
          }}
        >
          click me
        </a>
        {this.test()}
      </div>
    )
  }
}

React.render(<AppWithNoVDOM />, document.getElementById('app'))
