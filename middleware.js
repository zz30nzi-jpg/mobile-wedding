// Vercel Routing Middleware: 청첩장 HTML을 보내기 전에 그 청첩장 테마의 배경색을 끼워 넣어,
// 처음 방문한 사람도 기본(하늘색)·흰 화면 없이 바로 테마 색으로 시작하게 합니다.
// 같은 정보로 공유 미리보기(og 제목·설명·사진)도 넣습니다. 카카오톡 등은 스크립트를 실행하지 않고
// 처음 받은 HTML만 읽으므로, 여기서 넣지 않으면 링크를 붙여 넣었을 때 사진 없이 '모바일 청첩장'으로만 보입니다.
// 색은 관리자 저장 시 content.appearance.bootBackground 로 저장됩니다(rsvp-storage.js 참고).
// 어떤 이유로든 실패하면 아무것도 바꾸지 않고 원래 index.html을 그대로 내보냅니다.
const SUPABASE_URL = "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";
const DEFAULT_BOOT_BG = "#eee8e1";
// 주소에 ?card= 가 없을 때 여는 청첩장 (rsvp-storage.js SITE_CARD_SLUG 와 같게 유지)
const SITE_CARD_SLUG = "main";
// 기본 제공 테마의 배경색(styles.css body[data-theme] --body-bg). 저장된 bootBackground가 없을 때 사용
const BUILT_IN_THEME_BG = { sky: "#eff7fa", beige: "#eee8e1", pink: "#fdf0f4", gray: "#edf0f2", black: "#15191c", white: "#f7f7f7", green: "#edf3ea" };

export const config = { matcher: ["/", "/index.html"] };

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

// 같은 서버 인스턴스가 살아 있는 동안 결과를 잠시 기억해 매 요청마다 왕복하지 않게 함
// (테마를 바꾸면 최대 1분 뒤 반영 — 그 사이에도 브라우저의 마지막 테마 색이 쓰임)
const BOOT_BG_TTL = 60 * 1000;
const RAW_HTML_TTL = 5 * 60 * 1000;
const invitationMetaCache = new Map();
let rawHtmlCache = null;

async function cachedInvitationMeta(slug) {
  const hit = invitationMetaCache.get(slug);
  if (hit && Date.now() - hit.at < BOOT_BG_TTL) return hit.meta;
  const meta = await fetchInvitationMeta(slug);
  if (meta) invitationMetaCache.set(slug, { meta, at: Date.now() });
  return meta;
}

function escapeAttribute(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

// 저장소 경로(invitations/...)를 공개 주소로. ?v= 캐시버스트는 그대로 붙임 (api/share.js와 같은 규칙)
function mediaPublicUrl(value = "") {
  const raw = String(value || "");
  const queryIndex = raw.indexOf("?");
  const clean = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = queryIndex >= 0 ? raw.slice(queryIndex) : "";
  if (/^https:\/\//i.test(clean)) return raw;
  if (!/^invitations\/[^/]+\//.test(clean)) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/invitation-media/${encodeURIComponent(clean).replace(/%2F/g, "/")}${query}`;
}

async function cachedRawHtml(origin) {
  if (rawHtmlCache && rawHtmlCache.origin === origin && Date.now() - rawHtmlCache.at < RAW_HTML_TTL) return rawHtmlCache.html;
  const rawUrl = new URL("/index.html", origin);
  rawUrl.searchParams.set("__raw", "1");
  const response = await fetch(rawUrl);
  if (!response.ok) return "";
  const html = await response.text();
  rawHtmlCache = { origin, html, at: Date.now() };
  return html;
}

async function fetchInvitationMeta(slug) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600);
  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_invitation`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_slug: slug }),
      signal: controller.signal,
    });
    if (!result.ok) return null;
    const invitation = (await result.json())[0] || {};
    const content = !invitation.status || invitation.status === "ok" ? (invitation.content || {}) : {};
    const appearance = content.appearance || {};
    const themeId = appearance.design?.presetId || appearance.theme || "";
    const color = String(appearance.bootBackground || BUILT_IN_THEME_BG[themeId] || "");
    const description = (String(content.meta?.description || "").trim()
      || [content.wedding?.displayDate, content.wedding?.venue].filter(Boolean).join(" · ")).slice(0, 180);
    return {
      color: /^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s]+\))$/i.test(color) ? color : "",
      title: String(content.meta?.title || "").trim(),
      description,
      image: mediaPublicUrl(content.meta?.shareImage || content.hero?.image || ""),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  // 아래에서 원본 HTML을 가져오는 내부 요청은 그대로 통과
  if (url.searchParams.has("__raw")) return;
  // 관리자 미리보기·레이아웃 썸네일은 원래 동작 유지
  if (url.searchParams.has("copyEditorPreview") || url.searchParams.has("__thumb") || url.searchParams.has("__layout")) return;
  try {
    const slug = normalizeSlug(url.searchParams.get("card") || url.searchParams.get("invitation") || SITE_CARD_SLUG) || SITE_CARD_SLUG;
    const [rawHtml, meta] = await Promise.all([cachedRawHtml(url.origin), cachedInvitationMeta(slug)]);
    if (!rawHtml || !meta) return;
    let html = rawHtml;
    if (meta.color) {
      html = html
        .replace(`var(--boot-bg,${DEFAULT_BOOT_BG})`, `var(--boot-bg,${meta.color})`)
        .replace(`<meta name="theme-color" content="${DEFAULT_BOOT_BG}">`, `<meta name="theme-color" content="${meta.color}">`)
        .replace('<html lang="ko">', '<html lang="ko" data-server-boot-bg>');
    }
    // 공유 미리보기: 제목·설명·주소·대표 사진
    if (meta.title) {
      html = html
        .replace('<meta property="og:title" content="모바일 청첩장">', `<meta property="og:title" content="${escapeAttribute(meta.title)}">`)
        .replace("<title>모바일 청첩장</title>", `<title>${escapeAttribute(meta.title)}</title>`);
    }
    if (meta.description) {
      html = html
        .replace('<meta property="og:description" content="청첩장에 소중한 분들을 초대합니다.">', `<meta property="og:description" content="${escapeAttribute(meta.description)}">`)
        .replace('<meta name="description" content="청첩장에 소중한 분들을 초대합니다.">', `<meta name="description" content="${escapeAttribute(meta.description)}">`);
    }
    const image = meta.image ? escapeAttribute(meta.image) : "";
    html = html.replace('<meta property="og:url" content="">', `<meta property="og:url" content="${escapeAttribute(url.href)}">${image ? `
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${image}">` : ""}`);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" },
    });
  } catch {
    return;
  }
}
