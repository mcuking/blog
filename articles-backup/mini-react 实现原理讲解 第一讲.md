> 文章首发于我的博客 https://github.com/mcuking/blog/issues/20

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

## 支持 JSX

可以通过 [babel](http://babeljs.io/) 实现将 JSX 转化为原生 js，例如：

```js
const hw = <div>Hello World</div>

const hw = React.createElement('div', null, "Hello World")
```
以上两行是等效的，所以本项目无需关心 JSX 语法

## virtual-dom

react 中 virtual-dom 的概念，即使用一个 js 对象——vnode 来描述 DOM 节点，然后根据 vnode 进行实际操作 DOM 节点，从而渲染出 DOM 树。
其中，vnode 对象有 3 个属性：

- nodeName： 可能是某个字符串，或 html 标签，抑或是某个函数
- props
- children

以下就是如何通过 createElement 函数，从 JSX 转化后的代码中生成我们所要的 vnode：

```js
// 负责生成 vnode
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
```

## 从 virtual-dom 到实际渲染
以下是我们使用 react 写的一个组件
```js
class Animal extends Component {
    render() {
        return (
            <Pet/>
        )
    }
}

class Pet extends Component {
    render() {
        return (
            <Cat/>
        )
    }
}

class Cat extends Component {
    render() {
        return (
            <div>i am a cat</div>
        )
    }
}
render(<Animal/>, document.getElementById('container'))
```
最终会渲染为 i am a cat
渲染过程是：渲染 Animal 的 Vnode -> 渲染 Pet 的 Vnode -> 渲染 Cat 的 Vnode
这是一个递归的过程：递归的终止条件是——渲染 html 标签：

- 当 nodeName 为 html 标签时，直接操作 dom
- 当 nodeName 为组件时，通过 递归 操作组件执行 render 方法返回的 vnode

代码如下：
```js
function render(vnode, parent) {
    let dom
    if(typeof vnode == "string") {
        dom = document.createTextNode(vnode)
        parent.appendChild(dom)
    } else if(typeof vnode.nodeName == "string") {
        dom = document.createElement(vnode.nodeName)
        setAttrs(dom, vnode.props)
        parent.appendChild(dom)

        for(let i = 0; i < vnode.children.length; i++) {
            render(vnode.children[i], dom)
        }
    } else if (typeof vnode.nodeName == "function") {
        let func = vnode.nodeName

        let inst = new func(vnode.props)
        let innerVnode = inst.render()
        render(innerVnode, parent)
    }
}

// 设置 DOM 节点属性
function setAttrs(dom, props) {
    for (let k in props) {
        // 属性为 className 时，改为 class
        if (k === 'className') {
            dom.setAttribute('class', props[k])
            continue
        }

        // 属性为 style 时
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

        // 属性为 on 开头的绑定的事件
        if (k[0] === 'o' && k[1] === 'n') {
            dom.addEventListener(k.substring(2).toLowerCase(), props[k], false)
            continue
        }


        // 其余属性直接赋值
        dom.setAttribute(k, props[k])
    }
}
```

总结一下：

1. createElement —— 负责创建 vnode
2. render —— 是根据生成的 vnode， 渲染到实际的 dom 的一个递归方法

  - 当 vnode 是字符串时， 创建 textNode 节点
  - 当 vnode.nodeName 是字符串的时， 创建 dom 节点， 根据 props 设置节点属性， 遍历 render children
  - 当 vnode.nodeName 是函数的时， 获取 render 方法的返回值 vnode， 执行 render(vnode)

相关文章
- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
