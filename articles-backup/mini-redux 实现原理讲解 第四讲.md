> 文章首发于我的博客 https://github.com/mcuking/blog/issues/29

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-redux

接着上一讲的中间件机制继续讲。
上一讲中我们实现了 redux-thunk 中间件，使得增强后的 dispatch 不仅能够接收对象类型的 action，还能够接收函数类型的 action。
在此我们是否能够在构造一个中间件，使得增强后的 dispatch 还能处理 action 组成的数组，如下：

```js
export function buyHouse() {
    return {
        type: BUY_House
    }
}

export function buyHouseAsync() {
    return dispatch => {
        setTimeout(() => {
            dispatch(buyHouse())
        }, 2000)
    }
}

export function buyTwice() {
    return [buyHouse(), buyHouseAsync()]
}
```

## 构造中间件 redux-arrThunk

为此我们决定再构造一个中间件，命名 redux-arrThunk，使增强后的 dispatch 还能处理 action 组成的数组。代码如下：

```js
const arrThunk = ({
    dispatch,
    getState
}) => next => action => {
    // next 为原生的 dispatch
    // 如果是数组，依次执行数组中每一个 action，参数是 dispatch 和 getState
    if (Array.isArray(action)) {
        return action.forEach(v => dispatch(v))
    }
    // 如果不满足条件，则直接调用下一个中间件（使用 next）
    // 如果满足条件，则需要重新 dispatch（调用 dispatch）
    // 默认直接用原生 dispatch 发出 action
    return next(action)
}
```

## 中间件叠加使用

因为原理类似第三讲中的 redux-thunk，上面的代码并不难，但问题是，我们如何将这两个中间件叠加起来使用，为此我们需要修改之前的 applyMiddleware 函数，使其能够接收多个中间件，并且是的这些中间件能够叠加使用。代码如下：

```js
// applyMiddleware
export function applyMiddleware(...middlewares) {
    return createStore => (...args) => {
        // 第一步 获得原生 store 以及原生 dispatch
        const store = createStore(...args)
        let dispatch = store.dispatch

        const midApi = {
            getState: store.getState,
            dispatch: (...args) => dispatch(...args)
        }
        // 第二步 将原生 dipatch 传入中间件进行扩展增强，生成新的 dispatch
        const middlewaresChain = middlewares.map(middleware => middleware(midApi))
        dispatch = compose(...middlewaresChain)(dispatch)
        // dispatch = middleware(midApi)(dispatch)
        return {
            ...store, // 原生 store
            dispatch, // 增强扩展后的 dispatch
        }
    }
}

// compose
//compose(fn1, fn2, fn3) return 为 fn1(fn2(fn3))
export function compose(...funcs) {
    if (funcs.length === 0) {
        return arg => arg
    }
    if (funcs.length === 1) {
        return funcs[0]
    }
    return funcs.reduce((ret, item) => (...args) => ret(item(...args)))
}
```

对比上一讲中的 applyMiddleware，这一次主要是在处理中间件时，对中间件进行了遍历，并且通过 compose 方法使得多个中间件可以叠加使用，即将 fn1, fn2, fn3 转换为 fn1(fn2(fn3))

```js
// 之前
dispatch = middleware(midApi)(dispatch)

// 之后
const middlewaresChain = middlewares.map(middleware => middleware(midApi))
dispatch = compose(...middlewaresChain)(dispatch)
```

因此可以像如下代码一样进行叠加使用多个中间件

``` javascript
import React from 'react'
import ReactDOM from 'react-dom'
import {
    createStore,
    applyMiddleware
} from './mini-redux'
import {
    Provider
} from './mini-react-redux'
import {
    counter
} from './index.redux'
import thunk from './mini-redux-thunk'
import arrThunk from './mini-redux-arrThunk'
import App from './App'

const store = createStore(counter, applyMiddleware(thunk, arrThunk))

ReactDOM.render(
    (
        <Provider store={store}>
            <App/>
        </Provider>
    ),
    document.getElementById('root')
)
```

其中 `const store = createStore(counter, applyMiddleware(thunk, arrThunk))` ，意味着增强后的 dispatch 具有如下功能

```js
dispatch(action) = thunk(arrThunk(midApi)(store.dispatch)(action))
```

至此，我们的 mini-redux 就开发完成咯，有任何问题或意见欢迎联系我。

## 相关文章

* [mini-redux 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/25)
* [mini-redux 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/26)
* [mini-redux 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/27)
* [mini-redux 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/29)
