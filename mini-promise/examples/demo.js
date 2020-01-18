const Promise = require('../dist/mini-promise').default;

new Promise((resolve, reject) => resolve(8))
  .then(x => {
    console.log(x);
  })
  .then(() => {
    return 1;
  })
  .then(
    value => {
      console.log(value);
    },
    e => {
      console.log(e + ' hello world');
    }
  );
