import http from 'http';

const proxy = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 5432,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

proxy.listen(3000, '0.0.0.0', () => {
  console.log('Dual-port proxy active: forwarding http://localhost:3000 -> http://localhost:5432');
});
