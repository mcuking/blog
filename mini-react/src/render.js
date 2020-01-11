export default function render(vnode, parent, comp, olddom) {
  let dom
  // 渲染字符串或数字
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    // 如果存在字符串或数字，且和vnode不同，则替换为vnode
    if (olddom && olddom.splitText) {
      if (olddom.nodeValue !== vnode) {
        olddom.nodeValue = vnode
      }
    } else {
      dom = document.createTextNode(vnode)
      // 维持一个——rendered的引用链
      if (comp) {
        comp.__rendered = dom
      }

      if (olddom) {
        parent.replaceChild(dom, olddom)
      } else {
        parent.appendChild(dom)
      }
    }
  }

  // 渲染html标签
  if (typeof vnode.nodeName === 'string') {
    // 若不存在旧DOM节点，或者VDOM节点与旧的不同，则创建新的DOM节点，否则利用diff算法进行更新
    if (!olddom || olddom.nodeName !== vnode.nodeName.toUpperCase()) {
      createNewDom(vnode, parent, comp, olddom)
    } else {
      // 包括了更新属性，子节点复用等方法
      diffDOM(vnode, parent, comp, olddom)
    }
  }

  // 渲染自定义组件
  if (typeof vnode.nodeName === 'function') {
    const func = vnode.nodeName
    // 获取类对应的实例
    const inst = new func(vnode.props)

    // 维持一个——rendered的引用链
    if (comp) {
      comp.__rendered = inst
    }

    const innerVnode = inst.render()
    render(innerVnode, parent, inst, olddom)
  }
}

// 创建新DOM节点
function createNewDom(vnode, parent, comp, olddom) {
  const dom = document.createElement(vnode.nodeName)

  dom.__vnode = vnode

  // 维持一个——rendered的引用链
  if (comp) {
    comp.__rendered = dom
  }
  setAttrs(dom, vnode.props)

  if (olddom) {
    parent.replaceChild(dom, olddom)
  } else {
    parent.appendChild(dom)
  }

  for (let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], dom, null, null)
  }
}

function diffDOM(vnode, parent, comp, olddom) {
  // 更新属性
  const { onlyInLeft, onlyInRight, bothIn } = diffObject(
    vnode.props,
    olddom.__vnode.props
  )
  setAttrs(olddom, onlyInLeft)
  removeAttrs(olddom, onlyInRight)
  diffAttrs(olddom, bothIn.left, bothIn.right)

  // 复用子节点
  let olddomChild = olddom.firstChild
  for (let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], olddom, null, olddomChild)
    olddomChild = olddomChild && olddomChild.nextSibling
  }

  // 删除多余子节点
  while (olddomChild) {
    let next = olddomChild.nextSibling
    olddom.removeChild(olddomChild)
    olddomChild = next
  }
  // 由于需要在diffDOM的时候从olddom获取oldVNODE， 所以更新完之后， 需要把___vnode的指向更新
  olddom.__vnode = vnode
}

// 比较VNode与旧DOM节点的属性的 交集  差集
function diffObject(leftProps, rightProps) {
  const onlyInLeft = {} // 只存在于新DOM节点属性的集合
  const onlyInRight = {} // 只存在于旧DOM节点属性的集合
  const bothLeft = {} // 共同存在的属性中新DOM节点属性的集合
  const bothRight = {} // 共同存在的属性中旧DOM节点属性的集合

  for (let key in leftProps) {
    if (rightProps[key] === undefined) {
      onlyInLeft[key] = leftProps[key]
    } else {
      bothLeft[key] = leftProps[key]
      bothRight[key] = rightProps[key]
    }
  }

  for (let key in rightProps) {
    if (leftProps[key] === undefined) {
      onlyInRight[key] = rightProps[key]
    }
  }

  return {
    onlyInLeft,
    onlyInRight,
    bothIn: {
      left: bothLeft,
      right: bothRight
    }
  }
}

// 设置DOM节点属性
function setAttrs(dom, props) {
  for (let k in props) {
    // 属性为className时，改为class
    if (k === 'className') {
      dom.setAttribute('class', props[k])
      continue
    }

    // 属性为style时
    if (k === 'style') {
      if (typeof props[k] === 'string') {
        dom.style.cssText = props[k]
      }

      if (typeof props[k] === 'object') {
        for (let v in props[k]) {
          dom.style[v] = props[k][v]
        }
      }
      continue
    }

    // 属性为on开头的绑定的事件
    if (k[0] === 'o' && k[1] === 'n') {
      dom.addEventListener(k.substring(2).toLowerCase(), props[k], false)
      continue
    }

    // 其余属性直接赋值
    dom.setAttribute(k, props[k])
  }
}

// 去除DOM节点属性
function removeAttrs(dom, props) {
  for (let k in props) {
    if (k === 'className') {
      dom.removeAttribute('class', props[k])
      continue
    }

    if (k === 'style') {
      dom.style.cssText = ''
      continue
    }

    if (k[0] === 'o' && k[1] === 'n') {
      dom.removeEventListener(k.substring(2).toLowerCase(), props[k], false)
      continue
    }

    // 其余属性直接去除
    dom.removeAttribute(k, props[k])
  }
}

// 修改DOM节点属性
function diffAttrs(dom, newProps, oldProps) {
  for (let k in newProps) {
    if (newProps[k] === oldProps[k]) continue

    if (k === 'className') {
      dom.setAttribute('class', newProps[k])
      continue
    }

    if (k === 'style') {
      if (typeof newProps[k] === 'string') {
        dom.style.cssText = newProps[k]
      }

      if (typeof newProps[k] === 'object' && typeof oldProps[k] === 'object') {
        for (let v in newProps[k]) {
          // 若新属性的css属性与旧属性的css属性不同，则css属性赋值为新属性的css属性
          if (newProps[k][v] !== oldProps[k][v]) {
            dom.style[v] = newProps[k][v]
          }
        }

        // 若旧属性的css属性中某个属性，在新属性的css属性中不存在，则将该css属性设置为空
        for (let v in oldProps[k]) {
          if (newProps[k][v] === undefined) {
            dom.style[v] = ''
          }
        }
      }
      continue
    }

    if (k[0] === 'o' && k[1] === 'n') {
      dom.removeEventListener(k.substring(2).toLowerCase(), oldProps[k], false)
      dom.addEventListener(k.substring(2).toLowerCase(), newProps[k], false)
      continue
    }

    // 其余属性直接赋值
    dom.setAttribute(k, newProps[k])
  }
}
