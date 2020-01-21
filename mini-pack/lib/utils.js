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
  },
  // 递归删除文件夹
  removeDir(dir) {
    const files = fs.readdirSync(dir);
    for (file of files) {
      const newPath = path.join(dir, file);
      const stat = fs.statSync(newPath);
      if (stat.isDirectory()) {
        //如果是文件夹就递归下去
        removeDir(newPath);
      } else {
        //删除文件
        fs.unlinkSync(newPath);
      }
    }
    //如果文件夹是空的，就将自己删除掉
    fs.rmdirSync(dir);
  }
};
