const http = require('http');
const fs = require('fs');

http
  .createServer(function(request, response) {
    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': ['id=2323; max-age=6', 'sessionid=hsdfh3; HttpOnly']
      });
      response.end(html);
    }
  })
  .listen(8888);
