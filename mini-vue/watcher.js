// 给需要变化的元素增加一个观察者，数据变化后执行对应方法
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    // 获取老值
    this.oldValue = this.get();
  }

  get() {
    // 取值时触发 getter，getter 中在返回值前将当前 watch Dep.target
    Dep.target = this;
    const value = getVal(this.vm.$data, this.expr);
    Dep.target = null;
    return value;
  }

  update() {
    const newValue = getVal(this.vm.$data, this.expr);
    if (newValue !== this.oldValue) {
      this.cb(newValue);
    }
  }
}
