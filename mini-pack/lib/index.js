const Compiler = require('./compiler');
const options = require('../minipack.config');

new Compiler(options).run();
