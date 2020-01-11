const arrThunk = ({dispatch, getState}) => next => action => {
    // next为原生的dispatch
    // 如果是数组，依次执行数组中每一个action，参数是dispatch和getState
    if (Array.isArray(action)) {
        return action.forEach(v=>dispatch(v))
    }
    // 如果不满足条件，则直接调用下一个中间件（使用next）
    // 如果满足条件，则需要重新dispatch（调用dispatch）
    // 默认直接用原生dispatch发出action
    return next(action)
}
export default arrThunk