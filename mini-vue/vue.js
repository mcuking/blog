class Vue {
  constructor(options) {
    // 将有用的数据挂载到实例上
    this.$el = options.el;
    this.$data = options.data;

    // 如有要编译的模板就开始编译
    if (this.$el) {
      // 数据劫持
      new Observer(this.$data);

      // 将 this.$data 下的数据代理到 this 下
      this.proxyData(this.$data);

      // 用数据和元素进行编译
      new Compile(this.$el, this);
    }
  }

  proxyData(data) {
    Object.keys(data).forEach(key => {
      Object.defineProperty(this, key, {
        enumerable: true,
        configurable: true,
        get: () => {
          return data[key];
        },
        set: newVal => {
          data[key] = newVal;
        }
      });
    });
  }
}
