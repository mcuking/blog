let express = require('express');
let app = express();
let whitList = ['http://localhost:3001'];
app.use(function(req, res, next) {
  let origin = req.headers.origin;
  if (whitList.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // 设置请求头中可以携带的字段
    res.setHeader('Access-Control-Allow-Headers', 'name');
    // 设置哪些请求方法可以访问
    res.setHeader('Access-Control-Allow-Methods', 'PUT');
    // 指定本次预检请求的有效期,单位为秒,,在此期间不用发出另一条预检请求
    res.setHeader('Access-Control-Max-Age', 6000);
    // 允许请求头中可以携带 cookie
    res.setHeader('Access-Control-Allow-Credentials', true);
    // 设置返回头中可以获取的字段
    res.setHeader('Access-Control-Expose-Headers', 'name');

    if (req.method === 'OPTIONS') {
      res.end(); // OPTIONS 请求不做任何处理
    }
  }
  next();
});
app.put('/getData', function(req, res) {
  res.setHeader('name', 'lili');
  res.end('我不爱你');
});
app.listen(3002);
