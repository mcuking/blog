const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    console.log('request come:', request.url);
    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html'
      });
      response.end(html);
    }

    if (request.url === '/script.js') {
      const LastModified = 'Sun, 24 Mar 2019 07:28:00 GMT';
      const IfModifiedSince = request.headers['if-modified-since'];

      if (IfModifiedSince === LastModified) {
        response.writeHead(304, {
          'Content-Type': 'text/javacript',
          'Cache-Control': 'max-age=31536000, no-cache',
          'Last-Modified': LastModified
        });
        response.end('');
      } else {
        const logJs = fs.readFileSync('log.js');
        response.writeHead(200, {
          'Content-Type': 'text/javacript',
          'Cache-Control': 'max-age=31536000, no-cache',
          'Last-Modified': LastModified
        });
        response.end(logJs);
      }
    }
  })
  .listen(8888);
