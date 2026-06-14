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

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

module.exports = async function sharePage(request, response) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const requestUrl = new URL(request.url || "/", `${protocol}://${host}`);
  const slug = normalizeSlug(requestUrl.searchParams.get("card") || requestUrl.searchParams.get("invitation") || "main") || "main";
  const mainUrl = slug !== "main" ? `${protocol}://${host}/index.html?card=${encodeURIComponent(slug)}` : `${protocol}://${host}/`;
  let invitation = {};

  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_invitation`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invitation_slug: slug }),
    });
    if (result.ok) {
      const publicInvitation = (await result.json())[0] || {};
      if (publicInvitation.status === "ok" && publicInvitation.content) invitation = publicInvitation.content;
    }
  } catch {
    invitation = {};
  }

  const hasInvitation = invitation && Object.keys(invitation).length > 0;
  const title = hasInvitation ? (invitation.meta?.title || "모바일 청첩장") : "청첩장을 확인할 수 없습니다";
  const description = hasInvitation
    ? `${invitation.wedding?.displayDate || ""} · ${invitation.wedding?.venue || ""}`.replace(/^ · | · $/g, "").slice(0, 180)
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
