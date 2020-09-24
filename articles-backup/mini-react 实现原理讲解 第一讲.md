> 文章首发于我的博客 https://github.com/mcuking/blog/issues/20

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

# 支持JSX
可以通过 [babel](http://babeljs.io/) 实现将JSX转化为原生js，例如
```javascript
const hw = <div>Hello World</div>

const hw = React.createElement('div', null, "Hello World")
```
以上两行是等效的，所以本项目无需关心JSX语法

# virtual-dom
react中virtual-dom的概念，即使用一个js对象——vnode来描述DOM节点，然后根据vnode进行实际操作DOM节点，从而渲染出DOM树。
其中，vnode对象有3个属性：

- nodeName： 可能是某个字符串，或html标签，抑或是某个函数
- props
- children

以下就是如何通过createElement函数，从JSX转化后的代码中生成我们所要的vnode
```javascript
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
```

# 从virtual-dom到实际渲染
以下是我们使用react写的一个组件
```javascript
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
最终会渲染为i am a cat
渲染过程是：渲染Animal的Vnode -> 渲染Pet的Vnode -> 渲染Cat的Vnode
这是一个递归的过程：递归的终止条件是——渲染html标签：

- 当nodeName为html标签时，直接操作dom
- 当nodeName为组件时，通过 递归 操作组件执行render方法返回的vnode

代码如下：
```javascript
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
```

总结一下：

1. createElement —— 负责创建 vnode
2. render —— 是根据生成的vnode， 渲染到实际的dom的一个递归方法

  - 当vnode是字符串时， 创建textNode节点
  - 当vnode.nodeName是字符串的时， 创建dom节点， 根据props设置节点属性， 遍历render children
  - 当vnode.nodeName是函数的时， 获取render方法的返回值vnode， 执行render(vnode)

相关文章
- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
