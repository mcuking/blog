> 文章首发于我的博客 https://github.com/mcuking/blog/issues/72

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-promise

本文主要会按照 [Promises/A+规范](https://www.ituring.com.cn/article/66566) 来一步步实现一个完整的 Promise

先写一段 Promise 的应用代码：

```js
new Promise((resolve, reject) => {
  setTimeout(resolve('hello world'), 1000);
})
.then((msg) => console.log(msg), (err) => console.error(err))
```

第一步我们先实现前半部分，即：

```
new Promise((resolve, reject) => {
  setTimeout(resolve('hello world'), 1000);
})
```

根据 Promise A+ 规范我们可以知道 Promise 本身是一个类，并且有三种状态，实例化的时候接收一个立即执行函数，并可以接受  resolve 和 reject 方法，因此可以初步写出如下代码

```js
class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }

    this.value = undefined; // Promise的值
    this.status = 'pending'; // Promise当前的状态

    const resolve = value => {
      // 成功后的一系列操作（状态的改变、成功回调执行）
    };

    const reject = reason => {
      // 失败后的一系列操作（状态的改变、失败回调执行）
    };

    try {
      // 考虑到执行executor的过程中有可能出错，所以我们用try/catch块给包起来，并且在出错后以catch到的值reject掉这个Promise
      executor(resolve, reject); // 执行executor
    } catch (e) {
      reject(e);
    }
  }
}
```

接下来我们来分析 then 方法的实现，then 方法会接收两个参数，依次是成功回调函数和失败回调函数，当调用 resolve 方法使 Promise 进入 resolved 状态时，则执行成功回调；调用 reject 方法使 Promise 进入 rejected 状态时，则执行失败回调。因此我们可以加入如下实现：

```js
class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }

    this.value = undefined; // Promise的值
    this.status = 'pending'; // Promise当前的状态
    this.onResolvedCallback = []; // Promise resolve时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面
    this.onRejectedCallback = []; // Promise reject时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面

    const resolve = value => {
      // 当前状态为pending时才会执行
      if (this.status === 'pending') {
        this.status = 'resolved';
        this.value = value;
        for (let i = 0; i < this.onResolvedCallback.length; i++) {
          this.onResolvedCallback[i](value);
        }
      }
    };

    const reject = reason => {
      // 当前状态为pending时才会执行
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.value = reason;
        for (let i = 0; i < this.onRejectedCallback.length; i++) {
          this.onRejectedCallback[i](reason);
        }
      }
    };

    try {
      // 考虑到执行executor的过程中有可能出错，所以我们用try/catch块给包起来，并且在出错后以catch到的值reject掉这个Promise
      executor(resolve, reject); // 执行executor
    } catch (e) {
      reject(e);
    }
  }
}
```

这里需要注意两点：

- 为什么 onResolvedCallback 和 onRejectedCallback 是数组？

因为 then 方法可以被同一个 promise 调用多次，因此可能会传入多个成功或失败回调函数。

- resolve 和 reject 为什么会首先判断当前状态是否为 pending？

因为当 Promise 实例已经处于 resolved 或 rejected 状态时，传入的对应回调函数会被立即执行。即当 Promise 实例已经处于 resolved 状态时，调用 then 传入成功回调函数时，回调会被立即执行。同理处于 rejected 状态时会立即执行失败回调函数。

下面我们就来增加下这个逻辑，另外需要明确的一点是，根据 Promise A+ 规范：then 方法必须返回一个 promise 对象，因此执行完 then 方法后，需要返回一个新的 Promise 实例。

```js
// 增加then方法
class Promise {
  constructor(executor) {
       同上
  }

  // then方法接收两个参数，onResolved，onRejected，分别为Promise成功或失败后的回调
  then(onResolved, onRejected) {
    let self = this;
    let promise2;

    // 根据标准，如果then的参数不是function，则我们需要忽略它，此处以如下方式处理
    onResolved = typeof onResolved === 'function' ? onResolved : function(v) {};
    onRejected = typeof onRejected === 'function' ? onRejected : function(r) {};

    if (self.status === 'resolved') {
      return (promise2 = new Promise(function(resolve, reject) {
        onResolved(self.data);
      }));
    }

    if (self.status === 'rejected') {
      return (promise2 = new Promise(function(resolve, reject) {
        onRejected(self.data);
      }));
    }

    if (self.status === 'pending') {
      return (promise2 = new Promise(function(resolve, reject) {
        self.onResolvedCallback.push(function(value) {
          onResolved(value);
        });
        self.onRejectedCallback.push(function(reason) {
          onRejected(reason);
        });
      }));
    }
  }
}
```
 
其中当前 promise1 处于 pending 状态时，执行 then 方法时返回一个 promise2 的同时，在 promise2 的立即执行函数中将回调函数塞入 promise1 的回调队列中；当处于 resolved 时，则在返回的 promise2 中的立即执行函数中执行传入的成功回调；处于 rejeted 状态同理。

### 链式调用-回调函数返回值问题

根据 Promise A+ 规范：

```js
promise2 = promise1.then(onFulfilled, onRejected);   
```

如果 onFulfilled 或者 onRejected 返回一个值 x ，则运行下面的 Promise 解决过程：`[[Resolve]](promise2, x)`。具体规则如下：

![image](https://user-images.githubusercontent.com/22924912/72674087-c2ca1c00-3aad-11ea-93c4-76a3db956d7c.png)

这里我们只考虑  x 为 promise 或非对象和函数的值的情况：

如果 onResolved/onRejected 的返回值 x 是一个 Promise 对象，直接取它的结果做为 promise2 的结果，即 x 接管了 promise2 的状态：如果 x 处于等待态， promise2 需保持为等待态直至 x 被执行或拒绝，如果 x 处于执行态，用相同的值执行 promise2，如果 x 处于拒绝态，用相同的据因拒绝 promise2。

如果 x 不为对象或者函数，以 x 为参数执行 promise2。

下面为具体实现：

```js
// 针对上一个Promise为pending时，上一个then返回值进行优化
class Promise {
  constructor(executor) {
       同上
  }

  // then方法接收两个参数，onResolved，onRejected，分别为Promise成功或失败后的回调
  then(onResolved, onRejected) {
    let self = this;
    let promise2;

    // 根据标准，如果then的参数不是function，则我们需要忽略它，此处以如下方式处理
    onResolved = typeof onResolved === 'function' ? onResolved : function(v) {};
    onRejected = typeof onRejected === 'function' ? onRejected : function(r) {};

    if (self.status === 'resolved') {
      // 如果promise1(此处即为this/self)的状态已经确定并且是resolved，我们调用onResolved
      // 因为考虑到有可能throw，所以我们将其包在try/catch块里
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onResolved(self.value);
          if (x instanceof Promise) {
            // 如果onResolved的返回值是一个Promise对象，直接取它的结果做为promise2的结果
            x.then(resolve, reject);
          }
          resolve(x); // 否则，以它的返回值做为promise2的结果
        } catch (e) {
          reject(e); // 如果出错，以捕获到的错误做为promise2的结果
        }
      }));
    }

    // 此处与前一个if块的逻辑几乎相同，区别在于所调用的是onRejected函数，就不再做过多解释
    if (self.status === 'rejected') {
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onRejected(self.value);
          if (x instanceof Promise) {
            x.then(resolve, reject);
          }
          reject(x); // 否则，以它的返回值做为promise2的结果
        } catch (e) {
          reject(e);
        }
      }));
    }

    if (self.status === 'pending') {
      // 如果当前的Promise还处于pending状态，我们并不能确定调用onResolved还是onRejected，
      // 只能等到Promise的状态确定后，才能确实如何处理。
      // 所以我们需要把我们的**两种情况**的处理逻辑做为callback放入promise1(此处即this/self)的回调数组里
      // 逻辑本身跟第一个if块内的几乎一致，此处不做过多解释
      return (promise2 = new Promise(function(resolve, reject) {
        self.onResolvedCallback.push(function(value) {
          try {
            let x = onResolved(value);
            if (x instanceof Promise) {
              x.then(resolve, reject);
            }
          } catch (e) {
            reject(e);
          }
        });

        self.onRejectedCallback.push(function(reason) {
          try {
            let x = onRejected(reason);
            if (x instanceof Promise) {
              x.then(resolve, reject);
            }
          } catch (e) {
            reject(e);
          }
        });
      }));
    }
  }
}
```

### 值透传问题

```js
new Promise(resolve => {
  resolve(8)
})
  .then()
  .then()
  .then((value) => console.log(value))
```
当中间并没有回调函数传递时，仍能够将值传递到最后面的回调函数，因此需要对 then 方法接收的回调函数作如下操作，即默认函数中将接收的值返回给下一个 Promise：

```js
then(onResolved, onRejected) {
    let self = this;
    let promise2;

    // 增加值的透传功能
    onResolved =
      typeof onResolved === 'function'
        ? onResolved
        : function(value) {
            return value;
          };
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : function(reason) {
            throw reason;
          };
    ......
}
```
