class Promise {
  constructor(executor) {
    this.status = 'pending'; // Promise当前的状态
    this.data = undefined; // Promise的值
    this.onResolvedCallback = []; // Promise resolve时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面
    this.onRejectedCallback = []; // Promise reject时的回调函数集，因为在Promise结束之前有可能有多个回调添加到它上面

    const resolve = value => {
      // 当前状态为pending时才会执行
      if (this.status === 'pending') {
        this.status = 'resolved';
        this.data = value;
        for (let i = 0; i < this.onResolvedCallback.length; i++) {
          this.onResolvedCallback[i](value);
        }
      }
    };

    const reject = reason => {
      // 当前状态为pending时才会执行
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
}
