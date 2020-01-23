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
