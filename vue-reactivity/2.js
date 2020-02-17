// 支持监听多级嵌套对象

const data = {
  a: {
    b: 1
  }
};

let target;

function observe(data) {
  for (const key in data) {
    const deps = [];
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
        deps.push(target);
        return value;
      }
    });
  }
}

// 将 data 对象变成响应式
observe(data);

function $watch(exp, fn) {
  target = fn;

  // 支持对象的多级访问
  if (/\./.test(exp)) {
    let obj = data;
    const pathArr = exp.split('.');
    pathArr.forEach(path => {
      obj = obj[path];
    });
    return;
  }

  data[exp];
}

$watch('a.b', () => {
  console.log('a.b 被改变了');
});

data.a.b = 6;
