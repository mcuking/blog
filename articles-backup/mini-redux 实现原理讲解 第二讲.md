> 文章首发于我的博客 https://github.com/mcuking/blog/issues/26

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-redux

本讲主要解决如何在 react 中更优雅的使用 redux，即实现 react-redux

## Provider

在实现 react-redux 之前，我们首先需要了解 react 的 context 机制。当需要将某个数据设置为全局，即可使用 context 在父组件声明，这样其下面的所有子组件都可以获取到这个数据。

基于 context 机制，我们定义一个 Provider，作为应用的一级组件，专门负责将传入的 store 放到 context 里，所有子组件均可以直接获取 store，并不渲染任何东西。

```js
// Provider 负责将store放到context里，所有子组件均可以直接获取store
export class Provider extends Component {
  // 使用context需要使用propType进行校验
  static childContextTypes = {
    store: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this.store = props.store; // 将传进来的store作为本身的store进行管理
  }

  // 将传进来的store放入全局context，使得下面的所有子组件均可获得store
  getChildContext() {
    return { store: this.store };
  }

  render() {
    return this.props.children;
  }
}
```

对应业务代码如下：

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from './mini-redux';
import { Provider } from './mini-react-redux';
import { counter } from './index.redux';
import App from './App';

const store = createStore(counter);
ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);
```

## connect

connect 负责连接组件，将 redux 中的数据传入组件的属性里，因此需要完成下面两件事：

1. 负责接收一个组件，并将组件对应全局 state 里的一些数据放进去，返回一个新组件
2. 数据变化时，能够通知组件

因此 connect 本身是一个高阶组件，首先接收下面两个参数，然后再接收一个组件：

- mapStateToProps，是一个函数，入参为全局 state，并返回全局 state 中组件需要的的数据，代码如下：

```js
const mapStateToProps = state => {
  return {
    num: state
  };
};
```

- mapDispatchToProps，是一个对象，对象里面为 action（用来改变全局状态的对象）的生成函数，代码如下：

```js
const mapDispatchToProps = {
  buyHouse,
  sellHouse
};

// action creator
export function buyHouse() {
  return { type: BUY_HOUSE };
}

export function sellHouse() {
  return { type: SELL_HOUSE };
}
```

第一步，我们将 mapStateToProps 的返回值，即组件需要的全局状态 state 中的某个状态，以参数的形式传给新构建的组件，代码如下：

```js
export const connect = (
  mapStateToProps = state => state,
  mapDispatchToProps = {}
) => WrapComponent => {
  // 高阶函数，连续两个箭头函数意味着嵌套两层函数
  return class ConnectComponent extends Component {
    // 使用context需要使用propType进行校验
    static contextTypes = {
      store: PropTypes.object
    };

    constructor(props, context) {
      super(props, context);
      this.state = {
        props: {}
      };
    }

    componentDidMount() {
      this.update();
    }

    // 获取mapStateToProps返回值，放入到this.state.props
    update() {
      const { store } = this.context; // 获取放在全局context的store

      const stateProps = mapStateToProps(store.getState());

      this.setState({
        props: {
          ...this.state.props,
          ...stateProps
        }
      });
    }

    render() {
      return <WrapComponent {...this.state.props} />;
    }
  };
};
```

第二步，我们需要将 mapDispatchToProps 这个对象中修改全局状态的方法传入给组件，但是直接将类似 buyHouse 方法传给组件，并在组件中执行 buyHouse()方法并不能改变全局状态。

联想到上一讲 redux 中，修改全局状态，需要使用 store 的 dispatch 方法，dispatch 对应代码如下：

```js
function dispatch(action) {
  // reducer根据老的state和action计算新的state
  currentState = reducer(currentState, action);

  // 当全局状态变化时，执行传入的监听函数
  currentListeners.forEach(v => v());
  return action;
}
```

其中需要外部传入 action，即一个对象，例如`{type: BUY_HOUSE}`。因此我们需要将 buyHouse 方法的返回值 action 对象，传给 store.dispatch 方法，执行后才能改变全局状态。对应代码如下：

```js
buyHouse = () => store.dispatch(buyHouse());
```

对此，我们封装一个方法 bindActionCreators，入参为 mapDispatchToProps 和 store.dispatch，返回类似 buyHouse = () => store.dispatch(buyHouse())的方法的集合，即使用 dispatch 将 actionCreator 的返回值包一层，代码如下：

```js
// 将 buyHouse(...arg) 转换为 (...arg) => store.dispatch(buyHouse(...arg))
function bindActionCreator(creator, dispatch) {
  return (...arg) => dispatch(creator(...arg)); // 参数arg透传
}

// creators 示例 {buyHouse, sellHouse, buyHouseAsync}
export function bindActionCreators(creators, dispatch) {
  let bound = {};
  for (let v in creators) {
    bound[v] = bindActionCreator(creators[v], dispatch);
  }
  return bound;
}
```

因此，我们就可以第一步的基础上，将 store.dispatch 包装后的 actionCreator 集合对象，传给组件，代码如下：

```js
export const connect = (
  mapStateToProps = state => state,
  mapDispatchToProps = {}
) => WrapComponent => {
  // 高阶函数，连续两个箭头函数意味着嵌套两层函数
  return class ConnectComponent extends Component {
    // 使用context需要使用propType进行校验
    static contextTypes = {
      store: PropTypes.object
    };

    constructor(props, context) {
      super(props, context);
      this.state = {
        props: {}
      };
    }

    componentDidMount() {
      const { store } = this.context;
      store.subscribe(() => this.update()); // 每当全局状态更新，均需要更新传入组件的状态和方法
      this.update();
    }

    // 获取mapStateToProps的返回值 和 mapDispatchToProps，放入到this.state.props
    update() {
      const { store } = this.context; // 获取放在全局context的store

      const stateProps = mapStateToProps(store.getState());

      // 方法不能直接传，因为需要dispatch
      // 例如直接执行addHouse()毫无意义，需要buyHouse = () => store.dispatch(addHouse())才有意义
      // 其实就使用diapatch将actionCreator包了一层
      const dispatchProps = bindActionCreators(
        mapDispatchToProps,
        store.dispatch
      );

      this.setState({
        props: {
          ...this.state.props,
          ...stateProps,
          ...dispatchProps
        }
      });
    }

    render() {
      return <WrapComponent {...this.state.props} />;
    }
  };
};
```

注意，除了将 dispatchProps 传给组件之外，上面代码还在组件的 componentDidMount 生命周期中，将 update 函数设置为监听函数，即

```js
store.subscribe(() => this.update())
```

从而，每当全局状态发生变化，都会重新获取最新的传入组件的状态和方法，实现组件状态与全局状态同步的效果。

相关文章如下：
- [mini-redux 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/25)
- [mini-redux 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/26)
- [mini-redux 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/27)
- [mini-redux 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/29)
