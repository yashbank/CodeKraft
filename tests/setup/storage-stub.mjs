// Object-storage stand-in for the e2e specs: remembers PUT bodies so HEAD/GET (and ranged GET) see the
// real size, type and bytes of what the browser uploaded; any path never PUT answers 200 with an empty
// body (the invoice PDF upload spec relies on that). Permissive CORS.
import process from "node:process";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";

/** @type {Map<string, {body: Buffer, type: string}>} */
const objects = new Map();
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, HEAD, GET, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "etag, content-length, content-range",
  etag: '"stub"',
};

createServer((req, res) => {
  const key = (req.url ?? "").split("?")[0] ?? "";
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      objects.set(key, {
        body: Buffer.concat(chunks),
        type: String(req.headers["content-type"] ?? "application/octet-stream"),
      });
      res.writeHead(200, CORS);
      res.end();
    });
    return;
  }
  req.resume();
  const obj = objects.get(key);
  if (!obj) {
    res.writeHead(200, CORS);
    return res.end();
  }
  const head = { ...CORS, "content-type": obj.type };
  if (req.method === "HEAD") {
    res.writeHead(200, { ...head, "content-length": obj.body.length });
    return res.end();
  }
  const range = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (range) {
    const start = Number(range[1]);
    const end = Math.min(range[2] ? Number(range[2]) : obj.body.length - 1, obj.body.length - 1);
    const part = obj.body.subarray(start, end + 1);
    res.writeHead(206, {
      ...head,
      "content-length": part.length,
      "content-range": `bytes ${start}-${end}/${obj.body.length}`,
    });
    return res.end(part);
  }
  res.writeHead(200, { ...head, "content-length": obj.body.length });
  res.end(obj.body);
}).listen(Number(process.env.STORAGE_STUB_PORT ?? 9100), "127.0.0.1");
