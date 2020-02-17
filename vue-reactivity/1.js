const data = {
  a: 1,
  b: 3
};

let target;

function observe(data) {
  for (const key in data) {
    const deps = [];
    let value = data[key];

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

  data[exp];
}

$watch('a', () => {
  console.log('a 被改变了');
});

data.a = 5;
