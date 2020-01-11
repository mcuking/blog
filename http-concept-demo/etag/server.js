const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html'
      });
      response.end(html);
    }

    if (request.url === '/script.js') {
      const Etag = '2e681a-6-5d044840';
      const IfNoneMatch = request.headers['if-none-match'];

      if (IfNoneMatch === Etag) {
        response.writeHead(304, {
          'Content-Type': 'text/javacript',
          'Cache-Control': 'max-age=31536000, no-cache',
          Etag: Etag
        });
        response.end('');
      } else {
        const logJs = fs.readFileSync('log.js');
        response.writeHead(200, {
          'Content-Type': 'text/javacript',
          'Cache-Control': 'max-age=31536000, no-cache',
          Etag: Etag
        });
        response.end(logJs);
      }
    }
  })
  .listen(8888);
