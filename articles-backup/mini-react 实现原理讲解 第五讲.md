> 文章首发于我的博客 https://github.com/mcuking/blog/issues/24

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

# 复用子节点
之前操作子节点的代码：
```javascript
for(let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], dom, null, null)
}
```
render 的第3个参数comp '谁渲染了我'， 第4个参数olddom '之前的旧dom元素'。现在复用旧的dom， 所以第4个参数可能是有值的 代码如下：
```javascript
let olddomChild = olddom.firstChild
for(let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], olddom, null, olddomChild)
    olddomChild = olddomChild && olddomChild.nextSibling
}

//删除多余的子节点
while (olddomChild) {
    let next = olddomChild.nextSibling
    olddom.removeChild(olddomChild)
    olddomChild = next
}

```
所以完整的diff机制如下（包括复用属性 / 复用子节点）：
```javascript
function diffDOM(vnode, parent, comp, olddom) {
    const {onlyInLeft, bothIn, onlyInRight} = diffObject(vnode.props, olddom.__vnode.props)
    setAttrs(olddom, onlyInLeft)
    removeAttrs(olddom, onlyInRight)
    diffAttrs(olddom, bothIn.left, bothIn.right)


    let olddomChild = olddom.firstChild
    for(let i = 0; i < vnode.children.length; i++) {
        render(vnode.children[i], olddom, null, olddomChild)
        olddomChild = olddomChild && olddomChild.nextSibling
    }

    while (olddomChild) { //删除多余的子节点
        let next = olddomChild.nextSibling
        olddom.removeChild(olddomChild)
        olddomChild = next
    }
    olddom.__vnode = vnode  
}
```
由于需要在diffDOM的时候从olddom获取 olddom._vnode（即 diffObject(vnode.props, olddom.__vnode.props)）。 所以：

```javascript
// 在创建的时候
...
let dom = document.createElement(vnode.nodeName)
dom.__vnode = vnode
...


// diffDOM
...
const {onlyInLeft, bothIn, onlyInRight} = diffObject(vnode.props, olddom.__vnode.props)
...
olddom.__vnode = vnode  // 更新完之后， 需要把__vnode的指向 更新
...
```

另外对于TextNode的复用:

```javascript
...
if(typeof vnode == "string" || typeof vnode == "number") {
        if(olddom && olddom.splitText) {
            if(olddom.nodeValue !== vnode) {
                olddom.nodeValue = vnode
            }
        } else {
            dom = document.createTextNode(vnode)
            if(olddom) {
                parent.replaceChild(dom, olddom)
            } else {
                parent.appendChild(dom)
            }
        }
    }
...
```

# 复用子节点升级版-key
```javascript
初始渲染
...
render() {
    return (
        <div>
            <WeightCompA/>
            <WeightCompB/>
            <WeightCompC/>
        </div>
    )
}
...

setState再次渲染
...
render() {
    return (
        <div>
            <span>hi</span>
            <WeightCompA/>
            <WeightCompB/>
            <WeightCompC/>
        </div>
    )
}
...
```

我们之前的子节点复用顺序就是按照DOM顺序，显然这里如果这样处理的话，可能导致组件都复用不了。 针对这个问题，React是通过给每一个子组件提供一个key属性来解决的。对于拥有同样key的节点，认为结构相同。所以问题变成了：

```javascript
f([{key: 'wca'}, {key: 'wcb'}, {key: 'wcc'}]) = [{key:'spanhi'}, {key: 'wca'}, {key: 'wcb'}, {key: 'wcc'}]
```
函数f通过删除，插入操作，把olddom的children顺序，改为和newProps里面的children一样（按照key值一样）。

由于通过key复用子节点实现略复杂，暂时搁置。


相关文章
- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
