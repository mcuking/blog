> 文章首发于我的博客 https://github.com/mcuking/blog/issues/77

> 相关源码请查阅  https://github.com/mcuking/blog/tree/master/mini-pack

## 什么是 webpack

> 本质上，webpack 是一个现代 JavaScript 应用程序的静态模块打包器(module bundler)。当 webpack 处理应用程序时，它会递归地构建一个依赖关系图(dependency graph)，其中包含应用程序需要的每个模块，然后将所有这些模块打包成一个或多个 bundle。
>
> webpack 就像一条生产线，要经过一系列处理流程后才能将源文件转换成输出结果。 这条生产线上的每个处理流程的职责都是单一的，多个流程之间有存在依赖关系，只有完成当前处理后才能交给下一个流程去处理。 插件就像是一个插入到生产线中的一个功能，在特定的时机对生产线上的资源做处理。webpack 通过 Tapable 来组织这条复杂的生产线。 webpack 在运行过程中会广播事件,插件只需要监听它所关心的事件，就能加入到这条生产线中，去改变生产线的运作。 webpack 的事件流机制保证了插件的有序性，使得整个系统扩展性很好。
>
 >-- 深入浅出 webpack 吴浩麟

## Webpack 运行机制

整个运行机制是串行的，从启动到结束会依次执行以下流程 :

1. 初始化参数：从配置文件和 Shell 语句中读取与合并参数，得出最终的参数；

2. 开始编译：用上一步得到的参数初始化 Compiler 对象，加载所有配置的插件，执行对象的 run 方法开始执行编译；

3. 确定入口：根据配置中的 entry 找出所有的入口文件；

4. 编译模块：从入口文件出发，调用所有配置的 Loader 对模块进行翻译，再找出该模块依赖的模块，再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理；

5. 完成模块编译：在经过第 4 步使用 Loader 翻译完所有模块后，得到了每个模块被翻译后的最终内容以及它们之间的依赖关系；

6. 输出资源：根据入口和模块之间的依赖关系，组装成一个个包含多个模块的 Chunk，再把每个 Chunk 转换成一个单独的文件加入到输出列表，这步是可以修改输出内容的最后机会；

7. 输出完成：在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统。

在以上过程中，Webpack 会在特定的时间点广播出特定的事件，插件在监听到感兴趣的事件后会执行特定的逻辑，并且插件可以调用 Webpack 提供的 API 改变 Webpack 的运行结果

## 实现一个 mini-pack

首先需要明确 mini-pack 要实现的目标：

将 src 中 js 代码编译成 es5 版本，并打包成一个 bundle js（注意：只关注 js）。

下面我们根据刚才对 webpack 运行机制的阐述，逐步实现 mini-pack：

1.首先支持定义类似 webpack.config.js 文件，可命名为 minipack.config.js，文件内定义 output、entry 等参数，如下面所示：

```js
const path = require('path');

module.exports = {
  entry: path.join(__dirname, './src/index.js'),
  output: {
    path: path.join(__dirname, './dist'),
    filename: 'main.js'
  }
};
```

2.然后进入编译阶段：根据 minipack.config.js 定义的参数，初始化一个 Compiler 参数，并执行 run 方法。

index.js
```js
const Compiler = require('./compiler');
const options = require('../minipack.config');

// 根据 minipack.config.js 配置的参数，初始化 Compiler 对象，并启动编译
new Compiler(options).run();
```

compiler.js
```js
const { getAST, getDependencies, transform } = require('./utils');
const path = require('path');

module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    // 打包入口
    this.entry = entry;
    // 出口
    this.output = output;
    // 模块集
    this.modules = [];
  }

  // 启动构建
  run() {
    const entryModule = this.buildModule(this.entry, true);

    this.modules.push(entryModule);
  }

  // 编译单个模块
  buildModule(filename, isEntry) {
    let ast;

    ast = getAST(filename);

    return {
      filename,
      source: transform(ast),
      dependencies: getDependencies(ast)
    };
  }

  // 将编译的 js 模块输出到指定目录中
  emitFiles() {}
};
```
此步骤就是将入口 js 文件编译成 module 对象，格式如下：

```js
{
  filename  // 文件名
  source  // 代码
  dependencies  // 依赖文件，即该模块引入的其他模块
}
```

其中编译方法 getAST、转换ast 到 code 的方法 transform、以及获取模块依赖方法 getDependencies 均单独封装在一个 utils 文件中。

```js
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformFromAst } = require('@babel/core');

module.exports = {
  // 将路径对应的文件js代码编译成 ast
  getAST(path) {
    const content = fs.readFileSync(path, 'utf-8');
    return parse(content, {
      sourceType: 'module'
    });
  },

  // 通过 babel-traverse 遍历所有节点
  // 并根据 ImportDeclaration 节点来收集一个模块的依赖
  getDependencies(ast) {
    const dependencies = [];
    traverse(ast, {
      ImportDeclaration({ node }) {
        dependencies.push(node.source.value);
      }
    });
    return dependencies;
  },

  // 将转化后 ast 的代码重新转化成代码
  // 并通过配置 @babel/preset-env 预置插件编译成 es5
  transform(ast) {
    const { code } = transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    });
    return code;
  }
};
```

3.确定入口，根据配置中的 entry 找出所有的入口文件，上面已经实现了对 entry 文件的编译。

4.从入口文件出发，对模块进行编译（这里并不打算支持运行 loader），再找出该模块依赖的模块，再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理。也就是说通过 babel-traverse 工具遍历这个模块 ast 上的 ImportDeclaration 节点（对应代码中 import），查找这个模块所有的 import 的其他模块，然后以递归的方式编译其他模块，重复刚才的操作。新增代码如下：

compiler.js
```js
module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    // 打包入口
    this.entry = entry;
    // 出口
    this.output = output;
    // 模块集
    this.modules = [];
  }

  // 启动构建
  run() {
    this.buildModule(this.entry, true);

    this.emitFiles();
  }

  // 递归调用直至编译所有被引用模块
  buildModule(filename, isEntry) {
    const _module = this.build(filename, isEntry);

    this.modules.push(_module);

    _module.dependencies.forEach(dependency => {
      this.buildModule(dependency, false);
    });
  }

  // 编译单个模块
  build(filename, isEntry) {
    let ast;

    if (isEntry) {
      ast = getAST(filename);
    } else {
      const absolutePath = path.join(process.cwd(), './src', filename);
      ast = getAST(absolutePath);
    }

    return {
      filename,
      source: transform(ast),
      dependencies: getDependencies(ast)
    };
  }

  // 将编译的 js 模块输出到指定目录中
  emitFiles() {}
};
```

5.完成模块编译，上面的代码已经实现了递归编译所有被引用的模块。

6.输出资源，这里 mini-pack 准备将所有模块打包放入一个文件里，并非像 webpack 那样组装成一个个包含多个模块的 Chunk，再把每个 Chunk 转换成一个单独的文件加入到输出列表。

既然要将所有模块的代码打包进一个文件中，那么势必会导致命名冲突问题，为了保证各个模块互不影响，可以将不同模块分别用一个函数来包裹下（利用 js 函数作用域）。那么又会存在另一个问题--模块之间的引用问题。对此我们可以自定义 require 函数，用来引用其他模块的变量或方法，然后将自定义的 require 方法以参数的形式传入刚刚的包裹函数中，以供模块中代码调用。具体模式如下：

```js
(function(modules) {
  function require(filename) {
    var fn = modules[filename];
    var module = { exports: {} };

    fn(require, module, module.exports);
    return module.exports;
  }

  return require('./entry');
})({
  './entry': function(require, module, exports) {
      var addModule = require("./add");
      console.log(addModule.add(1, 1));
  },
  './add': function(require, module, exports) {
      module.exports = {
        add: function(x, y) {
            return x + y;
        }
      }
  }
});
```

因此代码可继续完善如下：

```js
module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    // 打包入口
    this.entry = entry;
    // 出口
    this.output = output;
    // 模块集
    this.modules = [];
  }

  // 启动构建
  run() {
    this.buildModule(this.entry, true);

    this.emitFiles();
  }

  // 递归调用直至编译所有被引用模块
  buildModule(filename, isEntry) {
    // 同上
  }

  // 编译单个模块
  build(filename, isEntry) {
    // 同上
  }

  // 将编译的 js 模块输出到指定目录中
  emitFiles() {
    // 将所有模块代码分别放入一个函数中（利用函数作用域实现作用域隔离，避免变量冲突）
    // 同时实现一个 require 方法已实现从其他模块中引入需要的变量或方法
    let modules = '';

    this.modules.forEach(_module => {
      modules += `'${_module.filename}': function(require, module, exports) {${_module.source}},`;
    });

    const bundle = `(function(modules) {
      function require(filename) {
        var fn = modules[filename];
        var module = {exports: {}};

        fn(require, module, module.exports);
        return module.exports;
      }

      return require('${this.entry}')
    })({${modules}})`;
  
  }
};
```

7.输出完成：在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统。即通过 fs 模块将编译后大代码输出到指定目录中。代码如下：

```js
module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    // 打包入口
    this.entry = entry;
    // 出口
    this.output = output;
    // 模块集
    this.modules = [];
  }

  // 启动构建
  run() {
    this.buildModule(this.entry, true);

    this.emitFiles();
  }

  // 递归调用直至编译所有被引用模块
  buildModule(filename, isEntry) {
    // 同上
  }

  // 编译单个模块
  build(filename, isEntry) {
    // 同上
  }

  // 将编译的 js 模块输出到指定目录中
  emitFiles() {
    // 将所有模块代码分别放入一个函数中（利用函数作用域实现作用域隔离，避免变量冲突）
    // 同时实现一个 require 方法已实现从其他模块中引入需要的变量或方法
    let modules = '';

    this.modules.forEach(_module => {
      modules += `'${_module.filename}': function(require, module, exports) {${_module.source}},`;
    });

    const bundle = `(function(modules) {
      function require(filename) {
        var fn = modules[filename];
        var module = {exports: {}};

        fn(require, module, module.exports);
        return module.exports;
      }

      return require('${this.entry}')
    })({${modules}})`;

    // 将编译后的代码写入到 output 指定的目录
    const distPath = path.join(process.cwd(), './dist');
    if (fs.existsSync(distPath)) {
      removeDir(distPath);
    }

    fs.mkdirSync(distPath);

    const outputPath = path.join(this.output.path, this.output.filename);
    fs.writeFileSync(outputPath, bundle, 'utf-8');

    // 将编译后的 js 插入 html 中，并写入到 output 指定的目录
    this.emitHtml();
  }

  // 将 html 插入 script 标签（引入打包后的 bundle js），并输出到指定目录中
  emitHtml() {
    const publicHtmlPath = path.join(process.cwd(), './public/index.html');
    let html = fs.readFileSync(publicHtmlPath, 'utf-8');
    html = html.replace(
      /<\/body>/,
      `  <script type="text/javascript" src="./main.js"></script>
  </body>`
    );

    const distHtmlPath = path.join(process.cwd(), './dist/index.html');
    fs.writeFileSync(distHtmlPath, html, 'utf-8');
  }
};
```

在此过程中，Webpack 会在特定的时间点广播出特定的事件，以便通知相应插件执行指定任务改变打包结果。对此，并不在 mini-pack 最初的设定功能方位，因此到此为止，封装已经完成。下面是 Compiler 的完整代码：

```js
const path = require('path');
const fs = require('fs');
const { getAST, getDependencies, transform, removeDir } = require('./utils');

module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    // 打包入口
    this.entry = entry;
    // 出口
    this.output = output;
    // 模块集
    this.modules = [];
  }

  // 启动构建
  run() {
    this.buildModule(this.entry, true);

    this.emitFiles();
  }

  // 递归调用直至编译所有被引用模块
  buildModule(filename, isEntry) {
    const _module = this.build(filename, isEntry);

    this.modules.push(_module);

    _module.dependencies.forEach(dependency => {
      this.buildModule(dependency, false);
    });
  }

  // 编译单个模块
  build(filename, isEntry) {
    let ast;

    if (isEntry) {
      ast = getAST(filename);
    } else {
      const absolutePath = path.join(process.cwd(), './src', filename);
      ast = getAST(absolutePath);
    }

    return {
      filename,
      source: transform(ast),
      dependencies: getDependencies(ast)
    };
  }

  // 将编译的 js 模块输出到指定目录中
  emitFiles() {
    // 将所有模块代码分别放入一个函数中（利用函数作用域实现作用域隔离，避免变量冲突）
    // 同时实现一个 require 方法已实现从其他模块中引入需要的变量或方法
    let modules = '';

    this.modules.forEach(_module => {
      modules += `'${_module.filename}': function(require, module, exports) {${_module.source}},`;
    });

    const bundle = `(function(modules) {
      function require(filename) {
        var fn = modules[filename];
        var module = {exports: {}};

        fn(require, module, module.exports);
        return module.exports;
      }

      return require('${this.entry}')
    })({${modules}})`;

    // 将编译后的代码写入到 output 指定的目录
    const distPath = path.join(process.cwd(), './dist');
    if (fs.existsSync(distPath)) {
      removeDir(distPath);
    }

    fs.mkdirSync(distPath);

    const outputPath = path.join(this.output.path, this.output.filename);
    fs.writeFileSync(outputPath, bundle, 'utf-8');

    // 将编译后的 js 插入 html 中，并写入到 output 指定的目录
    this.emitHtml();
  }

  // 将 html 插入 script 标签（引入打包后的 bundle js），并输出到指定目录中
  emitHtml() {
    const publicHtmlPath = path.join(process.cwd(), './public/index.html');
    let html = fs.readFileSync(publicHtmlPath, 'utf-8');
    html = html.replace(
      /<\/body>/,
      `  <script type="text/javascript" src="./main.js"></script>
  </body>`
    );

    const distHtmlPath = path.join(process.cwd(), './dist/index.html');
    fs.writeFileSync(distHtmlPath, html, 'utf-8');
  }
};
```
