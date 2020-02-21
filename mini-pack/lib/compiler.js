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
