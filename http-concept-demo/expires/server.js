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
      const logJs = fs.readFileSync('log.js');
      response.writeHead(200, {
        'Content-Type': 'text/javacript',
        Expires: 'Fri, 11 Jun 2021 11:33:01 GMT'
      });
      response.end(logJs);
    }
  })
  .listen(8888);
