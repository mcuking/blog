// react-redux

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { bindActionCreators } from './mini-redux'

// connect 负责连接组件，将redux中的数据传入组件的属性里
// 1. 负责接收一个组件，并将组件state里的一些数据放进去，返回一个新组件
// 2. 数据变化时，能够通知组件
export const connect = (mapStateToProps=state=>state, mapDispatchToProps={}) => (WrapComponent) => {
    // 高阶函数，连续两个箭头函数意味着嵌套两层函数
    return class ConnectComponent extends Component {
        // 使用context需要使用propType进行校验
        static contextTypes = {
            store: PropTypes.object
        }

        constructor(props, context) {
            super(props, context)
            this.state = {
                props: {}
            }
        }

        componentDidMount() {
            const { store } = this.context
            store.subscribe(() => this.update()) // 每当全局store更新，均需要更新传入组件的状态和方法
            this.update()
        }

        // 获取mapStateToProps的返回值 和 mapDispatchToProps，放入到this.state.props
        update() {
            const { store } = this.context // 获取放在全局context的store

            const stateProps = mapStateToProps(store.getState())

            // 方法不能直接传，因为需要dispatch
            // 例如直接执行addGun()毫无意义，需要addGun = () => store.dispatch(addGun())才有意义
            // 其实就使用dispatch将actionCreator包了一层
            const dispatchProps = bindActionCreators(mapDispatchToProps, store.dispatch)

            this.setState({
                props: {
                    ...this.state.props,
                    ...stateProps,
                    ...dispatchProps,
                }
            })
        }

        render() {
            return <WrapComponent {...this.state.props}/>
        }
    }
}

// Provider 负责将store放到context里，所有子组件均可以直接获取store
export class Provider extends Component {
    // 使用context需要使用propType进行校验
    static childContextTypes = {
        store: PropTypes.object
    }

    constructor(props, context) {
        super(props, context)
        this.store = props.store // 将传进来的store作为本身的store进行管理
    }

    // 将传进来的store放入全局context，使得下面的所有子组件均可获得store
    getChildContext() {
        return { store: this.store }
    }

    render() {
        return this.props.children
    }
}