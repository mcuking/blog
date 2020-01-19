// 在上一个Promise基础上新增值透传功能
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
      // 考虑到执行executor的过程中有可能出错，所以我们用try/catch块给包起来，并且在出错后以catch到的值reject掉这个Promise
      executor(resolve, reject); // 执行executor
    } catch (e) {
      reject(e);
    }
  }

  // then方法接收两个参数，onResolved，onRejected，分别为Promise成功或失败后的回调
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
      // 如果promise1(此处即为this/self)的状态已经确定并且是resolved，我们调用onResolved
      // 因为考虑到有可能throw，所以我们将其包在try/catch块里
      return (promise2 = new Promise(function(resolve, reject) {
        try {
          let x = onResolved(self.value);
          if (x instanceof Promise) {
            // 如果onResolved的返回值是一个Promise对象，直接取它的结果做为promise2的结果
            x.then(resolve, reject);
          } else {
            resolve(x); // 否则，以它的返回值做为promise2的结果
          }
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
          } else {
            reject(x); // 否则，以它的返回值做为promise2的结果
          }
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
