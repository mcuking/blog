> 文章首发于我的博客 https://github.com/mcuking/blog/issues/78

本文以 webpack 源码来分析其内部的工作流程，准备分析的版本为 4.41.5。

首先我们要确认的是 webpack 的执行入口文件，通过查看 node_modules 中 webpack 的 package.json 的 bin 字段（如下），我们可以知道入口文件是 bin 文件下的 webpack.js，即 `node_modules\webpack\bin\webpack.js`。

```js
"bin": {
  "webpack": "./bin/webpack.js"
},
```

### 分析 webpack 入口文件：webpack.js

文件代码并不多，总共有 171 行，主要分为 6 个部分：

1. 正常执行返回

```js
process.exitCode = 0;
```
2. 定义了一个运行某个命令的方法 runCommand

```js
const runCommand = (command, args) => {...};
```

3. 定义了一个判断某个包是否安装的方法 isInstalled

```js
const isInstalled = packageName => {
	try {
		require.resolve(packageName);

		return true;
	} catch (err) {
		return false;
	}
};
```

4. 定义了两个 webpack 可用的 CLI：webpack-cli 和 webpack-command。其中 installed 属性就是调用了上面的 isInstalled 方法来计算的。

```js
const CLIs = [
	{
		name: "webpack-cli",
		package: "webpack-cli",
		binName: "webpack-cli",
		alias: "cli",
		installed: isInstalled("webpack-cli"),
		recommended: true,
		url: "https://github.com/webpack/webpack-cli",
		description: "The original webpack full-featured CLI."
	},
	{
		name: "webpack-command",
		package: "webpack-command",
		binName: "webpack-command",
		alias: "command",
		installed: isInstalled("webpack-command"),
		recommended: false,
		url: "https://github.com/webpack-contrib/webpack-command",
		description: "A lightweight, opinionated webpack CLI."
	}
];
```

5. 紧接着计算出已经安装的 CLI

```js
const installedClis = CLIs.filter(cli => cli.installed);
```

6. 然后根据安装 CLI 的数量进行处理

```js
if (installedClis.length === 0)  {...}
else if(installedClis.length === 1) {...}
else {...}
```
如果一个都没有安装，则会提示是否要安装 webpack-cli，如果同意则自动帮你安装；如果安装了其中一个，会直接使用那个；如果安装了俩个，会提示你删掉其中一个 CLI。

通过上面的分析，我们可以确认 webpack 最终会找到 webpack-cli 或 webpack-command 这个 npm 包，并执行这个 CLI。

那么我们就去看下 webpack-cli 具体做了什么工作。

### 分析 webpack-cli 运行机制

当前分析的 webpack-cli 版本为 3.3.10，通过 webpack-cli 包的 package.json 的 bin 字段我们可以确认 webpack-cli 的入口执行文件是 `node_modules\webpack-cli\bin\cli.js`

```js
"bin": {
    "webpack-cli": "./bin/cli.js"
},
```

然后我们继续分析 cli.js 做了些什么，通过大致查看可以确认的是 webpack-cli  的业务逻辑并不复杂，主要文件就是 cli.js，其余都是 utils 或 config 文件，而 cli.js 的代码也只有 366 行而已。下面我们就具体分析下 cli.js 里到底做了些什么。

首先开头处对用户输入的参数进行了分类，判断参数中有部分在 NON_COMPILATION_ARGS 中，则调用 utils 中 prompt-command 文件默认导出的方法，并将该命令和输入的参数传入到该方法。

```js
const NON_COMPILATION_CMD = process.argv.find(arg => {
	if (arg === "serve") {
		global.process.argv = global.process.argv.filter(a => a !== "serve");
		process.argv = global.process.argv;
	}
	return NON_COMPILATION_ARGS.find(a => a === arg);
});

if (NON_COMPILATION_CMD) {
	return require("./utils/prompt-command")(NON_COMPILATION_CMD, ...process.argv);
}
```

对此可以理解为，webpack-cli 部分命令是不需要进行编译的，即初始化一个 compiler 对象。那么我们来看下不需要编译的命令都有哪些，以及它们的作用。

```js
const NON_COMPILATION_ARGS = [
  "init", // 创建一份 webpack 配置文件
  "migrate",  // 进行 webpack 版本迁移
  "serve", // 运行 webpack-serve
  "generate-loader", // 生成 webpack loader 代码
  "generate-plugin", // 生成 webpack plugin 代码
  "info" // 返回与本地环境相关的一些信息
];
```

然后我们再看下 `./utils/prompt-command` 下的默认导出方法到底做了什么事，相关代码如下：

```js
module.exports = function promptForInstallation(packages, ...args) {
	try {
		const path = require("path");
		const fs = require("fs");
		pathForCmd = path.resolve(process.cwd(), "node_modules", "@webpack-cli", packages);
		if (!fs.existsSync(pathForCmd)) {
			const globalModules = require("global-modules");
			pathForCmd = globalModules + "/@webpack-cli/" + packages;
			require.resolve(pathForCmd);
		} else {
			require.resolve(pathForCmd);
		}
		packageIsInstalled = true;
	} catch (err) {
		packageIsInstalled = false;
	}
	if (!packageIsInstalled) {...}
}
```

promptForInstallation 方法接收到命令后会判断这个命令对应的包是否安装过，例如在 @webpack-cli 文件夹下是否存在 init 包，如果不存在，则提示安装，安装后则运行。如果存在则直接运行。

接下来我们回到主流程，看下 cli.js 后面的逻辑。

```js
const yargs = require("yargs").usage(`webpack-cli ${require("../package.json").version}

require("./config/config-yargs")(yargs);

yargs.parse(process.argv.slice(2), (err, argv, output) => {...})
```

./config/config-yargs 文件的默认导出的方法

```js
module.exports = function(yargs) {
	yargs
		.help("help")
		.alias("help", "h")
		.version()
		.alias("version", "v")
		.options({
			config: {
				type: "string",
				describe: "Path to the config file",
				group: CONFIG_GROUP,
				defaultDescription: "webpack.config.js or webpackfile.js",
				requiresArg: true
			},
			...
		);
}
```
可以看到 webpack-cli 用到了 [yargs](https://github.com/yargs/yargs) 工具来构建交互式命令行工具，它可以提供命令和分组参数，并能够动态生成 help 帮助信息。而 config-yargs 文件中的方法的作用就是就是对 yargs 进行配置。

接下来我们继续返回 cli.js 看下 yargs.parse 方法内做了什么。

```js
yargs.parse(process.argv.slice(2), (err, argv, output) => {
	...
	try {
		options = require("./utils/convert-argv")(argv);
	} catch(e) {
		...
	}
	...
})
```

我们可以看到接下来是调用了 `./utils/convert-argv` 文件下的默认方法，并传入了输入参数。那么看看 `./utils/convert-argv` 中的这个方法到底做了什么呢?

```js
module.exports = function(...args) {
	if (argv.config) {} else {
		const defaultConfigFileNames = ["webpack.config", "webpackfile"].join("|");
		const webpackConfigFileRegExp = `(${defaultConfigFileNames})(${extensions.join("|")})`;
		const pathToWebpackConfig = findup(webpackConfigFileRegExp);
		...
	}
}
```
由于代码较多，我这里就只摘抄了部分关键代码，我们不难发现这个方法主要作用就是生成 webpack 的配置项，例如 output 等，而来源主要有命令行的输入和 webpack.config.js 等文件。

再回到 cli.js，当生成完配置项 options，接下来又做了什么呢？

```js
yargs.parse(process.argv.slice(2), (err, argv, output) => {
	...
	function processOptions(options) {
		let compiler;
		try {
			compiler = webpack(options);
		} catch (err) {
			...
		}

		if (firstOptions.watch || options.watch) {
			const watchOptions =
				firstOptions.watchOptions || options.watchOptions || firstOptions.watch || options.watch || {};
			...
			compiler.watch(watchOptions, compilerCallback);
			...
		} else {
			compiler.run((err, stats) => {
				if (compiler.close) {
					compiler.close(err2 => {
						compilerCallback(err || err2, stats);
					});
				} else {
					compilerCallback(err, stats);
				}
			});
		}
	}
	processOptions(options)
})
```

我们可以看到，最后阶段调用了 processOptions 方法，里面则是获取到了 webpack 的一个 compiler 实例对象（后续我们会介绍 webpack 的 Compiler），判断当前是否是 watch 方式，是的话就调用 compiler 实例上的 watch 方法来运行，否则调用 run 方法来运行，也就是开始了真正的打包构建流程。

总结下，webpack-cli  主要的作用就是：

1. 引入 yargs，提供一个交互式命令行工具

2. 对配置文件和命令行参数进行转换，最终生成配置选项参数；

3. 然后根据配置实例化 webpack 对象，然后执行构建流程。

在下一篇我们继续分析 webpack 中的构建机制。
