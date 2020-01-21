const { getAST, getDependencies, transform } = require('./parser');
const path = require('path');
const fs = require('fs');
const { removeDir } = require('./utils');

module.exports = class Compiler {
  constructor(options) {
    const { entry, output } = options;
    this.entry = entry;
    this.output = output;
    this.modules = [];
  }

  run() {
    const entryModule = this.buildModule(this.entry, true);

    this.modules.push(entryModule);

    this.modules.forEach(_module => {
      _module.dependencies.forEach(dependency => {
        this.modules.push(this.buildModule(dependency, false));
      });
    });

    this.emitFiles();
  }

  buildModule(filename, isEntry) {
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

  emitFiles() {
    // 将所有模块代码通过塞入
    let modules = '';

    this.modules.forEach(_module => {
      modules += `'${_module.filename}': function(require, module, exports) {${_module.source}},`;
    });

    const bundle = `(function(modules) {
      function require(filename) {
        var fn = modules[filename];
        var module = {exports: {}};

        fn(require, modules, module.exports);
        return module.exports;
      }

      return require('${this.entry}')
    })({${modules}})`;

    // 将编译后的代码写入到 output 指定的目录
    const distPath = path.join(process.cwd(), '../dist');
    if (fs.existsSync(distPath)) {
      removeDir(distPath);
    }
    fs.mkdirSync(distPath);
    const outputPath = path.join(this.output.path, this.output.filename);
    fs.writeFileSync(outputPath, bundle, 'utf-8');

    // 将编译后的 js 插入 html 中，并写入到 output 指定的目录
    this.emitHtml();
  }

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
