const Compiler = require('./compiler');
const options = require('../minipack.config');

// 根据 minipack.config.js 配置的参数，初始化 Compiler 对象，并启动编译
new Compiler(options).run();
