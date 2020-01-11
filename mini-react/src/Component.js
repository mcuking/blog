import render from './render'

export default class Component {
  constructor(props) {
    this.props = props
  }

  setState(state) {
    setTimeout(() => {
      this.state = state
      const vnode = this.render() // 当state改变时，重新调用组件的render方法
      const olddom = getDOM(this)
      const startTime = new Date().getTime()
      render(vnode, olddom.parentNode, this, olddom)
      const endTime = new Date().getTime()
      console.log('duration:', endTime - startTime)
    }, 0)
  }
}

// 找到当前组件实例渲染的的实际的DOM节点
function getDOM(comp) {
  let rendered = comp.__rendered
  // 通过__render链向下找到第一个非组件的dom节点
  while (rendered instanceof Component) {
    rendered = rendered.__rendered
  }
  return rendered
}
