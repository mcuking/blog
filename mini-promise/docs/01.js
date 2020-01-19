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
