// deps 使用 set 数据结构，防止重复收集同一个依赖

const data = {
  name: 'Tom'
};

let target;

function observe(data) {
  for (const key in data) {
    const deps = new Set();
    let value = data[key];
    // 判断 value 是否仍是纯对象
    if (Object.prototype.toString.call(value).slice(8, -1) === 'Object') {
      observe(value);
    }

    Object.defineProperty(data, key, {
      set(newVal) {
        if (newVal === value) return;
        value = newVal;
        deps.forEach(dep => dep());
      },
      get() {
        deps.add(target);
        return value;
      }
    });
  }
}

// 将 data 对象变成响应式
observe(data);

function $watch(expOrFn, fn) {
  target = fn;

  if (typeof expOrFn === 'function') {
    expOrFn();
    return;
  }

  // 支持对象的多级访问
  if (/\./.test(exp)) {
    let obj = data;
    const pathArr = expOrFn.split('.');
    pathArr.forEach(path => {
      obj = obj[path];
    });
    return;
  }

  data[expOrFn];
}

function render() {
  console.log('渲染啦啦啦啦');
  document.body.innerText = '';
  return document.write(`名字是${data.name}`);
}

$watch(render, render);
