> 文章首发于我的博客 https://github.com/mcuking/blog/issues/27

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-redux

上一讲实现了 react-redux，从而可以更加优雅地在 react 中使用 redux。

但是，一个关键问题没有解决：异步操作怎么办？Action 发出以后，Reducer 立即算出 State，这叫做同步；Action 发出以后，过一段时间再执行 Reducer，这就是异步。

怎么才能 Reducer 在异步操作结束后自动执行呢？这就要用到新的工具：中间件（middleware）。

## 中间件原理

为了理解中间件，让我们站在框架作者的角度思考问题：如果要添加功能，你会在哪个环节添加？

- Reducer：纯函数，只承担计算 State 的功能，不合适承担其他功能，也承担不了，因为理论上，纯函数不能进行读写操作。
- View：与 State 一一对应，可以看作 State 的视觉层，也不合适承担其他功能。
- Action：存放数据的对象，即消息的载体，只能被别人操作，自己不能进行任何操作。

只有发送 Action 的这个步骤，即 store.dispatch() 方法，可以添加功能。举例来说，要添加日志功能，把 Action 和 State 打印出来，可以对 store.dispatch 进行如下改造：

```js
let next = store.dispatch;
store.dispatch = function dispatchAndLog(action) {
  console.log('dispatching', action);
  next(action);
  console.log('next state', store.getState());
}
```

对 `store.dispatch``` 进行了重定义，在发送 Action 前后添加了打印功能。这就是中间件的雏形。
中间件就是一个函数，对 `store.dispatch``` 方法进行了改造，在发出 Action 和执行 Reducer 这两步之间，添加了其他功能。

## 中间件编写

在编写中间件之前，我们先看下在真正的 redux 里面是如何使用中间件的，当使用单个中间件时代码如下，其中 thunk 就是一个中间件：

```js
const store = createStore(counter, applyMiddleware(thunk))
```
有上面的代码可以看出，我们需要做三件事情

- 第一步  对 createStore 函数进行扩展，使其能够接收第二个参数 — 中间件

- 第二步  定义 applyMiddleware 函数，使其能够将一个中间件加入到 redux 中

- 第三步  实现一个中间件—redux-thunk

### 对 createStore 函数进行扩展

代码如下，检测是否有增强器，若存在则先用增强器对 createStore 进行扩展增强：

```js
export function createStore(reducer, enhancer) {
    // 如果存在增强器，则先用增强器对 createStore 进行扩展增强
    if (enhancer) {
        return enhancer(createStore)(reducer)
    }
    ...
}
```

### 定义 applyMiddleware 函数

根据上面的代码，我们可以知道，`applyMiddleware(中间件)` 返回的是一个高阶函数，接收参数 createStore 后，返回一个函数，然后再接收参数 reducer。
因此对应代码如下：
```js
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
        dispatch = middleware(midApi)(dispatch)

        return {
            ...store, // 原生 store
            dispatch, // 增强扩展后的 dispatch
        }
    }
}
```
在上述代码中，我们先是获得原生 store 以及原生 dispatch，组成 midApi，即中间件 API，然后将其传入中间件，执行中间件内定义的操作，返回一个函数，再传入原生 dispatch，再返回一个增强后的 dispatch，最后传入 action。增强后的 dispatch 如下：

```js
dispatch(action) = middleware(midApi)(store.dispatch)(action)
```

### 实现中间件 redux-thunk

异步操作至少要送出两个 Action：用户触发第一个 Action，这个跟同步操作一样，没有问题；如何才能在操作结束时，系统自动送出第二个 Action 呢？

奥妙就在 Action Creator 之中：

```js
// action creator
export function addGun() {
    return {type: ADD_GUN}
}

export function addGunAsync() {
    return dispatch => {
        setTimeout(() => {
            dispatch(addGun())
        }, 2000)
    }
}
```

上文中有两个需求，第一个需求是 `store.dispatch ``` 一个 action 对象（即 {type: ADD_GUN}）, 然后立即加机枪，即：

```js
addGun = () => store.dispatch(addGun())
addGun()
```

第二个需求是 `store.dispatch` 一个函数，这个函数内部执行异步操作，在 2000ms 之后再执行 `store.dispatch(addGun())`，加机枪，但是 `store.dispatch` 参数只能是 action 这样的对象，而不能是函数。`store.dispatch` 的有关源码如下：

```js
function dispatch(action) {
    // reducer 根据老的 state 和 action 计算新的 state
    currentState = reducer(currentState, action)
    // 当全局状态变化时，执行传入的监听函数
    currentListeners.forEach(v => v())
    return action
}
```

为了能够让让 store.dispatch 能够接收函数，我们可以使用 redux-thunk，改造 `store.dispatch`，使得后者可以接受函数作为参数。

因此，异步操作的一种解决方案就是，写出一个返回函数的 Action Creator，然后使用 redux-thunk 中间件改造 store.dispatch。

改造后的 dispatch 处理 addGunAsync 函数生成的 action（一个函数）：

```js
// action creator
export function buyHouse() {
    return {type: BUY_HOUSE}
}

function buyHouseAsync() {
    return dispatch => {
        setTimeout(() => {
            dispatch(buyHouse())
        }, 2000)
    }
}

dispatch(buyHouseAsync()) = middleware(midApi)(store.dispatch)(buyHouseAsync())
```

因此 redux-thunk 对应代码如下：

```js
const thunk = ({dispatch, getState}) => next => action => {
    // next 为原生的 dispatch
    // 如果 action 是函数，执行一下, 参数是 dispatch 和 getState
    if (typeof action === 'function') {
        return action(dispatch, getState)
    }
    // 默认直接用原生 dispatch 发出 action，什么都不做
    return next(action)
}
```

即判断 action 如果是一个函数，则执行这个函数。否则直接用原生 dispatch 发出 action，什么都不做。

这样我们就可以通过 redux-thunk 中间件，实现了增强版的 dispatch 可以接收函数作为参数，而我们在函数里面进行异步操作，异步操作完成后用原生 dispatch 发出 action，从而实现了 redux 的异步操作全局状态的功能。

## 相关文章

- [mini-redux 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/25)
- [mini-redux 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/26)
- [mini-redux 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/27)
- [mini-redux 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/29)
