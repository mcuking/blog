const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    if (request.url === '/') {
      response.writeHead(302, {
        Location: '/new'
      });
      response.end('');
    }

    if (request.url === '/new') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html'
      });
      response.end(html);
    }
  })
  .listen(8888);
