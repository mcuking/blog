> 文章首发于我的博客 https://github.com/mcuking/blog/issues/25

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-redux

首先我们不考虑react-redux，先思考如何实现redux的功能。
redux根据reducer（根据旧全局state和action生成新的全局state）生成全局状态树store。即
```javascript
store = createStore(reducer)
```
下面我们就首先实现createStore机制，代码如下，其中：

- currentState用来存储当前应用的全局状态

- currentListeners数组用来存储当前的所有监听函数，每当store有变化，store就会调用传入subscribe的监听函数

同时生成的store具有如下API：

- getState用来返回当前的state

- subscribe用来订阅监听，即将所有监听函数push到currentListeners

- dipatch用来派发action，使得reducer可以根据action和旧的state生成新的state，同时执行传入currentListeners的所有的监听函数

当第一次渲染时，需要生成一个初始化的store，因此需要派发一个不存在的action，action的type命名尽量特殊，不与使用者的冲突，命名为```@@redux/INIT1```。

```javascript
export function createStore(reducer) {
    let currentState = {}
    let currentListeners = []

    function getState() {
        return currentState
    }

    // 传入监听函数
    function subscribe(listener) {
        currentListeners.push(listener)
    }

    function dispatch(action) {
        // reducer根据老的state和action计算新的state
        currentState = reducer(currentState, action)
        // 当全局状态变化时，执行传入的监听函数
        currentListeners.forEach(v => v())
        return action
    }

    dispatch({type: '@@redux/INIT1'}) // 初始化全局状态
    return { getState, subscribe, dispatch }
}
```

这样我们最简版本的redux就已经实现了，下面是使用该最简版redux的应用代码
```javascript
import React from 'react'
import ReactDOM from 'react-dom'
import { createStore } from './mini-redux'
import App from './App'

// 通过reducer建立store（reducer会根据老的state和action，生成新的state）
function counter(state=0, action) {
    switch(action.type) {
        case '买一套房':
            return state + 1
        case '卖一套房':
            return state - 1
        default:
            return 10
    }
}

const store = createStore(counter)
// console.log(store, 'store')
const init = store.getState()


function listener() {
    const current = store.getState()
    // console.log(`现有房子${current}套`)
}

// 监听，store有变化，store就会调用传入subscribe的函数
store.subscribe(listener)

// 派发事件， 传递action
store.dispatch({type: '买一套房'})
store.dispatch({type: '卖一套房'})
store.dispatch({type: '买一套房'})
```

接下来我们将在此基础上，实现react-redux功能，以便在react中更优雅的使用redux进行全局状态管理。


相关文章如下：
- [mini-redux 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/25)
- [mini-redux 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/26)
- [mini-redux 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/27)
- [mini-redux 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/29)
