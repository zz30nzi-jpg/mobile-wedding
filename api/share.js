const { SUPABASE_URL, SITE_CARD_SLUG, normalizeSlug, invitationPath, fetchPublicInvitationContent } = require("./_lib/public-invitation");

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
  const raw = String(value || "");
  // 캐시버스트용 ?v= 쿼리는 객체 키에서 분리한 뒤, 완성된 URL에 그대로 다시 붙입니다.
  const queryIndex = raw.indexOf("?");
  const clean = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = queryIndex >= 0 ? raw.slice(queryIndex) : "";
  if (!/^invitations\/[^/]+\//.test(clean)) return raw;
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/invitation-media/${encodeURIComponent(clean).replace(/%2F/g, "/")}${query}`;
}

module.exports = async function sharePage(request, response) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const requestUrl = new URL(request.url || "/", `${protocol}://${host}`);
  const slug = normalizeSlug(requestUrl.searchParams.get("card") || requestUrl.searchParams.get("invitation") || SITE_CARD_SLUG) || SITE_CARD_SLUG;
  // 받는 분 이름(?to=)은 청첩장으로 그대로 넘겨 봉투에 "to. 이름"으로 보이게 함 → /청첩장주소/받는분
  const mainUrl = `${protocol}://${host}${invitationPath(slug, requestUrl.searchParams.get("to"))}`;
  let invitation = {};

  try {
    invitation = (await fetchPublicInvitationContent(slug)) || {};
  } catch {
    invitation = {};
  }

  const hasInvitation = invitation && Object.keys(invitation).length > 0;
  const title = hasInvitation ? (invitation.meta?.title || "모바일 청첩장") : "청첩장을 확인할 수 없습니다";
  const description = hasInvitation
    ? (String(invitation.meta?.description || "").trim() || `${invitation.wedding?.displayDate || ""} · ${invitation.wedding?.venue || ""}`.replace(/^ · | · $/g, "")).slice(0, 180)
    : "청첩장 주소를 다시 확인해 주세요.";
  const image = mediaPublicUrl(invitation.meta?.shareImage || invitation.hero?.image || "");
  const imageMeta = image ? `
    <meta property="og:image" content="${escapeAttribute(image)}">
    <meta property="og:image:secure_url" content="${escapeAttribute(image)}">
    <meta property="og:image:type" content="image/webp">
    <meta property="og:image:width" content="600">
    <meta property="og:image:height" content="800">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeAttribute(image)}">
    <meta name="twitter:image:width" content="600">
    <meta name="twitter:image:height" content="800">` : "";

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
