// api/share.js·api/map.js 공용: 공개 청첩장 조회 (밑줄로 시작하는 파일은 Vercel 함수로 배포되지 않음)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";

// 주소에 ?card= 가 없을 때 여는 청첩장 (rsvp-storage.js SITE_CARD_SLUG 와 같게 유지)
const SITE_CARD_SLUG = "main";

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

// 공개 상태("ok")인 청첩장의 content를 돌려줍니다. 없거나 비공개면 null, 네트워크 오류는 throw.
async function fetchPublicInvitationContent(slug) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_invitation`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ invitation_slug: slug }),
  });
  if (!result.ok) return null;
  const invitation = (await result.json())[0] || {};
  return invitation.status === "ok" ? invitation.content || null : null;
}

module.exports = { SUPABASE_URL, SITE_CARD_SLUG, normalizeSlug, fetchPublicInvitationContent };
