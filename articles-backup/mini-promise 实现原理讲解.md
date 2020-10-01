> 文章首发于我的博客 https://github.com/mcuking/blog/issues/72

> 实现源码请查阅 https://github.com/mcuking/blog/tree/master/mini-Promise

本文主要是阐述如何一步步实现一个符合 [Promises/A+ 规范](https://promisesaplus.com/) 的 Promise。

## Promise 实现

在实现之前，让我们先看一段使用 Promise 的示例代码：

```js
new Promise((resolve, reject) => {
  setTimeout(resolve('hello world'), 1000);
})
.then(
  (msg) => console.log(msg),
  (err) => console.error(err)
);
```

### Promise 实例化对象过程的实现

首先我们来先实现前半部分的功能，即：

```js
new Promise((resolve, reject) => {
  setTimeout(resolve('hello world'), 1000);
})
```

根据 [Promises/A+ 规范](https://promisesaplus.com/) 我们可以分解一下需要做的事情：

1. 首先采用一个类来实现 Promise；
2. 这个类的实例有一个状态属性，来表示 Promise 对象实例的三种状态：pending、resolved、rejected；
3. Promise 实例化对象的时候会接收一个函数，会在实例化的时候就立即执行；
4. 上一点的立即执行函数有两个参数：resolve 方法和 reject 方法。这两个方法主要是用来改变 Promise 对象实例的状态，以及执行成功 / 失败回调函数，这个逻辑放到后面来实现。

因此可以初步写出如下代码：

```js
class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }

    this.value = undefined; // Promise 的值
    this.status = 'pending'; // Promise 当前的状态

    const resolve = value => {
      // 成功后的一系列操作（状态的改变、成功回调执行）
    };

    const reject = reason => {
      // 失败后的一系列操作（状态的改变、失败回调执行）
    };

    try {
      // 考虑到执行 executor 的过程中有可能出错，所以我们用 try/catch 块给包起来，并且在出错后以 catch 到的值 reject 掉这个 Promise
      executor(resolve, reject); // 执行 executor
    } catch (e) {
      reject(e);
    }
  }
}
```

接下来我们来分析如何实现第二部分 --then 方法：

```js
new Promise((resolve, reject) => {
  setTimeout(resolve('hello world'), 1000);
})
.then(
  (msg) => console.log(msg),
  (err) => console.error(err)
);
```

根据 [Promises/A+ 规范](https://promisesaplus.com/) ，then 方法会接收两个参数，分别是成功和失败的回调函数。当调用 resolve 方法将 Promise 状态从 pending 改为 resolved，并执行传入的成功回调函数；调用 reject 方法将 Promise 状态从 pending 改为 rejected，并执行失败回调函数。

需要注意的是，一个 Promise 实例对象的 then 方法会被调用多次，也就说 then 方法可以接收多个成功 / 失败回调函数，所以需要使用数组来接收这些回调函数。当 Promise 实例对象的状态从 pending 变成 resovled/rejected 时，就遍历存储回调函数的数组执行所有的成功 / 失败回调函数。

下面是对应的实现代码：

```js
class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }

    this.value = undefined; // Promise 的值
    this.status = 'pending'; // Promise 当前的状态
    this.onResolvedCallbacks = []; // Promise resolve 时的回调函数集，因为在 Promise 结束之前有可能有多个回调添加到它上面
    this.onRejectedCallbacks = []; // Promise reject 时的回调函数集，因为在 Promise 结束之前有可能有多个回调添加到它上面

    const resolve = value => {
      // 当前状态为 pending 时才会执行
      if (this.status === 'pending') {
        this.status = 'resolved';
        this.value = value;
        for (let i = 0; i < this.onResolvedCallbacks.length; i++) {
          this.onResolvedCallbacks[i](value);
        }
      }
    };

    const reject = reason => {
      // 当前状态为 pending 时才会执行
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.value = reason;
        for (let i = 0; i < this.onRejectedCallbacks.length; i++) {
          this.onRejectedCallbacks[i](reason);
        }
      }
    };

    try {
      // 考虑到执行 executor 的过程中有可能出错，所以我们用 try/catch 块给包起来，并且在出错后以 catch 到的值 reject 掉这个 Promise
      executor(resolve, reject); // 执行 executor
    } catch (e) {
      reject(e);
    }
  }
}
```

### Promise 对象实例的 then 方法的实现

从上面的实现中，读者可能会有一个疑问：**执行 resolve 和 reject 方法时，为什么会需要先判断当前 Promise 实例对象状态是否为 pending。如果是 pending，才会遍历执行回调函数数组中的回调函数呢？**

**因为当 Promise 实例对象已经处于 resolved 或 rejected 状态时，传入的对应回调函数时就需要被立即执行，并且只会被执行一次。再次调用 resolve 或 reject 方法不会再做任何操作。**

例如当 Promise 实例已经处于 resolved 状态时，调用 then 方法接收成功回调函数时，该函数会被立即执行。同理处于 rejected 状态时，会立即执行 then 方法接收的失败回调函数。

另外需要明确的一点是，根据 [Promises/A+ 规范](https://promisesaplus.com/)，then 方法必须返回一个 Promise 对象，因此执行完 then 方法后，需要再返回一个新的 Promise 实例。

那么我们就来根据刚才的分析来实现一下 then 方法。下面对应的实现代码：

```js
// 增加 then 方法
class Promise {
  constructor(executor) {
    // 代码同上
  }

  // then 方法接收两个参数，onResolved，onRejected，分别为 Promise 成功或失败后的回调
  then(onResolved, onRejected) {
    let self = this;
    let promise2;

    // 根据标准，如果 then 的参数不是 function，则我们需要忽略它，此处以如下方式处理
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
        self.onResolvedCallbacks.push(function(value) {
          onResolved(value);
        });
        self.onRejectedCallbacks.push(function(reason) {
          onRejected(reason);
        });
      }));
    }
  }
}
```

- 当前 promise1 处于 pending 状态时，执行 then 方法时返回一个 promise2 的同时，在 promise2 对应的立即执行函数中将接收到的回调函数塞入 promise1 的回调队列中；

- 当处于 resolved 时，则在返回的 promise2 对应的立即执行函数中调用传入的成功回调函数；

- 当处于 rejeted 时，则在返回的 promise2 对应的立即执行函数中调用传入的失败回调函数。

这里读者可能会有一个疑问，为什么需要在 promise2 对应的立即执行函数中执行塞入回调函数到队列或立即执行回调函数的逻辑？直接在外面执行这些逻辑不就可以了么？这就涉及到了下个要实现的功能了 --Promise 链式调用

### Promise 链式调用 - 回调函数返回值问题

根据 [Promises/A+ 规范](https://promisesaplus.com/) ：

```js
promise2 = promise1.then(onFulfilled, onRejected);
```

如果 onFulfilled 或者 onRejected 返回一个值 x ，则运行下面的 Promise 解决过程：`[[Resolve]](promise2, x)`。具体规则如下：

![image](https://user-images.githubusercontent.com/22924912/72674087-c2ca1c00-3aad-11ea-93c4-76a3db956d7c.png)

这里我们只考虑 x 为 Promise 或非对象和函数的值的情况：

**如果 onResolved/onRejected 的返回值 x 是一个 Promise 对象，直接取它的结果做为 promise2 的结果，即 x 接管了 promise2 的状态：如果 x 处于 pending 状态， promise2 需保持为 pending 状态直至 x 被 resolve/reject 掉，如果 x 处于 resolved 状态，用相同的 value 执行 promise2，如果 x 处于 rejected 状态，用相同的 reason 拒绝 promise2。**

**如果 x 不为对象或者函数，则以 x 为参数执行 promise2。**

下面是对应的实现代码：

```js
// 针对上一个 Promise 为 pending 时，上一个 then 返回值进行优化
class Promise {
  constructor(executor) {
    // 同上
  }

  // then 方法接收两个参数，onResolved，onRejected，分别为 Promise 成功或失败后的回调
  then(onResolved, onRejected) {
    let self = this;
    let promise2;

    // 根据标准，如果 then 的参数不是 function，则我们需要忽略它，此处以如下方式处理
    onResolved = typeof onResolved === 'function' ? onResolved : function(v) {};
    onRejected = typeof onRejected === 'function' ? onRejected : function(r) {};

    if (self.status === 'resolved') {
      // 如果 promise1(此处即为 this/self) 的状态已经确定并且是 resolved，我们调用 onResolved
      // 因为考虑到有可能 throw，所以我们将其包在 try/catch 块里
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onResolved(self.value);
          if (x instanceof Promise) {
            // 如果 onResolved 的返回值是一个 Promise 对象，直接取它的结果做为 promise2 的结果
            x.then(resolve, reject);
          }
          resolve(x); // 否则，以它的返回值做为 promise2 的结果
        } catch (e) {
          reject(e); // 如果出错，以捕获到的错误做为 promise2 的结果
        }
      }));
    }

    // 此处与前一个 if 块的逻辑几乎相同，区别在于所调用的是 onRejected 函数，就不再做过多解释
    if (self.status === 'rejected') {
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onRejected(self.value);
          if (x instanceof Promise) {
            x.then(resolve, reject);
          }
          reject(x); // 否则，以它的返回值做为 promise2 的结果
        } catch (e) {
          reject(e);
        }
      }));
    }

    if (self.status === 'pending') {
      // 如果当前的 Promise 还处于 pending 状态，我们并不能确定调用 onResolved 还是 onRejected，
      // 只能等到 Promise 的状态确定后，才能确实如何处理。
      // 所以我们需要把我们的两种情况的处理逻辑做为 callback 放入 promise1(此处即 this/self) 的回调队列里
      // 逻辑本身跟第一个 if 块内的几乎一致，此处不做过多解释
      return (promise2 = new Promise(function(resolve, reject) {
        self.onResolvedCallbacks.push(function(value) {
          try {
            let x = onResolved(value);
            if (x instanceof Promise) {
              x.then(resolve, reject);
            }
          } catch (e) {
            reject(e);
          }
        });

        self.onRejectedCallbacks.push(function(reason) {
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

### Promise 链式调用 - 值透传问题

```js
new Promise(resolve => {
  resolve(8)
})
  .then()
  .then()
  .then((value) => console.log(value))
```
从上面的 Promise 使用示例代码中，我们会发现一个场景：在 Promise 链式调用中，当中间的 then 方法没有接收到回调函数时，后面的 then 方法接收的回调函数仍能够获取到前面传递的值。那么这里就需要 then 方法在接收的回调函数作如下操作，即如果没有传入成功 / 失败回调函数时，默认的回调函数需要将接收的值返回给下一个 Promise 实例对象。下面是对应的实现代码：

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

## 结束语

到这里一个基本的 Promise 已经实现了，下面是完整的 Promise 代码实现。经历了整个过程，相信读者对 Promise 的理解会更加深入了。

```js
class Promise {
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }

    this.value = undefined; // Promise 的值
    this.status = 'pending'; // Promise 当前的状态
    this.onResolvedCallback = []; // Promise resolve 时的回调函数集，因为在 Promise 结束之前有可能有多个回调添加到它上面
    this.onRejectedCallback = []; // Promise reject 时的回调函数集，因为在 Promise 结束之前有可能有多个回调添加到它上面

    const resolve = value => {
      if (this.status === 'pending') {
        this.status = 'resolved';
        this.value = value;
        for (let i = 0; i < this.onResolvedCallback.length; i++) {
          this.onResolvedCallback[i](value);
        }
      }
    };

    const reject = reason => {
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.value = reason;
        for (let i = 0; i < this.onRejectedCallback.length; i++) {
          this.onRejectedCallback[i](reason);
        }
      }
    };

    try {
      // 考虑到执行 executor 的过程中有可能出错，所以我们用 try/catch 块给包起来，并且在出错后以 catch 到的值 reject 掉这个 Promise
      executor(resolve, reject); // 执行 executor
    } catch (e) {
      reject(e);
    }
  }

  // then 方法接收两个参数，onResolved，onRejected，分别为 Promise 成功或失败后的回调
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

    if (self.status === 'resolved') {
      // 如果 promise1(此处即为 this/self) 的状态已经确定并且是 resolved，我们调用 onResolved
      // 因为考虑到有可能 throw，所以我们将其包在 try/catch 块里
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onResolved(self.value);
          if (x instanceof Promise) {
            // 如果 onResolved 的返回值是一个 Promise 对象，直接取它的结果做为 promise2 的结果
            x.then(resolve, reject);
          } else {
            resolve(x); // 否则，以它的返回值做为 promise2 的结果
          }
        } catch (e) {
          reject(e); // 如果出错，以捕获到的错误做为 promise2 的结果
        }
      }));
    }

    // 此处与前一个 if 块的逻辑几乎相同，区别在于所调用的是 onRejected 函数，就不再做过多解释
    if (self.status === 'rejected') {
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onRejected(self.value);
          if (x instanceof Promise) {
            x.then(resolve, reject);
          } else {
            reject(x); // 否则，以它的返回值做为 promise2 的结果
          }
        } catch (e) {
          reject(e);
        }
      }));
    }

    if (self.status === 'pending') {
      // 如果当前的 Promise 还处于 pending 状态，我们并不能确定调用 onResolved 还是 onRejected，
      // 只能等到 Promise 的状态确定后，才能确实如何处理。
      // 所以我们需要把我们的两种情况的处理逻辑做为 callback 放入 promise1(此处即 this/self) 的回调队列里
      // 逻辑本身跟第一个 if 块内的几乎一致，此处不做过多解释
      return (promise2 = new Promise(function(resolve, reject) {
        self.onResolvedCallback.push(function(value) {
          try {
            let x = onResolved(value);
            if (x instanceof Promise) {
              x.then(resolve, reject);
            } else {
              resolve(x);
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
            } else {
              reject(x);
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

## 参考资料

- [Promises/A+ 规范](https://promisesaplus.com/)

- [Promises/A+ 规范（译）](https://www.ituring.com.cn/article/66566)
