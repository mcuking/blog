const fs = require('fs');
const path = require('path');

module.exports = {
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
