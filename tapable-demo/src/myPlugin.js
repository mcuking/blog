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
