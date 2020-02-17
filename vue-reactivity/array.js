// 复写数组原型上修改原数组方法的逻辑
const mutationMethods = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
];

const arrayMethods = Object.create(Array.prototype); // 实现 arrayMethods.__proto__ === Array.prototype
const arrayProto = Array.prototype; // 缓存 Array.prototype

mutationMethods.forEach(method => {
  arrayMethods[method] = function(...args) {
    const result = arrayProto[method].apply(this, args);

    console.log(`执行了代理原型的 ${method} 函数`);

    return result;
  };
});

const arr = [];
arr.__proto__ = arrayMethods;

arr.push(1);
