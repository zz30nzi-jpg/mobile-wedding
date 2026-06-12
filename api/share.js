const SUPABASE_URL = process.env.SUPABASE_URL || "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";

function escapeAttribute(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function mediaPublicUrl(value = "") {
  const path = String(value || "");
  if (!/^invitations\/[^/]+\//.test(path)) return path;
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/invitation-media/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}

module.exports = async function sharePage(request, response) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const mainUrl = `${protocol}://${host}/`;
  let invitation = {};

  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/invitation_settings?id=eq.main&select=content`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (result.ok) invitation = (await result.json())[0]?.content || {};
  } catch {
    invitation = {};
  }

  const title = invitation.meta?.title || "조성호 ♥ 전지연 결혼합니다";
  const invitationText = invitation.invitation?.paragraphs?.join(" ") || "소중한 분들을 초대합니다.";
  const description = `${invitation.wedding?.displayDate || "2026. 10. 04. 일요일 오후 12시 20분"} · ${invitation.wedding?.venue || "그랜드 머큐어 앰배서더 창원 2F 그랜드볼룸홀"} · ${invitationText}`.slice(0, 180);
  const image = mediaPublicUrl(invitation.meta?.shareImage || invitation.hero?.image || "");
  const imageMeta = image ? `
    <meta property="og:image" content="${escapeAttribute(image)}">
    <meta property="og:image:width" content="600">
    <meta property="og:image:height" content="800">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeAttribute(image)}">` : "";

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeAttribute(title)}">
    <meta property="og:description" content="${escapeAttribute(description)}">
    <meta property="og:url" content="${escapeAttribute(mainUrl)}">
    ${imageMeta}
    <meta http-equiv="refresh" content="0; url=${escapeAttribute(mainUrl)}">
    <title>${escapeAttribute(title)}</title>
  </head>
  <body>
    <script>location.replace(${JSON.stringify(mainUrl)});</script>
    <a href="${escapeAttribute(mainUrl)}">청첩장 보기</a>
  </body>
</html>`);
};
