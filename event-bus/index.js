// 实现一个简易的 event bus

class EventBus {
  constructor() {
    this._events = new Map();
  }

  on(type, fn) {
    const handlers = this._events.get(type);

    if (!handlers) {
      this._events.set(type, [fn]);
    } else {
      handlers.push(fn);
    }
  }

  emit(type) {
    const handlers = this._events.get(type);

    if (!handlers) return;

    for (const handler of handlers) {
      handler();
    }
  }

  off(type, fn) {
    const handlers = this._events.get(type);

    if (!handlers) return;

    const index = handlers.indexOf(fn);

    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
}

// 测试

const eventbus = new EventBus();

eventbus.on('hoho', () => {
  console.log('傻叼来啦！！！');
});

console.log('hello world');
setTimeout(() => {
  eventbus.emit('hoho');
}, 2000);
