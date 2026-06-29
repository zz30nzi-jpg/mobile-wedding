const fs = require("fs");
const path = require("path");

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac"]);

// source/music 폴더는 정적 에셋이라 함수 번들 위치가 환경마다 다릅니다.
// 가능한 경로를 차례로 시도해 실제 폴더를 찾습니다. (vercel.json includeFiles 참고)
function resolveMusicDir() {
  const candidates = [
    path.join(process.cwd(), "source", "music"),
    path.join(__dirname, "..", "source", "music"),
    path.join("/var/task", "source", "music"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // 무시하고 다음 후보 시도
    }
  }
  return "";
}

module.exports = async function musicList(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  try {
    const dir = resolveMusicDir();
    if (!dir) {
      response.status(200).send(JSON.stringify({ status: "ok", files: [] }));
      return;
    }
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({ name: entry.name, src: `source/music/${entry.name}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    response.status(200).send(JSON.stringify({ status: "ok", files }));
  } catch (error) {
    response.status(200).send(JSON.stringify({ status: "error", files: [], message: String((error && error.message) || error) }));
  }
};
