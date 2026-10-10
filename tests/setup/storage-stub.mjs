// Object-storage stand-in for the e2e commerce spec (invoice PDF upload): 200 to PUT/HEAD/GET + permissive CORS.
import process from "node:process";
import { createServer } from "node:http";

createServer((req, res) => {
  res.writeHead(req.method === "OPTIONS" ? 204 : 200, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "PUT, HEAD, GET, OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "etag",
    etag: '"stub"',
  });
  req.resume();
  res.end();
}).listen(Number(process.env.STORAGE_STUB_PORT ?? 9100), "127.0.0.1");
