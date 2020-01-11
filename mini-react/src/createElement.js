// 负责生成vnode
export default function createElement(comp, props, ...args) {
  let children = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] instanceof Array) {
      children = children.concat(args[i])
    } else {
      children.push(args[i])
    }
  }
  return {
    nodeName: comp,
    props: props || {},
    children
  }
}
