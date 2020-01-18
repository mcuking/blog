class Observer {
  constructor(data) {
    this.observe(data);
  }

  observe(data) {
    if (!!data && typeof data !== 'object' && typeof data !== 'function') {
      return;
    }

    if (typeof data === 'function') {
      data = data();
    }

    // 将数据一一劫持 获取 data 的 key 和 value
    for (const [key, value] of Object.entries(data)) {
      this.defineReactive(data, key, value);
      // 深度递归劫持
      this.observe(value);
    }
  }

  defineReactive(obj, key, value) {
    // 每个变化的数据，都对应一个数组，存放所有更新操作
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: () => {
        Dep.target && dep.addSub(Dep.target);
        return value;
      },
      set: newValue => {
        if (newValue !== value) {
          // 如果是对象，则继续劫持
          this.observe(newValue);
          value = newValue;
          dep.notify(); // 通知所有人数据更新了
        }
      }
    });
  }
}

class Dep {
  constructor() {
    this.subs = [];
  }

  addSub(watcher) {
    this.subs.push(watcher);
  }

  notify() {
    this.subs.forEach(watcher => watcher.update());
  }
}
