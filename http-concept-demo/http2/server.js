const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html'
        // Connection: 'close'
      });
      response.end(html);
    }

    if (request.url.indexOf('/flutter') > -1) {
      const img = fs.readFileSync('flutter.png');
      response.writeHead(200, {
        'Content-Type': 'image/png'
        // Connection: 'close'
      });
      response.end(img);
    }
  })
  .listen(8888);
