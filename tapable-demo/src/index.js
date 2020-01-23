/**
 * 模拟 webpack 使用 tapable 方式，
 * 用来演示 webpack 内部插件运行机制
 */

const Compiler = require('./Compiler');

const MyPlugin = require('./myPlugin');

const myPlugin = new MyPlugin();

const options = {
  plugins: [myPlugin]
};

const compiler = new Compiler();

for (const plugin of options.plugins) {
  if (typeof plugin === 'function') {
    plugin.call(compiler, compiler);
  } else {
    plugin.apply(compiler);
  }
}

compiler.run();
