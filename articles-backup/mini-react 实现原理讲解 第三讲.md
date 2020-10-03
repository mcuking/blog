> 文章首发于我的博客 https://github.com/mcuking/blog/issues/22

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

上一讲中 state 发生变化时，将会重新渲染，使用新生成的 dom 替换老的 dom。但是当 dom 树很大时，而每次更改的地方很小时，可能只是修改某个节点的属性，这种粗暴的替换方式就显得很浪费性能。

因此 react 提出了 diff 算法：vnode(纯 js 对象) 代表 dom， 在渲染之前，先比较出 oldvnode 和 newvode 的区别。然后增量的更新 dom。

如何增量更新呢？

## 复用 DOM

在第一讲中，render 函数里对于每一个判定为 dom 类型的 VDOM，都是直接创建一个新的 DOM：

```js
...
else if(typeof vnode.nodeName == "string") {
    dom = document.createElement(vnode.nodeName)
    ...
}
...
```

一定要创建一个 新的 DOM 结构吗？

考虑如下情况：
如一个组件， 初次渲染为 renderBefore， 调用 setState 再次渲染为 renderAfter 调用 setState 再再次渲染为 renderAfterAfter。 VNODE 如下：

```js
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

renderBefore 和 renderAfter 都是 div，只不过 props 和 children 有部分区别，那我们是不是可以通过修改 DOM 属性，修改 DOM 子节点，把 rederBefore 变化为 renderAfter 呢？

而 renderAfter 和 renderAfterAfter 属于不同的 DOM 类型， 浏览器还没提供修改 DOM 类型的 Api，是无法复用的，因此一定要创建新的 DOM 的。

所以 diff 机制如下：

- 不同元素类型无法复用
- 相同元素：
   - 更新属性
   - 复用子节点

因此代码大致如下：

```js
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

在后面的两讲中我将分别介绍更新属性以及复用子节点这两种机制。

## 相关文章

- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
