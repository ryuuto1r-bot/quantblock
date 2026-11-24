import http from 'node:http';
import { handleApiRequest } from './apiHandler.mjs';

const PORT = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[QuantBlock API] listening on http://localhost:${PORT}`);
});
