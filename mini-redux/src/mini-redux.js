// redux

// createStore
export function createStore(reducer, enhancer) {
    // 如果存在增强器，则先用增强器对createStore进行扩展增强
    if (enhancer) {
        return enhancer(createStore)(reducer)
    }
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



// bindActionCreators
// 将 addGun(参数) 转换为 () => dispatch(addGun(参数))
function bindActionCreator(creator, dispatch) {
    return (...arg) => dispatch(creator(...arg)) // 参数arg透传
}

// creators 示例 {addGun, removeGun, addGunAsync}
export function bindActionCreators(creators, dispatch) {
    let bound = {}
    for (let v in creators) {
        bound[v] = bindActionCreator(creators[v], dispatch)
    }
    return bound
}



// applyMiddleware
export function applyMiddleware(...middlewares) {
    return createStore => (...args) => {
        // 第一步 获得原生store以及原生dispatch
        const store = createStore(...args)
        let dispatch = store.dispatch
        
        const midApi = {
            getState: store.getState,
            dispatch: (...args) => dispatch(...args)
        }
        // 第二步 将原生dipatch传入中间件进行扩展增强，生成新的dispatch
        const middlewaresChain = middlewares.map(middleware => middleware(midApi))
        dispatch = compose(...middlewaresChain)(dispatch)
        // dispatch = middleware(midApi)(dispatch)
        return {
            ...store, // 原生store
            dispatch, // 增强扩展后的dispatch
        }
    }
}



// compose
//compose(fn1, fn2, fn3) return为 fn1(fn2(fn3))
export function compose(...funcs) {
    if (funcs.length === 0) {
        return arg => arg
    }
    if (funcs.length === 1) {
        return funcs[0]
    }
    return funcs.reduce((ret, item) => (...args) => ret(item(...args)))
}