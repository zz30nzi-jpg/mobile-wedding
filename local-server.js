const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5500);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
};

const apiRoot = path.join(root, "api");

// Vercel 서버리스 함수(api/*.js)를 로컬에서도 호출할 수 있게 최소한의 라우팅을 제공합니다.
async function handleApi(request, response, pathname) {
  const name = pathname.slice("/api/".length);
  const handlerPath = path.resolve(apiRoot, `${name}.js`);
  if (!handlerPath.startsWith(apiRoot) || !fs.existsSync(handlerPath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  // Vercel 스타일 응답 헬퍼(status/send/json)를 흉내 냅니다.
  response.status = (code) => { response.statusCode = code; return response; };
  response.send = (body) => { response.end(body); return response; };
  response.json = (payload) => {
    if (!response.headersSent) response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
    return response;
  };
  try {
    const handler = require(handlerPath);
    await handler(request, response);
  } catch (error) {
    if (!response.headersSent) response.writeHead(500);
    response.end(`Server error: ${(error && error.message) || error}`);
  }
}

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (pathname.startsWith("/api/")) {
    handleApi(request, response, pathname);
    return;
  }
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const contentType = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  const size = fs.statSync(filePath).size;
  // Audio/video players (Safari especially) require byte-range responses.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }
    response.writeHead(206, { "Content-Type": contentType, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" });
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, { "Content-Type": contentType, "Content-Length": size, "Accept-Ranges": "bytes" });
  fs.createReadStream(filePath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Wedding invitation server running on port ${port}`);
});
