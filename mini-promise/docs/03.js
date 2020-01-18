// 增加then方法
class Promise {
  constructor(executor) {
    this.status = 'pending'; // Promise当前的状态
    this.data = undefined; // Promise的值
    this.onResolvedCallback = []; // Promise resolve时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面
    this.onRejectedCallback = []; // Promise reject时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面

    const resolve = value => {
      if (this.status === 'pending') {
        this.status = 'resolved';
        this.data = value;
        for (let i = 0; i < this.onResolvedCallback.length; i++) {
          this.onResolvedCallback[i](value);
        }
      }
    };

    const reject = reason => {
      if (this.status === 'pending') {
        this.status = 'rejected';
        this.data = reason;
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
