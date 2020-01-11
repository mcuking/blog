const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Security-Policy':
          "script-src 'self'; connect-src 'self'; form-action 'self'"
      });
      response.end(html);
    }

    if (request.url === '/script.js') {
      const logJs = fs.readFileSync('log.js');
      response.writeHead(200, {
        'Content-Type': 'text/javacript'
      });
      response.end(logJs);
    }
  })
  .listen(8888);
