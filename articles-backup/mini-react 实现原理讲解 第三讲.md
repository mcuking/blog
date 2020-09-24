> 文章首发于我的博客 https://github.com/mcuking/blog/issues/22

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

上一讲中state发生变化时，将会重新渲染，使用新生成的dom替换老的dom。但是当dom树很大时，而每次更改的地方很小时，可能只是修改某个节点的属性，这种粗暴的替换方式就显得很浪费性能。

因此react提出了diff算法：vnode(纯js对象) 代表dom， 在渲染之前，先比较出oldvnode和newvode的区别。然后增量的更新dom。

如何增量更新呢？

# 复用DOM
在第一讲中，render函数里对于每一个判定为 dom类型的VDOM，都是直接创建一个新的DOM：
```javascript
...
else if(typeof vnode.nodeName == "string") {
    dom = document.createElement(vnode.nodeName)
    ...
} 
...
```

一定要创建一个 新的DOM 结构吗？

考虑如下情况：
如一个组件， 初次渲染为 renderBefore， 调用setState再次渲染为 renderAfter 调用setState再再次渲染为 renderAfterAfter。 VNODE如下：
```javascript
const renderBefore = {
    tagName: 'div',
    props: {
        width: '20px',
        className: 'xx'
    },
    children:[vnode1, vnode2, vnode3]
}
const renderAfter = {
    tagName: 'div',
    props: {
        width: '30px',
        title: 'yy'
    },
    children:[vnode1, vnode2]
}
const renderAfterAfter = {
    tagName: 'span',
    props: {
        className: 'xx'
    },
    children:[vnode1, vnode2, vnode3]
}
```
renderBefore和renderAfter 都是div，只不过props和children有部分区别，那我们是不是可以通过修改DOM属性，修改DOM子节点，把rederBefore变化为renderAfter呢？

而renderAfter和renderAfterAfter属于不同的DOM类型， 浏览器还没提供修改DOM类型的Api，是无法复用的，因此一定要创建新的DOM的。

所以diff机制如下：

- 不同元素类型无法复用
- 相同元素：
   - 更新属性
   - 复用子节点

因此代码大致如下：
```javascript
...
else if(typeof vnode.nodeName == "string") {
    if(!olddom || olddom.nodeName != vnode.nodeName.toUpperCase()) {
        createNewDom(vnode, parent, comp, olddom)
    } else {
        diffDOM(vnode, parent, comp, olddom) // 包括 更新属性， 子节点复用
    }
}
...
```
在后面的两讲中我将分别介绍更新属性以及复用子节点这两种机制


相关文章
- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
