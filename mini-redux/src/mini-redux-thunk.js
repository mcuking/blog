const thunk = ({dispatch, getState}) => next => action => {
    // next为原生的dispatch
    // 如果action是函数，执行一下,参数是dispatch和getState
    if (typeof action === 'function') {
        return action(dispatch, getState)
    }
    // 默认直接用原生dispatch发出action
    return next(action)
}
export default thunk