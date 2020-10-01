> 文章首发于我的博客 https://github.com/mcuking/blog/issues/25

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-redux

首先我们不考虑 react-redux，先思考如何实现 redux 的功能。
redux 根据 reducer（根据旧全局 state 和 action 生成新的全局 state）生成全局状态树 store。即

```js
store = createStore(reducer)
```

下面我们就首先实现 createStore 机制，代码如下，其中：

- currentState 用来存储当前应用的全局状态

- currentListeners 数组用来存储当前的所有监听函数，每当 store 有变化，store 就会调用传入 subscribe 的监听函数

同时生成的 store 具有如下 API：

- getState 用来返回当前的 state

- subscribe 用来订阅监听，即将所有监听函数 push 到 currentListeners

- dipatch 用来派发 action，使得 reducer 可以根据 action 和旧的 state 生成新的 state，同时执行传入 currentListeners 的所有的监听函数

当第一次渲染时，需要生成一个初始化的 store，因此需要派发一个不存在的 action，action 的 type 命名尽量特殊，不与使用者的冲突，命名为 `@@redux/INIT1`。

```js
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
        // reducer 根据老的 state 和 action 计算新的 state
        currentState = reducer(currentState, action)
        // 当全局状态变化时，执行传入的监听函数
        currentListeners.forEach(v => v())
        return action
    }

    dispatch({type: '@@redux/INIT1'}) // 初始化全局状态
    return { getState, subscribe, dispatch }
}
```

这样我们最简版本的 redux 就已经实现了，下面是使用该最简版 redux 的应用代码：

```js
import React from 'react'
import ReactDOM from 'react-dom'
import { createStore } from './mini-redux'
import App from './App'

// 通过 reducer 建立 store（reducer 会根据老的 state 和 action，生成新的 state）
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
    // console.log(` 现有房子 ${current} 套 `)
}

// 监听，store 有变化，store 就会调用传入 subscribe 的函数
store.subscribe(listener)

// 派发事件， 传递 action
store.dispatch({type: '买一套房'})
store.dispatch({type: '卖一套房'})
store.dispatch({type: '买一套房'})
```

接下来我们将在此基础上，实现 react-redux 功能，以便在 react 中更优雅的使用 redux 进行全局状态管理。


相关文章如下：
- [mini-redux 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/25)
- [mini-redux 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/26)
- [mini-redux 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/27)
- [mini-redux 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/29)
