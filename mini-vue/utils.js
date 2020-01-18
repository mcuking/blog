// 获取对象某一级的值，例如获取 a.b.c 的值
function getVal(obj, expr) {
  return expr.split('.').reduce((prev, next) => {
    return prev[next];
  }, obj);
}

// 向多级对象设值
function setVal(obj, expr, val) {
  return expr.split('.').reduce((prev, next, currentIndex) => {
    if (currentIndex === expr.split('.').length - 1) {
      return (prev[next] = val);
    }
    return prev[next];
  }, obj);
}

// 获取模版中变量的值，例如获取 {{a.b.c}} 的值
function getTextVal(obj, expr) {
  return expr.replace(/\{\{(.+?)\}\}/g, (...arg) => {
    return getVal(obj, arg[1]);
  });
}

// 判断是否是元素
function isElementNode(node) {
  return node.nodeType === 1;
}

// 判断是否是指令
function isDirective(name) {
  return name.startsWith('v-');
}

// 将 el 元素全部放到内存
function node2fragment(el) {
  const fragment = document.createDocumentFragment();
  let firstChild;
  while ((firstChild = el.firstChild)) {
    fragment.appendChild(firstChild);
  }
  return fragment; // 内存中的节点
}

// 更新 dom 方法集
const CompileUtils = {
  text(node, vm, expr) {
    expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, args[1], () => {
        // 当值变化后，文本节点要重新获取依赖属性更新文本
        node.textContent = getTextVal(vm.$data, expr);
      });
    });

    node.textContent = getTextVal(vm.$data, expr);
  },

  model(node, vm, expr) {
    // 添加一个观察者，数据变化后，调用观察者的回调函数 cb
    new Watcher(vm, expr, () => {
      // 当值变化后会调用 cb 将新值传递过来
      node.value = getVal(vm.$data, expr);
    });

    node.addEventListener('input', e => {
      const newValue = e.target.value;
      setVal(vm.$data, expr, newValue);
    });

    node.value = getVal(vm.$data, expr);
  }
};
