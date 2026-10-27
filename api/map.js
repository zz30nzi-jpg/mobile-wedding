// 카카오톡 공유의 "위치 보기" 버튼용: 카카오 공유 링크는 등록된 도메인으로만 연결되므로,
// 우리 도메인의 이 주소를 거쳐 청첩장에 저장된 예식장 주소의 지도 검색으로 바로 넘겨 줍니다.
const { SITE_CARD_SLUG, normalizeSlug, invitationPath, fetchPublicInvitationContent } = require("./_lib/public-invitation");

function mapUrl(app, query) {
  const encoded = encodeURIComponent(query);
  if (app === "naver") return `https://map.naver.com/p/search/${encoded}`;
  return `https://map.kakao.com/link/search/${encoded}`;
}

module.exports = async function mapRedirect(request, response) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const requestUrl = new URL(request.url || "/", `${protocol}://${host}`);
  const slug = normalizeSlug(requestUrl.searchParams.get("card") || SITE_CARD_SLUG) || SITE_CARD_SLUG;
  const app = requestUrl.searchParams.get("app") === "naver" ? "naver" : "kakao";
  const fallback = `${protocol}://${host}${invitationPath(slug)}#location`;
  let target = fallback;
  try {
    const wedding = (await fetchPublicInvitationContent(slug))?.wedding || {};
    const query = String(wedding.address || wedding.venue || "").trim();
    if (query) target = mapUrl(app, query);
  } catch {
    target = fallback;
  }
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Location", target);
  response.status(302).send("");
};
