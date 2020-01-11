const http = require('http');
const allowOrigin = require('./allowOrigin');

http
  .createServer(function(request, response) {
    console.log('request come', request.headers.origin);

    if (allowOrigin.includes(request.headers.origin)) {
      response.writeHead(200, {
        'Access-Control-Allow-Origin': request.headers.origin,
        'Access-Control-Allow-Methods': 'PUT, POST, DELETE',
        'Access-Control-Allow-Headers': 'X-Test-Cors',
        'Access-Control-Max-Age': '1000'
      });
    }

    response.end('I am from 8887');
  })
  .listen(8887);

console.log('server listening on 8887');
