> 文章首发于我的博客 https://github.com/mcuking/blog/issues/79

接着上文 [Webpack  源码分析（1）— Webpack 启动过程分析](https://github.com/mcuking/blog/issues/78) 我们接下来继续分析 webpack 的构建流程。

上文结尾处我们提到了 webpack-cli 最终还是调用了 webpack 提供的 webpack 函数，获得了 compiler 实例对象。那么我们就重新回到 webpack 包查看下这个 webpack 函数，webpack 函数所在文件是 `node_module\webpack\lib\webpack.js` 。下面是其中的关键代码：

```js
const Compiler = require("./Compiler");
...
const webpack = (options, callback) => {
	...
	let compiler;
	if (Array.isArray(options)) {
		compiler = new MultiCompiler(
			Array.from(options).map(options => webpack(options))
		);
	} else if (typeof options === "object") {
		options = new WebpackOptionsDefaulter().process(options);

		compiler = new Compiler(options.context);
		compiler.options = options;
		...
		if (options.plugins && Array.isArray(options.plugins)) {
			for (const plugin of options.plugins) {
				if (typeof plugin === "function") {
					plugin.call(compiler, compiler);
				} else {
					plugin.apply(compiler);
				}
			}
		}
		compiler.hooks.environment.call();
		compiler.hooks.afterEnvironment.call();
		compiler.options = new WebpackOptionsApply().process(options, compiler);
	} else {
		throw new Error("Invalid argument: options");
	}
	if (callback) {
		...
		compiler.run(callback);
	}
	return compiler;
}
```

有上面的代码我们可以看到 webpack 函数是通过引入了外部定义好的 Compiler 类，并基于接收到的 options 初始化了一个实例对象（如果 options 是数组，则遍历数组中每个 option，分别初始化 compiler 实例对象），最后调用了 compiler 实例上的 run 方法（如果是 watch 模式则调用 watch 方法）。

不过在调用 run 方法之前，还有一些逻辑是对 options 的 plugins 属性做了一些处理以及调用 compiler 上面的 hooks 的一些方法。为了搞清楚这里的原理，我们需要仔细了解下 Compiler 这个类的定义，该类在  `node_module\webpack\lib\Compiler` 文件中。关键代码如下：

```js
const {
	Tapable,
	SyncHook,
	SyncBailHook,
	AsyncParallelHook,
	AsyncSeriesHook
} = require("tapable");
const Compilation = require("./Compilation");

class Compiler extends Tapable {
	constructor(context) {
		super();
		this.hooks = {
			shouldEmit: new SyncBailHook(["compilation"]),
			done: new AsyncSeriesHook(["stats"]),
			...
		},
		...
	}

	watch(watchOptions, handler) {

	}

	run(callback) {

	}

	...

	emitAssets(compilation, callback) {

	}

	...

	createCompilation() {
		return new Compilation(this);
	}

	newCompilation(params) {

	}
	
	...

	compile(callback) {

	}
}
```

到这里我们了解到 Compiler 类继承了 Tapable 类，而 Tapable 类又是从 webpack 开源的 [tapable](https://github.com/webpack/tapable) 包中引入的，那么接下来就需要弄清 tapable 这个包的作用了。

关于 tapable 的内部源码我们就不去分析了，而是采用另一种思路，通过查询 tapable 仓库的文档和相关资料，参考 webpack 中使用 Tapable 的方式，用代码实现一个类似的 demo。

## Tapable 是什么

Tapable 是一个类似 NodeJS 的 EventEmitter 的库，主要通过钩子函数的发布与订阅来实现 webpack 的插件系统。

## Tapable 的基本使用

Tapable 暴露出来的都是类方法，可以通过 new 一个类方法来获得我们需要的钩子。

那么我们看下 Tapable 暴露出来的 Hook（钩子）类都有哪些，总共 9 种：

```js
const {
    SyncHook,
    SyncBailHook,
    SyncWaterfallHook,
    SyncLoopHook,
    AsyncParallelHook,
    AsyncParallelBailHook,
    AsyncSeriesHook,
    AsyncSeriesBailHook,
    AsyncSeriesWaterfallHook,
} = require("tapable")
```
不难发现，其中有很多公共的部分，其实这九种钩子都是继承了下面列表中的基础钩子类：

| type          | function                                                    |
| ------------- | ----------------------------------------------------------- |
| Hook          | 所有钩子的后缀                                              |
| Waterfall     | 同步方法，但是会传值给下一个方法                            |
| Bail          | 熔断：当函数有任何返回值，都会在当前执行函数停止            |
| Loop          | 监听函数返回，返回 true 继续循环，返回 undefined 则结束循环 |
| Sync          | 同步                                                        |
| Async         | 异步                                                        |
| AsyncSeries   | 异步串行                                                    |
| AsyncParallel | 异步并行                                                    |

具体是通过钩子的绑定和执行来使用的，如下图：

| Async                         | Sync       |
| ----------------------------- | ---------- |
| 绑定：tapAsync/tapPromise/tap | 绑定：tap  |
| 执行：callAsync/promise       | 执行：call |

下面是 hook 使用示例代码：

```js
const hook1 = new SyncHook(["arg1", "arg2"])

// 绑定事件
hook1.tap('hook1', (arg1, arg2) => console.log(arg1, arg2));

// 执行绑定的事件
hook1.call(1, 2);
```

## 模拟 Webpack 使用 Tapable 方式

源码请参考 https://github.com/mcuking/blog/tree/master/tapable-demo

我们首先按照源码的方式实现一个简单的 Compiler 类，并设置两个钩子 compile（同步钩子）和 emit（异步串行钩子）。

```js
const { SyncHook, AsyncSeriesHook } = require('tapable');

class Compiler {
  constructor() {
    super();

    this.hooks = {
      compile: new SyncHook(),
      emit: new AsyncSeriesHook()
    };
  }

  run() {
    this.compile();
    this.emit();
  }

  compile() {
    this.hooks.compile.call();
  }

  emit() {
    this.hooks.emit.callAsync(() => {});
  }
}

module.exports = Compiler;
```

然后我们在调用 Compiler 实例对象的 run 方法时，执行刚刚两个钩子 compile 和 emit。接下来我们实现一个插件 myPlugin，也是按照类的形式来实现的。

```js
class MyPlugin {
  constructor() {}

  apply(compiler) {
    compiler.hooks.compile.tap('OfflinePackagePlugin', () => {
      console.log('compiling...');
    });

    compiler.hooks.emit.tapAsync('OfflinePackagePlugin', callback => {
      console.log('start generating offline package...');
      setTimeout(() => {
        console.log('generate offline package successfully');
        callback();
      }, 4000);
    });
  }
}

module.exports = MyPlugin;
```
插件中 apply 方法接收了 Compiler 实例对象，并调用了实例上的两个 hook （钩子）的绑定方法。

然后再 index.js 文件中将 Compiler 和 MyPlugin 结合起来，如下：

```js
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
```

即初始化了一个 Compiler 实例对象，然后初始化了 options 里面的插件（传入Compiler 的实例对象），其实就是将插件里面的要执行的业务逻辑绑定到 Compiler 实例的 hook （钩子）上，最后执行 Compiler 实例对象的 run 方法，触发相应的 hook （钩子），从而触发绑定到 hook （钩子）上的方法的执行，本质上就是发布订阅模式。

到这里我们就已经掌握了 webpack 是如何利用 tapable 来实现整个插件机制的，下篇文章我们将真正开始对 webpack 的构建流程进行解析。

## 相关文章

- [Webpack 源码分析（1）— Webpack 启动过程分析](https://github.com/mcuking/blog/issues/78)

- [Webpack 源码分析（2）— Tapable 与 Webpack 的关联](https://github.com/mcuking/blog/issues/79)

- [Webpack 源码分析（3）— Webpack 构建流程分析](https://github.com/mcuking/blog/issues/80)
