const http = require('http');
const fs = require('fs');

const wait = seconds => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, seconds * 1000);
  });
};

http
  .createServer(function(request, response) {
    console.log('request come from: ', request.url);

    if (request.url === '/') {
      const html = fs.readFileSync('index.html', 'utf8');
      response.writeHead(200, {
        'Content-Type': 'text/html'
      });
      response.end(html);
    }

    if (request.url === '/data') {
      response.writeHead(200, {
        'Cache-Control': 'max-age=5, s-maxage=20'
        // 'Cache-Control': 'max-age=5, s-maxage=20, private',
        // 'Cache-Control': 'max-age=5, s-maxage=20, no-store'
      });

      wait(2).then(() => response.end('I am data'));
    }
  })
  .listen(8888);
