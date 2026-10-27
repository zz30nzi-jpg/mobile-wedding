const adminApp = document.querySelector("#admin-app");
const adminUtils = window.WEDDING_UTILS || {};
const sectionRegistry = window.WEDDING_SECTIONS || {};
const escapeAdminHtml = adminUtils.escapeHtml;
const adminMediaUrl = (value = "") => window.RSVP_STORAGE?.mediaPublicUrl?.(value) || value || "";
window.adminMediaUrl = adminMediaUrl;
window.ADMIN_APP_READY = true;
const missingAIService = () => {
  throw new Error("AI 서비스 스크립트를 불러오지 못했습니다.");
};
const storageApi = window.RSVP_STORAGE || {};
let supabaseClient = storageApi.getSupabaseClient?.() || null;
const getAdminSupabaseClient = () => {
  supabaseClient = supabaseClient || window.RSVP_STORAGE?.getSupabaseClient?.() || null;
  return supabaseClient;
};
let invitationData = window.INVITATION_DATA;
window.WEDDING_AI_SETTINGS = () => invitationData?.designSystem?.aiSettings || {};
window.AI_DESIGN_SERVICE = window.createWeddingAIService?.() || {
  generateTransportGuide: missingAIService,
  generateVenueGuide: missingAIService,
};
const themes = ["beige", "sky", "pink", "gray", "black", "white", "green"];
const movieConcepts = ["none"];
const heroDecorations = ["none", "doodle_hearts", "organic_heart", "wedding_rings", "poster_card"];
const heroTextThemes = ["auto", "default_center", "editorial_left", "minimal_center"];
let currentInvitationSite = null;
let passwordRecoveryListenerBound = false;
const GALLERY_MAX = 30;
const SAVED_LOGIN_EMAIL_KEY = "wedding-admin-remembered-email";
const GENERAL_ADMIN_VIEW_KEY = "wedding-general-admin-active-view";
const LOGIN_ID_EMAIL_DOMAIN = "admin.local";
const defaultWelcomeOverlay = {
  eyebrow: "Vivid Vows",
  text: "결혼을 축하드립니다!\n커스텀하여 청첩장을 꾸며보세요.",
  textSize: 30,
  backgroundColor: "#eff7fa",
  cardColor: "#ffffff",
  textColor: "#3b6674",
  overlayOpacity: 94,
  cardOpacity: 88,
  borderColor: "#d8e8ee",
  borderWidth: 1,
  borderRadius: 30,
  shadowEnabled: true,
  shadowColor: "#3b6674",
  shadowOpacity: 24,
};

function notifySaveFailure(error, context = "저장") {
  alert(`${context}하지 못했습니다.\n${error?.message || "네트워크와 관리자 권한 설정을 확인해 주세요."}`);
}

function hasPasswordRecoveryContext() {
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

function normalizeLoginId(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

function loginIdToAuthEmail(value = "") {
  const loginId = normalizeLoginId(value);
  return loginId ? `${loginId}@${LOGIN_ID_EMAIL_DOMAIN}` : "";
}

function loginInputToAuthEmail(value = "") {
  const input = String(value || "").trim();
  if (input.includes("@")) return input.toLowerCase();
  return loginIdToAuthEmail(input);
}

function authEmailToLoginId(value = "") {
  return String(value || "").replace(new RegExp(`@${LOGIN_ID_EMAIL_DOMAIN}$`, "i"), "");
}

function clearAuthUrlState() {
  if (!history.replaceState) return;
  history.replaceState({}, document.title, `${location.origin}${location.pathname}`);
}

function themeWelcomePalette(source = invitationData) {
  const resolved = window.WEDDING_DESIGN?.resolve?.(source);
  const palette = resolved?.palette || source.designSystem?.themes?.find((theme) => theme.id === source.appearance?.design?.presetId)?.palette || {};
  return {
    backgroundColor: palette.background || defaultWelcomeOverlay.backgroundColor,
    cardColor: palette.card || defaultWelcomeOverlay.cardColor,
    textColor: palette.accent || palette.ink || defaultWelcomeOverlay.textColor,
    borderColor: palette.line && /^#/.test(palette.line) ? palette.line : palette.accent || defaultWelcomeOverlay.borderColor,
    shadowColor: palette.accent || palette.ink || defaultWelcomeOverlay.shadowColor,
  };
}

function applyTheme(theme) {
  const selected = themes.includes(theme) ? theme : "sky";
  document.body.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--body-bg").trim());
}

function applyMovieConcept(movieConcept) {
  document.body.dataset.movieConcept = movieConcepts.includes(movieConcept) ? movieConcept : "none";
}

function applyHeroDecoration(heroDecoration) {
  document.body.dataset.heroDecoration = normalizedHeroDecoration(heroDecoration);
}

function applyHeroTextTheme(heroTextTheme) {
  document.body.dataset.heroTextTheme = heroTextThemes.includes(heroTextTheme) ? heroTextTheme : "auto";
}

function applyAppearance(appearance = {}) {
  const legacyPoster = appearance.heroDecoration === "poster";
  applyTheme(appearance.theme);
  applyMovieConcept(appearance.movieConcept);
  applyHeroDecoration(legacyPoster ? "none" : appearance.heroDecoration);
  applyHeroTextTheme(legacyPoster && (!appearance.heroTextTheme || appearance.heroTextTheme === "auto") ? "editorial_left" : appearance.heroTextTheme);
}

// shared-utils.js는 admin.html에서 항상 먼저 로드됩니다(실패 시 부팅 중단).
// rsvp-storage.js가 전역 function dateOnly를 선언하므로 const 대신 function으로 위임합니다.
function formatDate(value) { return adminUtils.formatDate(value); }
function formatBytes(bytes = 0) { return adminUtils.formatBytes(bytes); }
function dateInputToday() { return adminUtils.dateInputToday(); }
function dateOnly(value = "") { return adminUtils.dateOnly(value); }
function addDays(dateValue = "", days = 0) { return adminUtils.addDays(dateValue, days); }

// 예식일·공개 시작일이 바뀌면 공개 기간을 맞추고, 처음 한 번 맞춰 둠
function bindPublicPeriodFields(weddingField, openField, closeField) {
  const sync = (forceCloseToWedding = false) => syncPublicPeriodFields({ weddingField, openField, closeField, forceCloseToWedding });
  weddingField?.addEventListener("change", () => sync(true));
  openField?.addEventListener("change", () => sync(false));
  sync();
}

function syncPublicPeriodFields({ weddingField, openField, closeField, forceCloseToWedding = false } = {}) {
  if (!weddingField || !openField || !closeField) return;
  const today = dateInputToday();
  const weddingDay = dateOnly(weddingField.value);
  openField.min = today;
  openField.max = weddingDay ? addDays(weddingDay, -1) : "";
  if (!openField.value || openField.value < today) openField.value = today;
  if (weddingDay && openField.value > openField.max) openField.value = openField.max;
  closeField.min = openField.value || today;
  closeField.max = weddingDay ? addDays(weddingDay, 3) : "";
  if (weddingDay && (forceCloseToWedding || !closeField.value || closeField.value < closeField.min || closeField.value > closeField.max)) closeField.value = weddingDay;
}

// 슬라이더에서 value가 놓이는 위치(0~100%)
function rangePercent(range, value) {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const position = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return `${Math.max(0, Math.min(100, position))}%`;
}

function decorateRangeDefaults(root = document) {
  root.querySelectorAll('input[type="range"]').forEach((range) => {
    if (!range.dataset.defaultValue) range.dataset.defaultValue = range.defaultValue || range.getAttribute("value") || range.value;
    range.style.setProperty("--range-default-pos", rangePercent(range, Number(range.dataset.defaultValue)));
    range.title = `기본값 ${range.dataset.defaultValue}`;
    const output = range.parentElement?.querySelector("output");
    if (output) output.textContent = range.value;
    setRangeFill(range);
  });
}

function setRangeFill(range) {
  range.style.setProperty("--range-current-pos", rangePercent(range, Number(range.value || 0)));
}

document.addEventListener("input", (event) => {
  const range = event.target.closest?.('input[type="range"]');
  if (!range) return;
  const output = range.parentElement?.querySelector("output");
  if (output) output.textContent = range.value;
  setRangeFill(range);
});
document.addEventListener("wheel", (event) => {
  const scroller = event.target.closest?.(".editor-layout-options, .hero-decoration-list, .text-theme-choice-grid");
  if (!scroller) return;
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  scroller.scrollLeft += event.deltaY;
}, { passive: true });

function tabIcon(d, extra = "") {
  return `<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${extra}<path d="${d}"/></svg>`;
}

function adminHeader(active) {
  const ico = tabIcon;
  const coupleBadge = [invitationData.couple?.groom?.name, invitationData.couple?.bride?.name].filter(Boolean).join(" · ");
  const cardSlug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || "";
  const cardUrl = cardSlug && cardSlug !== "main" && cardSlug !== window.RSVP_STORAGE?.SITE_CARD_SLUG ? `./index.html?card=${encodeURIComponent(cardSlug)}` : "./index.html";
  const generalMenu = `<nav class="admin-bottom-tabs" role="tablist">
    <button class="admin-tab-item ${active === "editor" ? "is-active" : ""}" data-admin-view="editor" role="tab">
      ${ico("M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", '<path d="M9 22V12h6v10"/>')}
      <span>기본</span>
    </button>
    <button class="admin-tab-item ${active === "copy" || active === "copy-sub" ? "is-active" : ""}" data-admin-view="copy-editor" role="tab">
      ${ico("M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z")}
      <span>편집</span>
    </button>
    <button class="admin-tab-item ${["content", "responses", "guestbook"].includes(active) ? "is-active" : ""}" data-admin-view="content" role="tab">
      ${ico("", '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>')}
      <span>콘텐츠</span>
    </button>
    <button class="admin-tab-item ${active === "sections" ? "is-active" : ""}" data-admin-view="sections" role="tab">
      ${ico("M12 2l8 4-8 4-8-4z M4 10l8 4 8-4 M4 14l8 4 8-4")}
      <span>섹션</span>
    </button>
    <button class="admin-tab-item ${active === "share" ? "is-active" : ""}" data-admin-view="share-settings" role="tab">
      ${ico("M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8 M16 6l-4-4-4 4 M12 2v13")}
      <span>공유</span>
    </button>
  </nav>`;
  return `
    <div class="admin-header general-admin-header">
      <div class="general-admin-title">
        ${coupleBadge ? `<strong>${escapeAdminHtml(coupleBadge)}</strong>` : "<strong>내 청첩장</strong>"}
        <span class="section-label">관리자</span>
      </div>
      <div class="admin-header-actions">
        <a class="btn btn-icon-only" href="${cardUrl}" target="_blank" rel="noopener" title="내 청첩장 보기">${ico("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3")}</a>
        <button class="btn btn-icon-only" id="admin-logout" title="로그아웃">${ico("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9")}</button>
      </div>
    </div>
    ${generalMenu.replace("</nav>", `${["editor", "copy", "sections", "share"].includes(active) ? '<button class="admin-floating-save" type="submit" form="invitation-editor"><span>✓</span> 저장</button>' : ""}</nav>`)}`;
}

function bindAdminNavigation() {
  document.querySelector("#admin-logout")?.addEventListener("click", async (event) => {
    if (!confirmLeaveEditor()) { event.stopImmediatePropagation(); return; }
    const client = getAdminSupabaseClient();
    if (!client) return renderEditor("현재는 Supabase 연결 전 미리보기 모드입니다.");
    await client.auth.signOut();
    renderLogin();
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => {
      renderAdminView(button.dataset.adminView);
      resetAdminPageScroll();
    });
  });
  bindEditorSubTabs();
  document.querySelector("[data-content-back]")?.addEventListener("click", () => {
    renderAdminView("content");
    resetAdminPageScroll();
  });
  decorateRangeDefaults(adminApp);
}

function resetAdminPageScroll() {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  requestAnimationFrame(() => {
    root.style.scrollBehavior = previousBehavior;
  });
}

// ── 저장 안 한 변경 보호 ──
// 편집 화면을 그린 직후의 저장될 값(editorData)을 기준으로 두고, 다른 화면으로 가거나 창을 닫을 때 지금 값과 비교함.
// 이벤트를 하나하나 따라가지 않으므로 사진 업로드·스티커·칩 선택처럼 값만 바뀌는 경우도 빠짐없이 잡힘
let editorBaseline = null;
let editorInvitationSnapshot = "";
let editorTouched = false;
function captureEditorBaseline() {
  const form = document.querySelector("#invitation-editor");
  if (!form) { editorBaseline = null; return; }
  try { editorBaseline = JSON.stringify(editorData(form)); } catch { editorBaseline = null; }
}
function startEditorChangeTracking() {
  // 저장 후 다시 그리면 예전 편집창 기록이 남아 있을 수 있어 정리(뒤로가기 한 번이 헛돌지 않게)
  if (adminOverlays.length) {
    const count = adminOverlays.length;
    adminOverlays.length = 0;
    ignoredPops += 1;
    history.go(-count);
  }
  editorInvitationSnapshot = JSON.stringify(invitationData);
  editorTouched = false;
  captureEditorBaseline();
  const form = document.querySelector("#invitation-editor");
  const markTouched = (event) => { if (event.isTrusted) editorTouched = true; };
  form?.addEventListener("input", markTouched);
  form?.addEventListener("change", markTouched);
  // 화면을 그린 뒤 늦게 채워지는 칸(주소·자동 채움 등)이 있어, 사용자가 아직 손대지 않았으면 기준을 한 번 더 잡음
  setTimeout(() => { if (!editorTouched && form?.isConnected) captureEditorBaseline(); }, 800);
}
function hasUnsavedEditorChanges() {
  const form = document.querySelector("#invitation-editor");
  if (!form || editorBaseline === null) return false;
  try { return JSON.stringify(editorData(form)) !== editorBaseline; } catch { return false; }
}
function confirmLeaveEditor() {
  if (!hasUnsavedEditorChanges()) return true;
  if (!window.confirm("저장하지 않은 변경 내용이 있어요.\n저장하지 않고 이동할까요?")) return false;
  // 스티커처럼 편집 중 바로 바뀐 값이 있어 저장 전 상태로 되돌림
  if (editorInvitationSnapshot) invitationData = JSON.parse(editorInvitationSnapshot);
  editorBaseline = null;
  return true;
}
window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedEditorChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

// ── 휴대폰 뒤로가기 ──
// 관리자 화면을 옮길 때마다 기록을 남겨 뒤로가기가 이전 관리자 화면으로 감.
// 아래에서 올라온 편집창이 열려 있으면 뒤로가기는 먼저 그 창을 닫음
let currentAdminView = "";
const adminOverlays = [];
let ignoredPops = 0;
function openAdminOverlay(close) {
  if (adminOverlays.includes(close)) return;
  adminOverlays.push(close);
  history.pushState({ adminView: currentAdminView, adminOverlay: adminOverlays.length }, "");
}
function closeAdminOverlay(close) {
  const index = adminOverlays.lastIndexOf(close);
  if (index < 0) return;
  adminOverlays.splice(index, 1);
  ignoredPops += 1;
  history.back();
}
window.addEventListener("popstate", (event) => {
  if (ignoredPops > 0) { ignoredPops -= 1; return; }
  if (adminOverlays.length) {
    const close = adminOverlays.pop();
    close();
    return;
  }
  const view = event.state?.adminView;
  if (!view || view === currentAdminView) return;
  if (!confirmLeaveEditor()) {
    // 머무르기로 하면 방금 빠진 기록을 다시 쌓아 둠
    history.pushState({ adminView: currentAdminView }, "");
    return;
  }
  renderAdminView(view, { fromHistory: true, skipConfirm: true });
  resetAdminPageScroll();
});

function rememberAdminView(view) {
  localStorage.setItem(GENERAL_ADMIN_VIEW_KEY, view);
}

function renderAdminView(view = "", { fromHistory = false, skipConfirm = false } = {}) {
  if (!skipConfirm && !confirmLeaveEditor()) return;
  const generalViews = new Set(["editor", "copy-editor", "sections", "share-settings", "content", "gallery", "responses", "guestbook", "music", "stickers"]);
  rememberAdminView(generalViews.has(view) ? view : "editor");
  // 열린 편집창 기록은 화면을 옮기면 의미가 없으므로 비움
  adminOverlays.length = 0;
  if (!fromHistory && view !== currentAdminView) {
    if (currentAdminView) history.pushState({ adminView: view }, "");
    else history.replaceState({ adminView: view }, "");
  }
  currentAdminView = view;
  if (view === "editor") renderEditor();
  else if (view === "design") renderEditor("", "copy");
  else if (view === "copy-editor") renderEditor("", "copy");
  else if (view === "sections") renderEditor("", "sections");
  else if (view === "share-settings") renderEditor("", "share");
  else if (view === "content") renderContentHub();
  else if (view === "gallery") renderEditor("", "gallery");
  else if (view === "responses") renderResponses();
  else if (view === "guestbook") renderGuestbookEntries();
  else if (view === "music") {
    copyEditorMode = "music";
    renderEditor("", "copy");
  }
  else if (view === "stickers") {
    copyEditorMode = "stickers";
    renderEditor("", "copy");
  }
  else renderResponses();
}

function renderContentHub() {
  rememberAdminView("content");
  adminApp.innerHTML = `${adminHeader("content")}
    <section class="admin-card admin-hub">
      <p class="section-label">Content</p><h2>콘텐츠 관리</h2>
      <p class="admin-message">자주 확인하고 관리하는 콘텐츠를 한곳에 모았습니다.</p>
      <div class="admin-hub-grid">
        <button type="button" data-content-open="gallery"><strong>갤러리</strong><span>청첩장 사진 순서와 확대 방식을 관리합니다.</span></button>
        <button type="button" data-content-open="responses"><strong>참석 현황</strong><span>하객이 전달한 참석 여부와 동행 정보를 확인합니다.</span></button>
        <button type="button" data-content-open="guestbook"><strong>방명록</strong><span>축하 메시지를 확인하고 숨김 처리합니다.</span></button>
      </div>
    </section>`;
  bindAdminNavigation();
  document.querySelectorAll("[data-content-open]").forEach((button) => button.addEventListener("click", () => {
    renderAdminView(button.dataset.contentOpen);
    resetAdminPageScroll();
  }));
}

// 편집 탭 안의 하위 화면. 진입 화면/청첩장 화면은 같은 편집 폼을 공유(저장 버튼 하나), 스티커·배경음악은 각자 저장
let copyEditorMode = "page";
// 저장하면 편집 화면을 새로 그리므로, 보던 미리보기·페이지 위치를 잠시 기억했다가 되돌림
let pendingPreviewScroll = null;
const EDITOR_SUBTABS = [
  ["intro", "진입 화면"],
  ["page", "청첩장"],
  ["stickers", "스티커"],
  ["music", "배경음악"],
];

function editorSubTabs(active) {
  return `<nav class="editor-subtabs" aria-label="편집 메뉴">${EDITOR_SUBTABS.map(([id, label]) => `<button type="button" class="${id === active ? "is-active" : ""}" aria-pressed="${id === active}" data-editor-subtab="${id}">${label}</button>`).join("")}</nav>`;
}

const COPY_EDITOR_MODES = ["intro", "page", "stickers", "music"];

function copyEditorModeClass() {
  if (copyEditorMode === "intro") return " is-intro-mode";
  if (copyEditorMode === "stickers") return " is-sticker-mode";
  if (copyEditorMode === "music") return " is-music-mode";
  return "";
}

function setCopyEditorMode(mode) {
  copyEditorMode = COPY_EDITOR_MODES.includes(mode) ? mode : "page";
  [adminApp.querySelector(".copy-editor-page"), adminApp.querySelector(".admin-editor-view")].forEach((element) => {
    element?.classList.toggle("is-intro-mode", copyEditorMode === "intro");
    element?.classList.toggle("is-sticker-mode", copyEditorMode === "stickers");
    element?.classList.toggle("is-music-mode", copyEditorMode === "music");
  });
  // 스티커를 놓는 동안에는 문구·사진 수정모드를 꺼 둠(같은 미리보기를 쓰므로 손가락 동작이 겹치지 않게)
  if (copyEditorMode !== "page") adminApp.querySelector("[data-copy-frame-toggle].is-on")?.click();
  adminApp.querySelectorAll("[data-sticker-sheet], [data-music-panel]").forEach((element) => element.dispatchEvent(new Event("editor-mode")));
  adminApp.querySelector("[data-intro-sheet]")?.dispatchEvent(new Event("editor-mode-sync"));
  adminApp.querySelectorAll("[data-editor-subtab]").forEach((button) => {
    const isActive = button.dataset.editorSubtab === copyEditorMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  const help = adminApp.querySelector("[data-editor-subtab-help]");
  if (help) help.textContent = copyEditorHelp();
}

function copyEditorHelp() {
  if (copyEditorMode === "intro") return "링크를 열면 가장 먼저 보이는 봉투 화면입니다. 바꾼 뒤 오른쪽 아래 저장을 눌러 주세요.";
  if (copyEditorMode === "music") return "봉투를 연 뒤 흘러나올 음악이에요. 휴대폰은 화면을 한 번 누른 뒤부터 소리가 날 수 있어요. 바꾼 뒤 저장을 눌러 주세요.";
  if (copyEditorMode === "stickers") return "아래에서 손그림을 고르고 미리보기에서 놓을 곳을 누르세요. 스티커를 끌면 옮겨지고, 두 손가락으로 크기·기울기를 바꿔요.";
  return "미리보기에서 점선 영역을 누르면 아래에 편집 도구가 열립니다. 바꾼 뒤 오른쪽 아래 저장을 눌러 주세요.";
}

function bindEditorSubTabs() {
  adminApp.querySelectorAll("[data-editor-subtab]").forEach((button) => button.addEventListener("click", () => {
    const tab = button.dataset.editorSubtab;
    if (adminApp.querySelector(".copy-editor-page")) {
      setCopyEditorMode(tab);
      return;
    }
    copyEditorMode = tab;
    renderAdminView("copy-editor");
    resetAdminPageScroll();
  }));
}

function contentBackBar(title) {
  return `<div class="admin-subpage-bar">
    <button class="btn" type="button" data-content-back>← 콘텐츠 관리</button>
    <strong>${escapeAdminHtml(title)}</strong>
  </div>`;
}

function renderLogin(message = "") {
  const rememberedLoginId = authEmailToLoginId(localStorage.getItem(SAVED_LOGIN_EMAIL_KEY) || "");
  const generalSignup = `
      <div class="admin-signup-panel">
        <button class="btn btn-secondary signup-open" type="button" data-signup-open>회원가입</button>
      </div>
      <div class="signup-modal-backdrop" data-signup-modal hidden>
        <form class="form-grid signup-form signup-modal" id="admin-signup-form">
          <div class="signup-modal-head">
            <div><p class="section-label">Create Account</p><h2>내 청첩장 만들기</h2></div>
            <button class="icon-btn" type="button" data-signup-close aria-label="회원가입 닫기">×</button>
          </div>
          <div class="signup-progress" aria-label="회원가입 단계"><span class="is-active">동의</span><span>계정</span></div>
          <section class="signup-step is-active" data-signup-step="0">
            <h2>서비스 이용 동의</h2>
            <p class="admin-message micro-help">가입하면 계정별 청첩장 페이지와 일반관리자 페이지가 각각 생성됩니다.</p>
            <div class="signup-consents">
              <label class="consent"><input name="agreeTerms" type="checkbox" required> <span>서비스 이용약관에 동의합니다.</span></label>
              <label class="consent"><input name="agreePrivacy" type="checkbox" required> <span>개인정보 수집 및 이용에 동의합니다. <button type="button" class="consent-detail" data-signup-consent-detail>[자세히보기]</button></span></label>
              <p class="consent-detail-text" data-signup-consent-text hidden>수집 항목: 로그인 ID, 비밀번호, 신랑·신부 및 혼주 이름, 연락처, 생년월일, 예식 일시와 장소, 계좌 정보, 청첩장에 등록한 사진·영상·문구·지도 정보, 참석 의사 응답의 성함·참석 여부·구분·식사 여부, 방명록의 성함·메시지, 하객 앨범 업로드 이름·사진·영상 파일 및 업로드 기록. 이용 목적: 청첩장 제작·공개·관리, 관리자 본인 확인, 참석 인원 확인, 방명록 및 하객 앨범 운영, 고객 문의 대응, 서비스 안정성 유지. 보유 및 이용 기간: 서비스 이용 기간 동안 보관하며, 청첩장 삭제 또는 이용 종료 요청 시 지체 없이 삭제합니다. 단, 관계 법령상 보관이 필요한 정보는 해당 기간 동안 보관할 수 있습니다. 동의를 거부할 권리가 있으며, 필수 항목 동의 거부 시 관리자 가입 및 청첩장 생성·운영 기능 이용이 제한될 수 있습니다.</p>
              <label class="consent"><input name="agreeMarketing" type="checkbox"> <span>업데이트 및 혜택 안내 수신에 동의합니다. 선택 항목입니다.</span></label>
            </div>
            <button class="btn btn-primary" type="button" data-signup-next>다음</button>
          </section>
          <section class="signup-step" data-signup-step="1">
            <h2>로그인 계정 만들기</h2>
            <label class="field"><span>로그인 ID</span><input name="loginId" type="text" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]{3,32}" autocomplete="username" placeholder="예: vividvows"></label>
            <label class="field"><span>비밀번호</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
            <p class="admin-message micro-help">영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다. 이메일 주소는 받지 않습니다.</p>
            <div class="signup-actions"><button class="btn" type="button" data-signup-prev>이전</button><button class="btn btn-primary" type="submit">회원가입 완료</button></div>
          </section>
        </form>
      </div>`;
  adminApp.innerHTML = `
    <section class="admin-card admin-login">
      <p class="section-label">Wedding Admin</p>
      <h1>청첩장 일반관리자</h1>
      <p class="admin-message">${escapeAdminHtml(message || "등록된 관리자 계정으로 로그인해 주세요.")}</p>
      <form class="form-grid" id="admin-login-form">
        <label class="field"><span>로그인 ID</span><input name="loginId" type="text" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${escapeAdminHtml(rememberedLoginId)}"></label>
        <label class="field"><span>비밀번호</span><input name="password" type="password" required autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false"></label>
        <label class="consent remember-login"><input name="rememberEmail" type="checkbox" ${rememberedLoginId ? "checked" : ""}> <span>아이디 저장</span></label>
        <button class="btn btn-primary">로그인</button>
        <div class="login-help-actions">
          <button class="link-button" type="button" data-find-email>아이디 찾기</button>
        </div>
      </form>
      ${generalSignup}
    </section>`;
  document.querySelector("#admin-login-form").addEventListener("submit", login);
  document.querySelector("#admin-signup-form")?.addEventListener("submit", signup);
  const signupForm = document.querySelector("#admin-signup-form");
  const signupModal = document.querySelector("[data-signup-modal]");
  const setSignupStep = (step) => {
    signupForm?.querySelectorAll("[data-signup-step]").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.signupStep) === step));
    signupForm?.querySelectorAll(".signup-progress span").forEach((item, index) => item.classList.toggle("is-active", index === step));
    if (signupForm) signupForm.dataset.step = String(step);
  };
  document.querySelector("[data-signup-open]")?.addEventListener("click", (event) => {
    signupModal.hidden = false;
    setSignupStep(0);
    signupForm?.querySelector("[data-signup-step='0'] input")?.focus();
  });
  document.querySelector("[data-signup-close]")?.addEventListener("click", () => { signupModal.hidden = true; });
  signupModal?.addEventListener("click", (event) => {
    if (event.target === signupModal) signupModal.hidden = true;
  });
  signupForm?.addEventListener("click", (event) => {
    if (event.target.closest("[data-signup-consent-detail]")) {
      const detail = signupForm.querySelector("[data-signup-consent-text]");
      if (detail) detail.hidden = !detail.hidden;
      return;
    }
    if (event.target.closest("[data-signup-next]")) {
      const step = Number(signupForm.dataset.step || 0);
      const fields = [...signupForm.querySelectorAll(`[data-signup-step="${step}"] input[required]`)];
      if (fields.some((field) => !field.reportValidity())) return;
      setSignupStep(Math.min(1, step + 1));
    }
    if (event.target.closest("[data-signup-prev]")) setSignupStep(Math.max(0, Number(signupForm.dataset.step || 0) - 1));
  });
  bindPublicPeriodFields(signupForm?.elements.weddingDate, signupForm?.elements.publicOpenDate, signupForm?.elements.publicCloseDate);
  document.querySelector("[data-find-email]")?.addEventListener("click", () => {
    const saved = localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
    if (saved) {
      alert(`저장된 아이디는 ${authEmailToLoginId(saved)} 입니다.`);
      return;
    }
    findAdminLoginId();
  });
}

async function findAdminLoginId() {
  if (!window.RSVP_STORAGE?.findAdminLoginId) {
    alert("아이디 찾기 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    return;
  }
  const recoveryName = prompt("가입 시 등록한 복구용 이름을 입력해 주세요.");
  if (!recoveryName) return;
  const recoveryPhone = prompt("가입 시 등록한 복구용 연락처를 입력해 주세요.");
  if (!recoveryPhone) return;
  try {
    const maskedEmail = await window.RSVP_STORAGE.findAdminLoginId({ recoveryName, recoveryPhone });
    const loginId = authEmailToLoginId(maskedEmail);
    alert(maskedEmail
      ? `가입 아이디는 ${loginId} 입니다. 보안을 위해 일부만 표시합니다.`
      : "일치하는 관리자 아이디를 찾지 못했습니다. 입력값을 확인하거나 관리자에게 문의해 주세요.");
  } catch (error) {
    alert(`아이디를 찾지 못했습니다.\n${error.message || "잠시 후 다시 시도해 주세요."}`);
  }
}

function renderPasswordReset(message = "") {
  adminApp.innerHTML = `
    <section class="admin-card admin-login">
      <p class="section-label">Password Reset</p>
      <h1>비밀번호 변경</h1>
      <p class="admin-message">${escapeAdminHtml(message || "새 비밀번호를 입력해 주세요.")}</p>
      <form class="form-grid" id="admin-password-reset-form">
        <label class="field"><span>새 비밀번호</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <label class="field"><span>새 비밀번호 확인</span><input name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password"></label>
        <button class="btn btn-primary" type="submit">비밀번호 변경</button>
        <button class="btn" type="button" data-login-back>로그인으로 돌아가기</button>
      </form>
    </section>`;
  document.querySelector("[data-login-back]")?.addEventListener("click", () => {
    clearAuthUrlState();
    renderLogin();
  });
  document.querySelector("#admin-password-reset-form")?.addEventListener("submit", updatePassword);
}

async function updatePassword(event) {
  event.preventDefault();
  const client = getAdminSupabaseClient();
  if (!client) return renderPasswordReset("로그인 서버 연결이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  const form = new FormData(event.currentTarget);
  const password = String(form.get("password") || "");
  const passwordConfirm = String(form.get("passwordConfirm") || "");
  if (password !== passwordConfirm) return renderPasswordReset("새 비밀번호가 서로 일치하지 않습니다.");
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = "변경 중...";
  }
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "비밀번호 변경";
    }
    return renderPasswordReset(`비밀번호를 변경하지 못했습니다. ${error.message || "재설정 링크를 다시 요청해 주세요."}`);
  }
  clearAuthUrlState();
  await client.auth.signOut();
  renderLogin("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.");
}

function renderBasicInfoOnboarding(message = "") {
  const today = dateInputToday();
  // 레이아웃 미리보기 카드 생성 (builtInLayouts 기준)
  const layouts = [
    { id: "classic",       name: "클래식",     desc: "세로 스크롤 카드형. 히어로 사진 전체, 섹션별 깔끔한 구분.",        bg: "#f7f0e7", accent: "#8d3440", heroShape: "full" },
    { id: "garden_doodle", name: "러브 두들",  desc: "초록 낙서 프레임 + 하트 사진. 손그림 감성의 사랑스러운 결혼식.",   bg: "#eef2eb", accent: "#c23b2a", heroShape: "heart" },
    { id: "navy_arch",     name: "달빛 서약",  desc: "파란 배경 + 아치 사진. 단정하고 품격 있는 커플의 웨딩.",          bg: "#f5f7fa", accent: "#1a2456", heroShape: "arch" },
    { id: "valentine_choco", name: "초콜릿 발렌타인", desc: "꽉 찬 메인 사진 아래로 초콜릿이 녹아 흐르고, 하트 안에 달력이 담긴 발렌타인 웨딩.", bg: "#efe4d8", accent: "#7d2236", heroShape: "full" },
  ];
  const layoutCards = layouts.map((l) => `
    <button class="onboarding-layout-card ${l.id === "classic" ? "is-selected" : ""}" type="button" data-layout-pick="${escapeAdminHtml(l.id)}"
      style="--olc-bg:${escapeAdminHtml(l.bg)};--olc-accent:${escapeAdminHtml(l.accent)}">
      <div class="onboarding-layout-thumb onboarding-layout-live">
        <iframe loading="lazy" scrolling="no" tabindex="-1" aria-hidden="true" title="${escapeAdminHtml(l.name)} 미리보기" src="./index.html?card=main&__layout=${escapeAdminHtml(l.id)}&__thumb=1"></iframe>
        <span class="onboarding-layout-preview-btn" data-layout-preview="${escapeAdminHtml(l.id)}" data-layout-preview-name="${escapeAdminHtml(l.name)}" role="button">전체 미리보기</span>
      </div>
      <div class="onboarding-layout-label">
        <strong>${escapeAdminHtml(l.name)}</strong>
        <small>${escapeAdminHtml(l.desc)}</small>
      </div>
    </button>`).join("");
  adminApp.innerHTML = `
    <section class="admin-card admin-login onboarding-card">
      <p class="section-label">Create Wedding Card</p>
      <h1>기본정보 입력</h1>
      <p class="admin-message">${escapeAdminHtml(message || "소셜 로그인 또는 회원가입이 완료되었습니다. 청첩장 생성을 위해 기본정보를 입력해 주세요.")}</p>
      <form class="form-grid" id="basic-info-form">
        <div data-onboard-step="1">
        <div class="quick-input-grid">
          <label class="field"><span>신랑 이름</span><input name="groomName" required autocomplete="given-name"></label>
          <label class="field"><span>신부 이름</span><input name="brideName" required autocomplete="additional-name"></label>
          <label class="field"><span>신랑 생년월일</span><input name="groomBirthday" type="date"></label>
          <label class="field"><span>신부 생년월일</span><input name="brideBirthday" type="date"></label>
          <label class="field"><span>아이디 찾기용 이름</span><input name="recoveryName" required autocomplete="name"></label>
          <label class="field"><span>아이디 찾기용 연락처</span><input name="recoveryPhone" required inputmode="tel" autocomplete="tel" placeholder="숫자만 입력해도 됩니다"></label>
          <label class="field"><span>예식일자</span><input name="weddingDate" type="datetime-local" required></label>
          <label class="field"><span>예식 장소</span><input name="weddingVenue" required></label>
          <label class="field"><span>홀 이름</span><input name="weddingHall"></label>
          <label class="field"><span>청첩장 공개 시작일</span><input name="publicOpenDate" type="date" value="${today}" min="${today}" data-public-open></label>
          <label class="field"><span>청첩장 공개 종료일</span><input name="publicCloseDate" type="date" data-public-close></label>
        </div>
        <p class="admin-message micro-help">공개 종료일은 예식일 기준 이후 3일까지만 설정할 수 있습니다.</p>
        <div class="onboarding-actions" style="display:flex;gap:10px;margin-top:6px;align-items:center">
          <button type="button" class="btn" data-onboarding-cancel>가입 취소</button>
          <button type="button" class="btn btn-primary" data-onboard-next style="flex:1">다음 · 레이아웃 선택 →</button>
        </div>
        </div>
        <div data-onboard-step="2" hidden>
          <div class="onboarding-layout-section">
            <p class="section-label" style="margin:0 0 8px">청첩장 레이아웃 선택</p>
            <p class="admin-message micro-help" style="margin:0 0 10px">미리보기를 보고 마음에 드는 디자인을 선택하세요. 일반관리자 페이지에서 언제든지 변경할 수 있습니다.</p>
            <div class="onboarding-layout-grid">${layoutCards}</div>
            <input type="hidden" name="layoutId" value="classic">
          </div>
          <div class="onboarding-actions" style="display:flex;gap:10px;margin-top:6px;align-items:center">
            <button type="button" class="btn" data-onboard-prev>← 이전</button>
            <button class="btn btn-primary" style="flex:1">내 일반관리자 페이지 만들기</button>
          </div>
        </div>
      </form>
      <div class="ltp-preview-modal" id="onboarding-layout-preview-modal" hidden>
        <div class="ltp-preview-backdrop" data-onboarding-preview-close></div>
        <div class="ltp-preview-panel">
          <div class="ltp-preview-topbar">
            <strong id="onboarding-layout-preview-title">레이아웃 미리보기</strong>
            <button class="btn" type="button" data-onboarding-preview-close>닫기</button>
          </div>
          <div class="ltp-preview-iframe-wrap">
            <iframe id="onboarding-layout-preview-iframe" class="ltp-preview-iframe" src="about:blank" title="레이아웃 전체 미리보기"></iframe>
          </div>
        </div>
      </div>
    </section>`;
  const form = document.querySelector("#basic-info-form");
  document.querySelector("[data-onboarding-cancel]")?.addEventListener("click", async () => {
    if (!confirm("가입을 취소하고 처음으로 돌아갈까요? 입력하신 정보는 저장되지 않습니다.")) return;
    try { await getAdminSupabaseClient()?.auth?.signOut(); } catch (error) { console.warn("[onboarding cancel signout]", error); }
    renderLogin();
  });
  // 단계 이동: 기본정보 → 레이아웃 선택
  const onboardStep = (n) => form.querySelector(`[data-onboard-step="${n}"]`);
  // 레이아웃 미리보기 iframe을 480px 디자인 기준으로 렌더링한 뒤, 카드 크기에 맞춰 축소 표시
  const scaleLayoutPreviews = () => {
    const REF_WIDTH = 380;
    form.querySelectorAll(".onboarding-layout-live").forEach((thumb) => {
      const iframe = thumb.querySelector("iframe");
      if (!iframe) return;
      const rect = thumb.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = rect.width / REF_WIDTH;
      iframe.style.width = `${REF_WIDTH}px`;
      iframe.style.height = `${rect.height / scale}px`;
      iframe.style.transform = `scale(${scale})`;
    });
  };
  form.querySelector("[data-onboard-next]")?.addEventListener("click", () => {
    const required = [...onboardStep(1).querySelectorAll("input[required]")];
    if (required.some((field) => !field.reportValidity())) return;
    onboardStep(1).hidden = true;
    onboardStep(2).hidden = false;
    onboardStep(2).scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(scaleLayoutPreviews);
  });
  form.querySelector("[data-onboard-prev]")?.addEventListener("click", () => {
    onboardStep(2).hidden = true;
    onboardStep(1).hidden = false;
  });
  window.addEventListener("resize", scaleLayoutPreviews);
  // 레이아웃 선택 인터랙션
  form.querySelectorAll("[data-layout-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      form.querySelectorAll("[data-layout-pick]").forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      form.elements.layoutId.value = btn.dataset.layoutPick;
    });
  });
  // 레이아웃별 전체 미리보기 모달
  const layoutPreviewModal = document.getElementById("onboarding-layout-preview-modal");
  const layoutPreviewIframe = document.getElementById("onboarding-layout-preview-iframe");
  const layoutPreviewTitle = document.getElementById("onboarding-layout-preview-title");
  const closeLayoutPreview = () => {
    if (!layoutPreviewModal) return;
    layoutPreviewModal.hidden = true;
    layoutPreviewIframe.src = "about:blank";
  };
  form.querySelectorAll("[data-layout-preview]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!layoutPreviewModal) return;
      layoutPreviewTitle.textContent = `${btn.dataset.layoutPreviewName || ""} 미리보기`;
      layoutPreviewIframe.src = `./index.html?card=main&__layout=${encodeURIComponent(btn.dataset.layoutPreview)}&__heroimg=1`;
      layoutPreviewModal.hidden = false;
    });
  });
  layoutPreviewModal?.querySelectorAll("[data-onboarding-preview-close]").forEach((el) => el.addEventListener("click", closeLayoutPreview));
  bindPublicPeriodFields(form.elements.weddingDate, form.elements.publicOpenDate, form.elements.publicCloseDate);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"], .btn-primary');
    button.disabled = true;
    button.textContent = "생성 중...";
    const fields = new FormData(form);
    const selectedLayout = fields.get("layoutId") || "classic";
    try {
      currentInvitationSite = await window.RSVP_STORAGE.ensureInvitationForCurrentUser(window.INVITATION_DATA, {
        groomName: fields.get("groomName")?.trim(),
        brideName: fields.get("brideName")?.trim(),
        groomBirthday: fields.get("groomBirthday"),
        brideBirthday: fields.get("brideBirthday"),
        recoveryName: fields.get("recoveryName")?.trim(),
        recoveryPhone: fields.get("recoveryPhone")?.trim(),
        weddingDate: fields.get("weddingDate"),
        weddingVenue: fields.get("weddingVenue")?.trim(),
        weddingHall: fields.get("weddingHall")?.trim(),
        publicOpenDate: fields.get("publicOpenDate"),
        publicCloseDate: fields.get("publicCloseDate"),
      });
      if (!currentInvitationSite?.slug) throw new Error("기본정보가 부족합니다.");
      await loadInvitationData();
      // 선택한 레이아웃 저장
      if (selectedLayout !== "classic") {
        invitationData.designSystem.activeLayoutId = selectedLayout;
        await window.RSVP_STORAGE.saveInvitationData(invitationData);
        if (typeof applyLayoutTemplate === "function") applyLayoutTemplate(selectedLayout);
      }
      renderAdminView("editor");
      showAdminWelcomeOverlay(true);
    } catch (error) {
      button.disabled = false;
      button.textContent = "내 일반관리자 페이지 만들기";
      notifySaveFailure(error, "일반관리자 페이지를 생성");
    }
  });
}

function renderDependencyNotice(message = "") {
  revealAdminPage();
  if (!adminApp) return;
  adminApp.innerHTML = `
    <section class="admin-card admin-login">
      <p class="section-label">Load Error</p>
      <h2>관리자페이지 준비가 지연되고 있습니다</h2>
      <p class="admin-message">${escapeAdminHtml(message || "필수 스크립트가 아직 로드되지 않았습니다.")}</p>
      <button class="btn btn-primary" type="button" onclick="location.reload()">새로고침</button>
    </section>`;
}

function responsesView(responses, isPreview = false) {
  const attending = responses.filter((response) => response.attendance === "참석");
  const totalGuests = attending.reduce((sum, response) => sum + Number(response.total_count || 0), 0);
  const rooms = attending.filter((response) => response.needs_accommodation === "예").length;
  return `
    <section class="admin-card">
      <div class="admin-toolbar"><h2>${isPreview ? "테스트 응답" : "참석 응답"}</h2></div>
      <div class="admin-summary">
        <div><strong>${responses.length}</strong><span>전체 응답</span></div>
        <div><strong>${totalGuests}</strong><span>예상 참석 인원</span></div>
        <div><strong>${rooms}</strong><span>숙소 요청 건</span></div>
      </div>
      <div class="response-list">
        ${responses.length ? responses.map(responseCard).join("") : '<p class="admin-message">아직 전달된 참석 정보가 없습니다.</p>'}
      </div>
    </section>`;
}

function responseCard(response) {
  const companions = Array.isArray(response.companions) && response.companions.length
    ? response.companions.map((person) => escapeAdminHtml(person)).join(", ")
    : "없음";
  return `
    <article class="response-card">
      <h3>${escapeAdminHtml(response.guest_name)} <span class="badge">${escapeAdminHtml(response.attendance)}</span></h3>
      <p>${escapeAdminHtml(response.phone)}</p>
      ${response.attendance === "참석" ? `<p>출발지: ${escapeAdminHtml(response.origin)} · 이동: ${escapeAdminHtml(response.transport)} · 출발: ${escapeAdminHtml(response.departure_date)}
${response.travel_details ? `기타 이동 정보: ${escapeAdminHtml(response.travel_details)}
` : ""}${response.needs_accommodation === "예" ? `숙소 인원: ${escapeAdminHtml(response.accommodation_details || "미입력")}
` : ""}총 ${escapeAdminHtml(response.total_count)}명 · 동행인: ${companions}
숙소 필요: ${escapeAdminHtml(response.needs_accommodation)}</p>` : ""}
      ${response.notes ? `<p>전달 사항: ${escapeAdminHtml(response.notes)}</p>` : ""}
      <p class="response-meta">${escapeAdminHtml(formatDate(response.created_at))}</p>
    </article>`;
}

function input(name, label, value = "", type = "text") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeAdminHtml(value)}"></label>`;
}

// 초대 문구의 **글자** 표기를 굵게 미리보기 (청첩장과 같은 shared-utils 규칙)
function adminEmphasisHtml(value = "") {
  return adminUtils.emphasisHtml(value);
}

function textarea(name, label, value = "", rows = 3) {
  return `<label class="field"><span>${label}</span><textarea name="${name}" rows="${rows}">${escapeAdminHtml(value)}</textarea></label>`;
}

function frameStepControl(name, label, value, min, max, step = 1) {
  const safeName = escapeAdminHtml(name);
  const safeValue = escapeAdminHtml(value);
  return `<label class="frame-step-control">
    <span>${label}</span>
    <input name="${safeName}" type="range" min="${min}" max="${max}" step="${step}" value="${safeValue}">
    <div class="frame-stepper">
      <button type="button" data-frame-range-step="${safeName}:${-step}" aria-label="${label} 줄이기">−</button>
      <output>${safeValue}</output>
      <button type="button" data-frame-range-step="${safeName}:${step}" aria-label="${label} 늘리기">＋</button>
    </div>
  </label>`;
}

function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function autoResizeTextareas(root) {
  root?.querySelectorAll("textarea").forEach(autoResizeTextarea);
}

function select(name, label, value, options) {
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map(([optionValue, text]) => `<option value="${escapeAdminHtml(optionValue)}" ${String(value) === optionValue ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
}

function visibilitySelect(name, label, value = true) {
  const isVisible = value !== false;
  return `
    <label class="visibility-switch">
      <span>${label}</span>
      <input type="hidden" name="${name}" value="${isVisible ? "true" : "false"}">
      <input type="checkbox" data-visibility-toggle ${isVisible ? "checked" : ""} aria-label="${label} 공개 여부">
      <i aria-hidden="true"></i>
    </label>
  `;
}

function introRange(name, label, value, min, max) {
  return `<label class="text-layout-control"><span>${label}</span><input name="hero.introDesign.${name}" type="range" min="${min}" max="${max}" value="${escapeAdminHtml(value)}" data-intro-design="${name}"><output>${escapeAdminHtml(value)}</output></label>`;
}

// 눌러서 고르는 칩(색 동그라미·글꼴 견본). 실제 값은 숨긴 select가 들고 있어 저장·미리보기 연결은 그대로
function introChoiceField(key, label, value, options, { swatches = null, fonts = null, layout = "" } = {}) {
  const current = options.find(([optionValue]) => optionValue === value) || options[0];
  const chip = ([optionValue, optionLabel, description]) => {
    const active = optionValue === current[0] ? " is-active" : "";
    if (swatches) {
      const color = optionValue === "custom" ? "conic-gradient(#e46b6b, #f2c85b, #7cc48a, #6aa6e0, #b07ad8, #e46b6b)" : swatches[optionValue];
      return `<button type="button" class="intro-swatch${active}" data-intro-choice="${key}" data-value="${optionValue}" data-label="${escapeAdminHtml(optionLabel)}" style="--swatch:${color}" aria-label="${escapeAdminHtml(optionLabel)}" title="${escapeAdminHtml(optionLabel)}"></button>`;
    }
    const fontStyle = fonts ? ` style="font-family:${fonts[optionValue] || "inherit"}"` : "";
    if (description) {
      return `<button type="button" class="intro-choice-card${active}" data-intro-choice="${key}" data-value="${optionValue}" data-label="${escapeAdminHtml(optionLabel)}" role="radio" aria-checked="${Boolean(active)}"><i aria-hidden="true"></i><span><strong>${escapeAdminHtml(optionLabel)}</strong><small>${escapeAdminHtml(description)}</small></span></button>`;
    }
    return `<button type="button" class="intro-chip${active}" data-intro-choice="${key}" data-value="${optionValue}" data-label="${escapeAdminHtml(optionLabel)}"${fontStyle}>${escapeAdminHtml(optionLabel)}</button>`;
  };
  return `
    <div class="intro-choice-field ${layout}">
      <div class="intro-choice-head"><span>${label}</span><em data-intro-choice-name="${key}">${escapeAdminHtml(swatches ? current[1] : "")}</em></div>
      <div class="intro-choice-options">${options.map(chip).join("")}</div>
      <div hidden>${select(`hero.introDesign.${key}`, label, current[0], options)}</div>
    </div>`;
}

// 진입화면 편집기: 스타일을 먼저 고르고, 고른 스타일에 해당하는 미리보기·항목만 보여줌.
// 두 스타일이 같이 쓰는 이름·날짜 문구는 한 번만 둠(숨긴 칸도 저장되므로 같은 이름 칸을 두 번 두지 않음)
function introDesignEditor(groom, bride) {
  const design = invitationData.hero.introDesign || {};
  const style = design.style || "typing";
  const introName = invitationData.hero.introName || `${groom.name} · ${bride.name}`;
  const introDate = invitationData.hero.introDate || invitationData.wedding.displayDate;
  const { ENVELOPE_COLORS, SEAL_COLORS, SEAL_DEFAULT } = window.ENVELOPE_INTRO;
  const envelopeOptions = [["brown", "브라운"], ["beige", "아이보리"], ["white", "화이트"], ["black", "블랙"], ["sky", "하늘색"], ["pink", "분홍색"], ["custom", "직접 고르기"]];
  const sealOptions = [["burgundy", "버건디"], ["beige", "샌드"], ["brown", "브라운"], ["navy", "남색"], ["black", "블랙"], ["white", "흰색"], ["sky", "하늘색"], ["pink", "핑크"], ["custom", "직접 고르기"]];
  const fontOptions = [["", "기본"], ["dodum", "고운돋움"], ["batang", "고운바탕"], ["myeongjo", "나눔명조"], ["notoserif", "본명조"]];
  const fontFamilies = { "": "inherit", dodum: "'Gowun Dodum'", batang: "'Gowun Batang'", myeongjo: "'Nanum Myeongjo'", notoserif: "'Noto Serif KR'" };
  return `
    <div class="copy-editor-envelope-preview" data-intro-fields="envelope" ${style === "envelope" ? "" : "hidden"}>
      <div class="envelope-preview-frame"><div class="envelope-preview-canvas" data-envelope-preview></div></div>
      <button class="envelope-preview-replay" type="button" data-envelope-preview-replay>▶ 열리는 모습 보기</button>
    </div>
    <div class="copy-editor-intro-preview" data-intro-design-preview data-intro-fields="typing" ${style === "typing" ? "" : "hidden"}>
      <small data-intro-preview-eyebrow>${escapeAdminHtml(invitationData.hero.introEyebrow || invitationData.hero.eyebrow || "our wedding day")}</small>
      <strong data-intro-preview-name>${escapeAdminHtml(introName)}</strong>
      <span data-intro-preview-date>${escapeAdminHtml(introDate)}</span>
    </div>
    <section class="intro-sheet" data-intro-sheet aria-label="진입 화면 편집 도구">
    <nav class="intro-sheet-tabs" aria-label="진입 화면 편집 항목">
      <button type="button" class="is-active" data-intro-sheet-tab="shape">모양</button>
      <button type="button" data-intro-sheet-tab="copy">문구</button>
      <button type="button" data-intro-sheet-tab="color" data-intro-fields="envelope" ${style === "envelope" ? "" : "hidden"}>색</button>
      <button type="button" data-intro-sheet-tab="font">글꼴</button>
      <button type="button" data-intro-sheet-tab="layout" data-intro-fields="typing" ${style === "typing" ? "" : "hidden"}>배치</button>
    </nav>
    <section class="intro-group" data-intro-pane="shape">
      ${introChoiceField("style", "진입 화면 모양", style, [["envelope", "봉투 열기", "봉투를 누르면 열리면서 청첩장이 나와요"], ["typing", "글자 타이핑", "두 사람 이름이 한 글자씩 써져요"]], { layout: "is-cards" })}
    </section>
    <section class="intro-group" data-intro-pane="copy" hidden>
      <h3>문구</h3>
      ${input("hero.introName", "이름", introName)}
      ${input("hero.introDate", "날짜 · 비우면 예식 일시", invitationData.hero.introDate || "")}
      <div data-intro-fields="envelope" ${style === "envelope" ? "" : "hidden"}>
        ${input("hero.introScript", "필기체 문구", invitationData.hero.introScript || "Save the date")}
      </div>
      <div data-intro-fields="typing" ${style === "typing" ? "" : "hidden"}>
        ${input("hero.introEyebrow", "영문 문구", invitationData.hero.introEyebrow || invitationData.hero.eyebrow || "")}
      </div>
    </section>
    <section class="intro-group" data-intro-pane="color" hidden>
      <h3>색</h3>
      ${introChoiceField("envelopeColor", "봉투", design.envelopeColor || "brown", envelopeOptions, { swatches: ENVELOPE_COLORS })}
      <div class="intro-color-custom" data-intro-color-custom="envelopeColor" ${design.envelopeColor === "custom" ? "" : "hidden"}>
        ${input("hero.introDesign.envelopeCustomColor", "봉투 색 직접 고르기", design.envelopeCustomColor || ENVELOPE_COLORS.brown, "color")}
      </div>
      ${introChoiceField("sealColor", "실링 왁스", design.sealColor || "burgundy", sealOptions, { swatches: SEAL_COLORS })}
      <div class="intro-color-custom" data-intro-color-custom="sealColor" ${design.sealColor === "custom" ? "" : "hidden"}>
        ${input("hero.introDesign.sealCustomColor", "실링 색 직접 고르기", design.sealCustomColor || SEAL_DEFAULT, "color")}
      </div>
    </section>
    <section class="intro-group" data-intro-pane="font" hidden>
      <h3>이름·날짜 글꼴</h3>
      ${introChoiceField("koFont", "", design.koFont || "", fontOptions, { fonts: fontFamilies, layout: "is-fonts" })}
    </section>
    <section class="intro-group" data-intro-pane="layout" hidden>
      <h3>배치</h3>
      ${introChoiceField("align", "문구 정렬", design.align || "center", [["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]], { layout: "is-segmented" })}
      <div class="text-layout-editor">
        ${introRange("eyebrowSize", "영문 문구 크기", design.eyebrowSize ?? 11, 8, 24)}
        ${introRange("nameSize", "이름 크기", design.nameSize ?? 30, 20, 54)}
        ${introRange("dateSize", "날짜 크기", design.dateSize ?? 11, 8, 20)}
        ${introRange("eyebrowNameGap", "영문 ↔ 이름 간격", design.eyebrowNameGap ?? 10, 0, 40)}
        ${introRange("nameDateGap", "이름 ↔ 날짜 간격", design.nameDateGap ?? 10, -24, 40)}
        ${introRange("offsetY", "전체 위아래 위치", design.offsetY ?? 0, -160, 160)}
      </div>
    </section>
    </section>`;
}

function normalizedHeroDecoration(value = "none") {
  const legacyDecorations = { line_frame: "doodle_hearts", heart_frame: "organic_heart" };
  const selected = legacyDecorations[value] || value;
  return heroDecorations.includes(selected) ? selected : "none";
}

function imageField(name, label, value = "") {
  const isProfile = ["couple.groom.photo", "couple.bride.photo"].includes(name);
  const originalName = isProfile ? `${name}Original` : "";
  const originalValue = originalName ? getNested(invitationData, originalName, "") : "";
  const cropName = isProfile ? `${name}Crop` : "";
  const cropValue = cropName ? getNested(invitationData, cropName, "") : "";
  return `
    <div class="image-field ${isProfile ? "image-field-profile" : ""}">
      <input name="${name}" type="hidden" value="${escapeAdminHtml(value)}">
      ${isProfile ? `<input name="${originalName}" type="hidden" value="${escapeAdminHtml(originalValue)}">` : ""}
      ${isProfile ? `<input name="${cropName}" type="hidden" value="${escapeAdminHtml(cropValue)}">` : ""}
      <div class="image-preview" data-image-preview="${name}">
        ${value ? `<img src="${escapeAdminHtml(adminMediaUrl(value))}" alt="${label} 미리보기">` : '<span>등록된 사진이 없습니다.</span>'}
      </div>
      <div class="image-field-controls">
        <strong>${label}</strong>
        <span class="micro-help">${isProfile ? "사진을 누르면 보여질 영역을 다시 맞출 수 있습니다." : "휴대폰 갤러리에서 한 장을 선택해 주세요."}</span>
        <div class="image-actions">
          <label class="btn image-upload">${value ? "변경" : "＋ 선택"}<input type="file" accept="image/*" data-image-target="${name}"></label>
          <button class="btn" type="button" data-image-remove="${name}">× 제거</button>
        </div>
      </div>
    </div>`;
}

function tagFields(name, label, values = []) {
  const normalized = [...values, "", "", ""].slice(0, 3).map((value) => String(value || "").replace(/^#+/, ""));
  return `
    <div class="tag-field-group" data-tag-group="${name}">
      <strong>${label}</strong>
      <div class="tag-field-list">
        ${normalized.map((value, index) => `<label class="field tag-field"><span>#</span><input name="${name}" type="text" maxlength="18" value="${escapeAdminHtml(value)}" placeholder="태그 ${index + 1}"></label>`).join("")}
      </div>
    </div>`;
}

function heroActiveMediaField() {
  // 메인 영상은 egress 절감을 위해 사용하지 않음 — 첫 화면은 항상 이미지
  return '<input type="hidden" name="hero.activeMedia" value="image">';
}

function heroMediaDock(hero = {}) {
  return `
    <div class="editor-hero-media-tools">
      <button class="editor-media-card ${hero.image ? "has-media" : ""}" type="button" data-tool-action="hero-image" data-tool-context="hero">
        <span class="editor-media-thumb" data-hero-image-thumb style="${hero.image ? `background-image:url('${escapeAdminHtml(adminMediaUrl(hero.image))}')` : ""}"></span>
        <strong>${hero.image ? "이미지 등록됨" : "이미지 업로드"}</strong>
      </button>
      <div class="editor-media-actions" data-hero-media-actions="image" hidden>
        <button type="button" data-tool-action="hero-image-change">변경</button>
        <button type="button" data-tool-action="hero-image-remove">삭제</button>
      </div>
    </div>`;
}

function editorPresetValue(appearance = {}) {
  return appearance.movieConcept && appearance.movieConcept !== "none"
    ? appearance.movieConcept
    : (appearance.design?.presetId || appearance.theme || "sky");
}

function editorDesignOptions(items, selected) {
  return items.filter((item) => item.enabled !== false).map((item) =>
    `<option value="${escapeAdminHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeAdminHtml(item.name)}</option>`).join("");
}

// 스킨 레이아웃(초콜릿 발렌타인)은 목록 맨 앞에 '대표색'이 있음. 다른 레이아웃에서는 숨김
const LAYOUT_COLOR_PRESET = "__layout__";
const LAYOUTS_WITH_OWN_COLORS = { valentine_choco: { label: "대표색 (브라운·베이지)", bg: "#efe4d8", accent: "#7d2236" } };

function editorPresetSelect(name, label, themes, selected, layoutColors = null) {
  // 고를 테마가 없는 묶음(예: 영화테마를 모두 없앤 경우)은 빈 제목만 남지 않게 뺌
  const group = (type, groupLabel) => {
    const options = editorDesignOptions(themes.filter((theme) => theme.type === type), selected);
    return options ? `<optgroup label="${groupLabel}">${options}</optgroup>` : "";
  };
  const layoutGroup = `<optgroup label="레이아웃 대표색" data-layout-colors-group ${layoutColors ? "" : "hidden disabled"}><option value="${LAYOUT_COLOR_PRESET}" ${selected === LAYOUT_COLOR_PRESET ? "selected" : ""}>${escapeAdminHtml(layoutColors?.label || "대표색")}</option></optgroup>`;
  return `<label class="field"><span>${label}</span><select name="${name}">${layoutGroup}${group("color", "컬러테마")}${group("movie", "영화테마")}</select></label>`;
}

// 꾸밈 모양을 그림 카드로 고르게 함(내부 이름 대신 짧은 이름 + 모양 아이콘)
const HERO_FRAME_ICONS = {"inherit":"<svg viewBox=\"0 0 40 40\"><rect x=\"7\" y=\"7\" width=\"26\" height=\"26\" rx=\"5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M14 20h12M20 14v12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" opacity=\".5\"/></svg>","none":"<svg viewBox=\"0 0 40 40\"><rect x=\"7\" y=\"7\" width=\"26\" height=\"26\" rx=\"5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M10 30 30 10\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>","text_marriage":"<svg viewBox=\"0 0 40 40\"><rect x=\"7\" y=\"5\" width=\"26\" height=\"30\" rx=\"3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12 27h16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path d=\"M15 23h10\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" opacity=\".6\"/></svg>","frame_heart":"<svg viewBox=\"0 0 40 40\"><path d=\"M20 32C11 26 6 21 6 15c0-4 3-7 7-7 3 0 5 2 7 4 2-2 4-4 7-4 4 0 7 3 7 7 0 6-5 11-14 17z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/></svg>","frame_arch":"<svg viewBox=\"0 0 40 40\"><path d=\"M11 34V17a9 9 0 0 1 18 0v17z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>","frame_inset":"<svg viewBox=\"0 0 40 40\"><rect x=\"5\" y=\"5\" width=\"30\" height=\"30\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" opacity=\".5\"/><rect x=\"10\" y=\"12\" width=\"20\" height=\"18\" rx=\"4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>"};
const HERO_FRAME_NAMES = {"inherit":"레이아웃 기본","none":"없음","text_marriage":"결혼합니다 문구","frame_heart":"손그림 하트","frame_arch":"아치 액자","frame_inset":"둥근 액자"};
function editorDesignFramePicker(frames, selected) {
  const option = (frame) => `<label class="hero-decoration-option hero-frame-card">
    <input type="radio" name="appearance.design.heroDecoration" value="${escapeAdminHtml(frame.id)}" ${selected === frame.id ? "checked" : ""}>
    <span class="hero-frame-icon" aria-hidden="true">${HERO_FRAME_ICONS[frame.id] || HERO_FRAME_ICONS.inherit}</span>
    <span class="hero-decoration-copy"><strong>${escapeAdminHtml(HERO_FRAME_NAMES[frame.id] || frame.name)}</strong></span>
  </label>`;
  return `<fieldset class="hero-decoration-field"><div class="hero-decoration-list hero-frame-grid">${option({ id: "inherit", name: "레이아웃 기본" })}${frames.map(option).join("")}</div></fieldset>`;
}

function editorDesignTextThemePicker(themes, selected) {
  return `<div class="text-theme-choice-grid">${themes.filter((theme) => theme.enabled !== false).map((theme) => `
    <button class="text-theme-choice ${selected === theme.id ? "is-selected" : ""}" type="button" data-design-text-theme="${escapeAdminHtml(theme.id)}">
      ${typeof textThemeSample === "function" ? textThemeSample(theme) : ""}
      <span>${escapeAdminHtml(theme.name || theme.id)}</span>
    </button>`).join("")}</div>`;
}

function editorOnboardingPicker(system, selectedPreset, selectedTextTheme) {
  const themeCard = (theme) => `
    <button class="editor-start-card ${theme.id === selectedPreset ? "is-selected" : ""}" type="button" data-onboarding-preset="${escapeAdminHtml(theme.id)}">
      <span class="editor-start-preview" style="--preview-bg:${escapeAdminHtml(theme.palette?.background || "#f7f0e7")};--preview-accent:${escapeAdminHtml(theme.palette?.accent || "#999")}"></span>
      <strong>${escapeAdminHtml(theme.name || theme.id)}</strong>
      <small>${theme.type === "movie" ? "영화테마" : "컬러테마"}</small>
    </button>`;
  const textCard = (theme) => `
    <button class="editor-start-card editor-start-text ${theme.id === selectedTextTheme ? "is-selected" : ""}" type="button" data-onboarding-text-theme="${escapeAdminHtml(theme.id)}">
      <span class="editor-start-text-preview">${typeof textThemeSample === "function" ? textThemeSample(theme) : "<b>Text</b><em>Theme</em>"}</span>
      <strong>${escapeAdminHtml(theme.name || theme.id)}</strong>
      <small>메인문구테마</small>
    </button>`;
  return `
    <section class="editor-start-backdrop" data-editor-onboarding>
      <div class="editor-start-sheet">
        <div class="editor-start-browse-head"><strong>테마 선택</strong><span>누르면 미리보기에 바로 적용돼요</span></div>
        <button class="editor-start-close" type="button" data-editor-start-close aria-label="편집 시작 창 닫기">×</button>
        <div class="editor-start-title">
          <p class="section-label">Start Edit</p>
          <h2>원하는 테마로<br>청첩장 편집을 시작해보세요</h2>
        </div>
        <div class="editor-start-section">
          <h3>컬러 · 영화테마</h3>
          <div class="editor-start-grid">${(() => {
            const own = LAYOUTS_WITH_OWN_COLORS[system.activeLayoutId] || LAYOUTS_WITH_OWN_COLORS.valentine_choco;
            return `<button class="editor-start-card editor-start-layout-colors ${selectedPreset === LAYOUT_COLOR_PRESET ? "is-selected" : ""}" type="button" data-onboarding-preset="${LAYOUT_COLOR_PRESET}" ${LAYOUTS_WITH_OWN_COLORS[system.activeLayoutId] ? "" : "hidden"}>
              <span class="editor-start-preview" style="--preview-bg:${own.bg};--preview-accent:${own.accent}"><em>대표</em></span>
              <strong>레이아웃 대표색</strong>
              <small>레이아웃 기본</small>
            </button>`;
          })()}${system.themes.filter((theme) => theme.enabled !== false).map(themeCard).join("")}</div>
        </div>
        <div class="editor-start-section">
          <h3>메인 문구 테마</h3>
          <div class="editor-start-grid">${system.assets.textThemes.filter((theme) => theme.enabled !== false).map(textCard).join("")}</div>
        </div>
        <button class="editor-start-apply" type="button" data-editor-start-apply>선택하고 편집하기</button>
      </div>
    </section>`;
}

function heroGapValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function heroScaleValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 100;
}

// 메인 사진 위 문구(영문·이름·날짜)를 한 곳에서 고치는 줄들. 실제 값은 기존 폼 필드에 동기화됨(data-hero-copy)
function heroCopyRows(design = {}) {
  const groom = invitationData.couple?.groom?.name || "";
  const bride = invitationData.couple?.bride?.name || "";
  const toggle = (name, label, enabled) => `<label class="hero-copy-toggle"><input type="checkbox" name="${name}" ${enabled ? "checked" : ""}><span>${label}</span></label>`;
  return `
    <div class="hero-copy-rows">
      <div class="hero-copy-row">
        ${toggle("appearance.design.heroEyebrowEnabled", "영문", design.heroEyebrowEnabled !== false)}
        <input type="text" data-hero-copy="hero.eyebrow" data-eyebrow-plain value="${escapeAdminHtml(invitationData.hero?.eyebrow || "")}" placeholder="our wedding day" autocomplete="off">
        <div class="hero-copy-names hero-copy-split" data-eyebrow-split hidden>
          <input type="text" data-hero-copy="hero.eyebrowMain" value="${escapeAdminHtml(invitationData.hero?.eyebrowMain || "Our Wedding")}" placeholder="큰 영문" aria-label="큰 영문 글씨" autocomplete="off">
          <i>+</i>
          <input type="text" data-hero-copy="hero.eyebrowScript" value="${escapeAdminHtml(invitationData.hero?.eyebrowScript || "Day")}" placeholder="필기체" aria-label="필기체 글씨" autocomplete="off">
        </div>
      </div>
      <div class="hero-copy-row">
        ${toggle("appearance.design.heroNamesEnabled", "이름", design.heroNamesEnabled !== false)}
        <div class="hero-copy-names">
          <input type="text" data-hero-copy="couple.groom.name" value="${escapeAdminHtml(groom)}" placeholder="신랑" autocomplete="off">
          <i data-name-sep-preview>${design.heroNameSeparator === "heart" ? "♥" : "·"}</i>
          <input type="text" data-hero-copy="couple.bride.name" value="${escapeAdminHtml(bride)}" placeholder="신부" autocomplete="off">
        </div>
      </div>
      <div class="hero-copy-row">
        <span class="hero-copy-label">이름 사이</span>
        <div class="hero-name-sep-choice">
          <input type="hidden" name="appearance.design.heroNameSeparator" value="${design.heroNameSeparator === "heart" ? "heart" : "dot"}">
          <button type="button" data-hero-name-sep="dot" class="${design.heroNameSeparator === "heart" ? "" : "is-active"}">· 점</button>
          <button type="button" data-hero-name-sep="heart" class="${design.heroNameSeparator === "heart" ? "is-active" : ""}">♥ 하트</button>
        </div>
      </div>
      <div class="hero-copy-row">
        ${toggle("appearance.design.heroDateEnabled", "날짜", design.heroDateEnabled !== false)}
        <input type="text" data-hero-copy="wedding.displayDateCustom" value="${escapeAdminHtml(invitationData.wedding?.displayDateCustom || invitationData.wedding?.displayDate || "")}" autocomplete="off">
      </div>
    </div>`;
}

// 위치: 레이아웃 기본 위치(위/가운데/아래) 또는 직접 조정(슬라이더·미리보기에서 끌기)
function heroPositionControls(design = {}) {
  const position = invitationData.hero?.contentPosition || "bottom";
  const y = Number.isFinite(Number(design.heroTextYPercent)) ? Number(design.heroTextYPercent) : 76;
  const positioned = isHeroTextUserPositioned(design);
  const quick = (value, label) => `<button type="button" data-hero-position="${value}" class="${!positioned && position === value ? "is-active" : ""}">${label}</button>`;
  return `
    <input type="hidden" name="hero.contentPosition" value="${escapeAdminHtml(position)}">
    <input type="hidden" name="appearance.design.heroTextXPercent" value="${escapeAdminHtml(design.heroTextXPercent ?? 50)}">
    <input type="hidden" name="appearance.design.heroTextPositioned" value="${positioned ? "true" : "false"}">
    <div class="hero-position-quick">${quick("top", "위")}${quick("middle", "가운데")}${quick("bottom", "아래")}</div>
    ${frameStepControl("appearance.design.heroTextYPercent", "직접", y, 8, 92, 1)}
    <p class="hero-tool-hint">미리보기에서 문구를 손가락으로 위아래로 끌어 옮길 수도 있어요.</p>`;
}

// 받는 분 위치 빠른 선택: 위아래(상·중·하) 높이, 좌우(좌측·중앙·우측)는 글자를 붙일 기준선 위치
const HERO_TO_Y = { top: 12, middle: 50, bottom: 88 };
const HERO_TO_X = { left: 8, center: 50, right: 92 };

// 받는 분 이름(개인 링크 ?to=)을 메인 사진 위에 보일지와 위치·크기·색. 이름 넣은 링크로 들어왔을 때만 적용됨
function heroToControls(design = {}) {
  const number = (value, fallback) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const color = /^#[0-9a-f]{6}$/i.test(String(design.heroToColor || "")) ? design.heroToColor : "#ffffff";
  const align = ["left", "right"].includes(design.heroToAlign) ? design.heroToAlign : "center";
  const y = number(design.heroToYPercent, 12);
  const button = (attr, value, label, active) => `<button type="button" ${attr}="${value}" class="${active ? "is-active" : ""}">${label}</button>`;
  return `
    <div class="hero-to-head">
      <label class="hero-copy-toggle"><input type="checkbox" name="appearance.design.heroToEnabled" ${design.heroToEnabled === false ? "" : "checked"}><span>메인 사진에도 "to. 이름" 보이기</span></label>
      <label class="hero-to-color"><span>색</span><input type="color" name="appearance.design.heroToColor" value="${escapeAdminHtml(color)}"></label>
    </div>
    <input type="hidden" name="appearance.design.heroToAlign" value="${align}">
    <div class="hero-to-quick"><span>위아래</span><div class="hero-position-quick">${Object.entries(HERO_TO_Y).map(([key, value]) => button("data-hero-to-y", key, { top: "상", middle: "중", bottom: "하" }[key], y === value)).join("")}</div></div>
    <div class="hero-to-quick"><span>좌우</span><div class="hero-position-quick">${Object.keys(HERO_TO_X).map((key) => button("data-hero-to-align", key, { left: "좌측", center: "중앙", right: "우측" }[key], align === key)).join("")}</div></div>
    <div class="hero-to-steps">
      ${frameStepControl("appearance.design.heroToYPercent", "위아래", y, 4, 96, 1)}
      ${frameStepControl("appearance.design.heroToXPercent", "좌우", number(design.heroToXPercent, HERO_TO_X[align]), 4, 96, 1)}
      ${frameStepControl("appearance.design.heroToScale", "크기", heroScaleValue(design.heroToScale), 60, 200, 5)}
    </div>
    <p class="hero-tool-hint">이름 넣은 링크로 들어온 분에게만 보여요. 미리보기에는 예시 이름(홍길동)으로 보여요.</p>`;
}

function isHeroTextUserPositioned(design = {}) {
  if (typeof design.heroTextPositioned === "boolean") return design.heroTextPositioned;
  const y = Number(design.heroTextYPercent);
  return Number.isFinite(y) && y !== 76;
}

// 메인 사진 보이는 영역: 원본 파일은 그대로 두고 확대·중심점만 저장(hero.imageFrame)
function heroImageFrameControls(hero = {}) {
  const frame = hero.imageFrame || {};
  const value = (key, fallback) => escapeAdminHtml(Number.isFinite(Number(frame[key])) ? Number(frame[key]) : fallback);
  return `
    <div class="hero-frame-fields">
      <input type="hidden" name="hero.imageFrame.enabled" value="${frame.enabled ? "true" : "false"}">
      <input type="hidden" name="hero.imageFrame.x" value="${value("x", 50)}">
      <input type="hidden" name="hero.imageFrame.y" value="${value("y", 50)}">
      <input type="hidden" name="hero.imageFrame.ratio" value="${value("ratio", 0)}">
    </div>
    <button class="editor-tool-button hero-frame-open" type="button" data-hero-frame-open ${hero.image ? "" : "hidden"}><span>✥</span>보이는 영역 맞추기</button>
    <div class="hero-frame-tools" data-hero-frame-tools hidden>
      ${frameStepControl("hero.imageFrame.zoom", "확대", value("zoom", 100), 100, 200, 5)}
      <div class="hero-frame-actions">
        <button type="button" data-hero-frame-reset>원래대로</button>
        <button type="button" class="is-primary" data-hero-frame-close>영역 맞추기 끝</button>
      </div>
      <p class="hero-tool-hint">미리보기 사진을 손가락으로 끌어 보이는 부분을 옮기고, 확대는 위 버튼으로 조절해요.</p>
    </div>`;
}

function editorDesignPanel() {
  window.WEDDING_DESIGN?.normalize(invitationData);
  const system = invitationData.designSystem;
  const design = invitationData.appearance.design || {};
  const selectedPreset = editorPresetValue(invitationData.appearance || {});
  const selectedTextTheme = design.heroTextTheme || "auto";
  const hasPreset = Boolean(invitationData.appearance?.design?.presetId || invitationData.appearance?.theme || invitationData.appearance?.movieConcept);
  const onboarding = editorOnboardingPicker(system, (LAYOUTS_WITH_OWN_COLORS[system.activeLayoutId] && design.skinColors !== "theme") ? LAYOUT_COLOR_PRESET : selectedPreset, selectedTextTheme)
    .replace('<section class="editor-start-backdrop"', `<section class="editor-start-backdrop"${hasPreset ? " hidden" : ""}`);
  const activeLayoutId = system.activeLayoutId || "classic";
  const layoutColors = LAYOUTS_WITH_OWN_COLORS[activeLayoutId] || null;
  const skinColors = design.skinColors === "theme" ? "theme" : "layout";
  const shownPreset = layoutColors && skinColors === "layout" ? LAYOUT_COLOR_PRESET : selectedPreset;
  const layoutBtns = (system.layoutTemplates || []).map((tpl) =>
    `<button class="editor-layout-btn ${tpl.id === activeLayoutId ? "is-active" : ""}" type="button" data-editor-layout="${escapeAdminHtml(tpl.id)}" style="--elb-bg:${escapeAdminHtml(tpl.previewBg || "#f5f0ea")};--elb-accent:${escapeAdminHtml(tpl.previewAccent || "#8d3440")}" title="${escapeAdminHtml(tpl.description || tpl.name)}">${escapeAdminHtml(tpl.name)}</button>`
  ).join("");
  return `
    <section class="editor-layout-strip">
      <span>레이아웃</span>
      <div class="editor-layout-options">${layoutBtns}</div>
    </section>
    <section class="editor-theme-strip">
      <span>테마</span>
      ${editorPresetSelect("editorPresetId", "컬러테마 · 영화테마", system.themes, shownPreset, layoutColors)}
      <button class="editor-theme-open" type="button" data-editor-theme-open>전체보기</button>
    </section>
    ${onboarding}
    <div class="editor-design-hidden-fields">
      <input type="hidden" name="appearance.design.presetId" value="${escapeAdminHtml(selectedPreset)}">
      <input type="hidden" name="appearance.design.skinColors" value="${skinColors}">
      <input type="hidden" name="appearance.design.heroTextTheme" value="${escapeAdminHtml(selectedTextTheme)}">
    </div>
    <section class="editor-tooldock" data-editor-tool-panel hidden>
      <div class="editor-tooldock-head">
        <button class="editor-tooldock-close" type="button" data-tooldock-collapse aria-label="편집 도구 아래로 숨기기"><span aria-hidden="true"></span></button>
        <div><strong data-tooldock-title>편집 도구</strong><span data-tooldock-help>수정할 영역을 누르면 도구가 바뀝니다.</span></div>
        <div class="editor-tooldock-actions" data-tooldock-actions hidden>
          <button type="button" data-tooldock-cancel>취소</button>
          <button type="button" class="is-primary" data-tooldock-done>완료</button>
        </div>
      </div>
      <nav class="editor-tooldock-tabs" aria-label="편집 도구 탭">
        <button type="button" data-tooldock-tab="media">사진</button>
        <button type="button" data-tooldock-tab="profile-info">정보</button>
        <button type="button" data-tooldock-tab="frame">꾸밈</button>
        <button type="button" data-tooldock-tab="copy">문구</button>
        <button type="button" data-tooldock-tab="position">위치</button>
        <button type="button" data-tooldock-tab="size">크기·간격</button>
        <button type="button" data-tooldock-tab="hero-to">받는 분</button>
        <button type="button" data-tooldock-tab="text">테마</button>
        <button type="button" data-tooldock-tab="style">글자/위치</button>
        <button type="button" data-tooldock-tab="items">항목관리</button>
      </nav>
      <div class="editor-tooldock-pane" data-tooldock-pane="media">
        <div class="editor-tool-buttons" data-profile-media-tools>
          <button class="editor-tool-button is-primary" type="button" data-tool-action="profile-photo" data-tool-context="profile"><span>＋</span>업로드</button>
          <button class="editor-tool-button" type="button" data-tool-action="profile-crop" data-tool-context="profile"><span>↔</span>영역맞추기</button>
          <button class="editor-tool-button" type="button" data-tool-action="profile-remove" data-tool-context="profile"><span>−</span>삭제</button>
        </div>
        <div data-hero-media-tools>${heroMediaDock(invitationData.hero)}${heroImageFrameControls(invitationData.hero)}</div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="frame">
        ${editorDesignFramePicker(system.assets.frames, design.heroDecoration || "inherit")}
        <div class="hero-frame-settings">
          <div class="hero-frame-color" data-frame-setting="tint">
            <span>색</span>
            <div class="hero-frame-swatches">
              ${[["#ffffff", "흰색"], ["#f3e6d6", "베이지"], ["#4a2a1f", "브라운"], ["#7d2236", "버건디"]].map(([color, label]) => `<button type="button" data-frame-tint="${color}" style="--swatch:${color}" aria-label="${label}"><i></i><small>${label}</small></button>`).join("")}
              <label class="hero-frame-custom" aria-label="직접 고르기"><input type="color" name="appearance.design.heroDecorationTint" value="${escapeAdminHtml(design.heroDecorationTint || "#ffffff")}"><small>직접</small></label>
            </div>
          </div>
          <div data-frame-setting="size">${frameStepControl("appearance.design.heroDecorationSize", "크기", Number(design.heroDecorationSize) || 100, 70, 130, 5)}</div>
          <div data-frame-setting="stroke">${frameStepControl("appearance.design.heroDecorationStrokeWidth", "선 두께", Number(design.heroDecorationStrokeWidth) || 3, 1, 8, 0.5)}</div>
          <div data-frame-setting="y">${frameStepControl("appearance.design.heroDecorationYPercent", "위아래", Number(design.heroDecorationYPercent) || 0, -80, 80, 2)}</div>
          <p class="hero-tool-hint" data-frame-settings-empty hidden></p>
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="copy">
        ${heroCopyRows(design)}
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="position">
        ${heroPositionControls(design)}
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="hero-to">
        ${heroToControls(design)}
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="size">
        <div class="hero-size-controls">
          ${frameStepControl("appearance.design.heroTextScale", "전체", heroScaleValue(design.heroTextScale), 70, 140, 5)}
          ${frameStepControl("appearance.design.heroEyebrowScale", "영문", heroScaleValue(design.heroEyebrowScale), 60, 160, 5)}
          ${frameStepControl("appearance.design.heroNamesScale", "이름", heroScaleValue(design.heroNamesScale), 60, 160, 5)}
          ${frameStepControl("appearance.design.heroDateScale", "날짜", heroScaleValue(design.heroDateScale), 60, 160, 5)}
        </div>
        <div class="hero-gap-controls">
          ${frameStepControl("appearance.design.heroGapTop", "영문↔이름", heroGapValue(design.heroGapTop), -20, 60, 2)}
          ${frameStepControl("appearance.design.heroGapBottom", "이름↔날짜", heroGapValue(design.heroGapBottom), -20, 60, 2)}
        </div>
        <button class="editor-tool-button editor-tool-reset hero-size-reset" type="button" data-hero-size-reset><span>↺</span>원래대로</button>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="text">
        ${editorDesignTextThemePicker(system.assets.textThemes, selectedTextTheme)}
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="style">
        <textarea class="sheet-text-input" data-text-copy-input rows="2" autocomplete="off"></textarea>
        <p class="hero-tool-hint" data-text-copy-hint hidden>문단 사이는 한 줄 비우고, **글자**처럼 별표 두 개로 감싸면 굵게 보여요.</p>
        <div class="sheet-size-row">
          <span>글자 크기</span>
          <div class="frame-stepper"><button type="button" data-text-size-step="-1" aria-label="글자 작게">−</button><output data-text-size-output>16</output><button type="button" data-text-size-step="1" aria-label="글자 크게">＋</button></div>
          <button type="button" class="sheet-size-reset" data-text-size-reset>원래대로</button>
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="profile-info">
        <div class="sheet-field-grid">
          <label class="sheet-field"><span>이름</span><input type="text" data-profile-field="name" autocomplete="off"></label>
          <label class="sheet-field"><span>생일</span><input type="date" data-profile-field="birthday"></label>
          <label class="sheet-field"><span>아버지</span><input type="text" data-profile-field="Father" autocomplete="off"></label>
          <label class="sheet-field"><span>어머니</span><input type="text" data-profile-field="Mother" autocomplete="off"></label>
        </div>
        <p class="hero-tool-hint">이름과 부모님 성함은 초대글 아래 부모님 줄과 계좌 안내에도 함께 바뀌어요.</p>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="parents">
        <div class="sheet-parents">
          <strong>신랑측</strong>
          <div class="sheet-field-grid">
            <label class="sheet-field"><span>아버지</span><input type="text" data-sync-quick="groomFather" autocomplete="off"></label>
            <label class="sheet-field"><span>어머니</span><input type="text" data-sync-quick="groomMother" autocomplete="off"></label>
            <label class="sheet-field is-wide"><span>관계</span><input type="text" data-sync-name="couple.groom.relation" placeholder="예: 장남" autocomplete="off"></label>
          </div>
          <strong>신부측</strong>
          <div class="sheet-field-grid">
            <label class="sheet-field"><span>아버지</span><input type="text" data-sync-quick="brideFather" autocomplete="off"></label>
            <label class="sheet-field"><span>어머니</span><input type="text" data-sync-quick="brideMother" autocomplete="off"></label>
            <label class="sheet-field is-wide"><span>관계</span><input type="text" data-sync-name="couple.bride.relation" placeholder="예: 장녀" autocomplete="off"></label>
          </div>
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="gallery">
        <div class="sheet-gallery-grid" data-sheet-gallery-grid></div>
        <div class="sheet-gallery-actions" data-sheet-gallery-actions>
          <button type="button" data-sheet-gallery="left">← 앞으로</button>
          <button type="button" data-sheet-gallery="right">뒤로 →</button>
          <button type="button" data-sheet-gallery="replace">바꾸기</button>
          <button type="button" class="is-danger" data-sheet-gallery="remove">삭제</button>
        </div>
        <div class="sheet-photo-actions">
          <button type="button" class="is-primary" data-sheet-gallery="add">사진 추가</button>
          <button type="button" data-sheet-gallery="more">확대 화면 설정</button>
        </div>
        <p class="sheet-photo-state" data-sheet-gallery-status></p>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="account">
        <div class="sheet-account-host" data-sheet-account-host></div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="calendar">
        <input type="hidden" name="appearance.design.calendarHeart" value="${escapeAdminHtml(["white", "choco"].includes(design.calendarHeart) ? design.calendarHeart : "burgundy")}">
        <div class="sheet-heart-choice">
          <button type="button" data-calendar-heart="burgundy"><i style="--heart:#7d2236"></i>버건디</button>
          <button type="button" data-calendar-heart="white"><i style="--heart:#fffdf9"></i>흰색</button>
          <button type="button" data-calendar-heart="choco"><i style="--heart:#4a2a1f"></i>어두운 브라운</button>
        </div>
        <p class="hero-tool-hint">하트 안의 월 글씨·요일·날짜·결혼식 날 표시 색도 함께 바뀌어요.</p>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="interlude">
        <p class="sheet-photo-state" data-interlude-state></p>
        <div class="sheet-photo-actions" data-interlude-photo-actions>
          <button type="button" class="is-primary" data-interlude-action="upload">사진 올리기</button>
          <button type="button" data-interlude-action="remove">삭제</button>
        </div>
        <div class="hero-frame-fields">
          <input type="hidden" name="media.interludeFrame.enabled" value="${invitationData.media?.interludeFrame?.enabled ? "true" : "false"}">
          <input type="hidden" name="media.interludeFrame.x" value="${escapeAdminHtml(invitationData.media?.interludeFrame?.x ?? 50)}">
          <input type="hidden" name="media.interludeFrame.y" value="${escapeAdminHtml(invitationData.media?.interludeFrame?.y ?? 70)}">
          <input type="hidden" name="media.interludeFrame.ratio" value="${escapeAdminHtml(invitationData.media?.interludeFrame?.ratio ?? 0)}">
        </div>
        <button class="editor-tool-button hero-frame-open" type="button" data-interlude-frame-open><span>✥</span>보이는 영역 맞추기</button>
        <div class="hero-frame-tools" data-interlude-frame-tools hidden>
          ${frameStepControl("media.interludeFrame.zoom", "확대", Number(invitationData.media?.interludeFrame?.zoom) || 100, 100, 200, 5)}
          <div class="hero-frame-actions">
            <button type="button" data-interlude-frame-reset>원래대로</button>
            <button type="button" class="is-primary" data-interlude-frame-close>영역 맞추기 끝</button>
          </div>
          <p class="hero-tool-hint">미리보기 사진을 손가락으로 끌어 보이는 부분을 옮기고, 확대는 위 버튼으로 조절해요.</p>
        </div>
      </div>
      <div class="editor-tooldock-pane editor-tooldock-manager" data-tooldock-pane="items">
        <div data-tooldock-items="information">${noticeManager(invitationData.notices)}</div>
        <div data-tooldock-items="location">${transportManager(invitationData.transport)}</div>
        <div class="editor-detail-fields" data-tooldock-items="rsvp-detail">
          ${textarea("rsvp.modalGuide", "RSVP 모달 안내 문구", invitationData.rsvp?.modalGuide || "기차표와 숙소 준비를 위해 필요한 정보입니다.")}
          ${textarea("rsvp.transportOptions", "오는 방법 선택지", (invitationData.rsvp?.transportOptions || ["자가용", "기차", "버스", "택시", "도보", "직접입력"]).join("\n"))}
          ${input("rsvp.originPlaceholder", "출발지 입력 예시", invitationData.rsvp?.originPlaceholder || "예: 서울역, 창원시 성산구")}
          ${input("rsvp.transportPlaceholder", "오는 방법 입력 예시", invitationData.rsvp?.transportPlaceholder || "예: 자가용, KTX, 버스")}
          ${textarea("rsvp.notesPlaceholder", "추가 전달사항 입력 예시", invitationData.rsvp?.notesPlaceholder || "교통편이나 숙소 관련 요청을 자유롭게 적어 주세요.")}
          ${textarea("rsvp.accommodationGuide", "숙소 필요 ON 안내 문구", invitationData.rsvp?.accommodationGuide || "숙소 준비를 위해 함께 오는 인원 이름 또는 명수를 적어 주세요.")}
        </div>
      </div>
    </section>`;
}

async function decodeCropImage(file) {
  try {
    if ("createImageBitmap" in window) return await createImageBitmap(file);
  } catch (error) {
    console.warn("[image bitmap decode]", error);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parseCropSettings(value = "") {
  try {
    const settings = JSON.parse(value);
    return {
      zoom: Number(settings.zoom) || 112,
      x: Number.isFinite(Number(settings.x)) ? Number(settings.x) : 50,
      y: Number.isFinite(Number(settings.y)) ? Number(settings.y) : 50,
    };
  } catch {
    return { zoom: 112, x: 50, y: 50 };
  }
}

async function cropProfileImage(file, { initialZoom = 112, initialX = 50, initialY = 50 } = {}) {
  let currentFile = file;
  let bitmap = await decodeCropImage(currentFile);
  let previewUrl = URL.createObjectURL(currentFile);
  const root = document.createElement("div");
  root.className = "image-crop-backdrop";
  root.innerHTML = `<section class="image-crop-modal">
    <h2>대표사진 영역 맞추기</h2>
    <p class="micro-help">사진을 확대하고 보여줄 영역을 맞춘 뒤 적용해 주세요.</p>
    <canvas class="image-crop-preview" width="480" height="600" aria-label="대표사진 자르기 미리보기"></canvas>
    <label class="btn image-upload">새 사진 업로드<input type="file" accept="image/*" data-crop-replace></label>
    <label class="field"><span>확대</span><input type="range" min="100" max="220" value="${escapeAdminHtml(initialZoom)}" data-default-value="112" data-crop-zoom><output>${escapeAdminHtml(initialZoom)}</output></label>
    <label class="field"><span>좌우 중심</span><input type="range" min="0" max="100" value="${escapeAdminHtml(initialX)}" data-default-value="50" data-crop-x><output>${escapeAdminHtml(initialX)}</output></label>
    <label class="field"><span>상하 중심</span><input type="range" min="0" max="100" value="${escapeAdminHtml(initialY)}" data-default-value="50" data-crop-y><output>${escapeAdminHtml(initialY)}</output></label>
    <div class="modal-actions"><button class="btn" type="button" data-crop-cancel>취소</button><button class="btn btn-primary" type="button" data-crop-apply>적용</button></div>
  </section>`;
  document.body.append(root);
  decorateRangeDefaults(root);
  const preview = root.querySelector(".image-crop-preview");
  const zoom = root.querySelector("[data-crop-zoom]");
  const x = root.querySelector("[data-crop-x]");
  const y = root.querySelector("[data-crop-y]");
  const cropSource = () => {
    const ratio = 4 / 5;
    const sourceRatio = bitmap.width / bitmap.height;
    const scale = Number(zoom.value) / 100;
    const baseWidth = sourceRatio > ratio ? bitmap.height * ratio : bitmap.width;
    const baseHeight = sourceRatio > ratio ? bitmap.height : bitmap.width / ratio;
    const cropWidth = baseWidth / scale;
    const cropHeight = baseHeight / scale;
    return {
      x: Math.max(0, Math.min(bitmap.width - cropWidth, (bitmap.width - cropWidth) * Number(x.value) / 100)),
      y: Math.max(0, Math.min(bitmap.height - cropHeight, (bitmap.height - cropHeight) * Number(y.value) / 100)),
      width: cropWidth,
      height: cropHeight,
    };
  };
  const update = () => {
    const source = cropSource();
    const context = preview.getContext("2d");
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, preview.width, preview.height);
    [zoom, x, y].forEach((input) => {
      input.nextElementSibling.textContent = input.value;
      setRangeFill(input);
    });
  };
  zoom.addEventListener("input", update);
  x.addEventListener("input", update);
  y.addEventListener("input", update);
  update();
  root.querySelector("[data-crop-replace]").addEventListener("change", async (event) => {
    const replacement = event.currentTarget.files[0];
    if (!replacement) return;
    bitmap.close?.();
    URL.revokeObjectURL(previewUrl);
    currentFile = replacement;
    bitmap = await decodeCropImage(currentFile);
    previewUrl = URL.createObjectURL(currentFile);
    zoom.value = String(initialZoom);
    x.value = String(initialX);
    y.value = String(initialY);
    update();
  });
  return new Promise((resolve) => {
    const finish = (result) => {
      bitmap.close?.();
      URL.revokeObjectURL(previewUrl);
      root.remove();
      resolve(result);
    };
    root.querySelector("[data-crop-cancel]").addEventListener("click", () => finish(null));
    root.querySelector("[data-crop-apply]").addEventListener("click", async () => {
      const source = cropSource();
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 1200;
      canvas.getContext("2d").drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/webp", 0.88));
      const settings = { zoom: Number(zoom.value), x: Number(x.value), y: Number(y.value) };
      const croppedFile = blob ? new File([blob], `${currentFile.name.replace(/\.[^.]+$/, "")}-crop.webp`, { type: "image/webp" }) : currentFile;
      finish({ file: croppedFile, settings });
    });
  });
}

function galleryManager(images, thumbs = []) {
  const slots = Array.from({ length: GALLERY_MAX }, (_, index) => images[index] || "");
  const thumbSlots = Array.from({ length: GALLERY_MAX }, (_, index) => thumbs[index] || "");
  return `
    <div class="gallery-manager">
      ${slots.map((image, index) => `<input name="gallery.${index}" type="hidden" value="${escapeAdminHtml(image)}"><input name="galleryThumb.${index}" type="hidden" value="${escapeAdminHtml(thumbSlots[index])}">`).join("")}
      <div class="gallery-manager-actions">
        <label class="btn btn-primary image-upload">사진 추가<input type="file" accept="image/*" multiple data-gallery-upload></label>
        <button class="btn" type="button" data-gallery-clear>전체 비우기</button>
      </div>
      <p class="admin-message" data-gallery-status>최대 ${GALLERY_MAX}장까지 등록할 수 있습니다. 기존 사진은 유지되고, 사진별 변경/삭제도 가능합니다.</p>
      <div class="gallery-manager-grid" data-gallery-editor-preview>
        ${galleryManagerPreview(slots, thumbSlots)}
      </div>
    </div>`;
}

function galleryManagerPreview(images, thumbs = []) {
  const photos = images.map((image, originalIndex) => ({ image, thumb: thumbs[originalIndex] || image })).filter((photo) => photo.image);
  return photos.length
    ? photos.map((photo, index) => `
      <article class="gallery-manager-item">
        <img src="${escapeAdminHtml(adminMediaUrl(photo.thumb))}" alt="갤러리 ${index + 1} 미리보기">
        <div class="gallery-manager-item-actions">
          <label class="icon-btn gallery-image-action image-upload" title="사진 변경" aria-label="사진 변경">✎<input type="file" accept="image/*" data-gallery-replace="${index}"></label>
          <button class="icon-btn gallery-image-action btn-danger" type="button" data-gallery-remove="${index}" title="사진 삭제" aria-label="사진 삭제">×</button>
        </div>
      </article>`).join("")
    : '<p class="admin-message">등록된 갤러리 사진이 없습니다.</p>';
}

function parseList(value, fields) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const values = line.split("|").map((part) => part.trim());
    return Object.fromEntries(fields.map((field, index) => [field, values[index] || ""]));
  });
}

// section-registry.js는 admin.html에서 항상 먼저 로드됩니다(실패 시 부팅 중단).
const { ids: validSectionIds, defaultOrder: defaultSectionOrder, defaultSettings: defaultSectionSettings, labels: sectionLabels } = sectionRegistry;
const venuePresets = [
  {
    names: ["그랜드머큐어 앰배서더 창원 (구 풀만호텔)", "그랜드머큐어 앰배서더 창원", "창원 그랜드머큐어 호텔웨딩", "그랜드머큐어 창원"],
    address: "경상남도 창원시 성산구 원이대로 332",
    transport: [
      { title: "기차", lines: [{ icon: "🚆", text: "KTX 창원중앙역 또는 창원역에서 하차해 주세요." }, { icon: "📍", text: "역에서 호텔까지 택시로 약 10분입니다." }] },
      { title: "버스", lines: [{ icon: "🚏", text: "시외버스 · 창원종합터미널 하차 후 시내버스 103번 또는 택시로 약 3km입니다." }, { icon: "📍", text: "시내버스 · 시티7 또는 창원컨벤션센터 정류장에서 하차해 주세요." }] },
      { title: "자가용", lines: [{ icon: "🛣️", text: "내비게이션에 '그랜드머큐어 앰배서더 창원'을 입력해 주세요." }, { icon: "🅿️", text: "호텔 주차장은 3시간 무료입니다. 자세한 내용은 식장 안내를 확인해 주세요." }] },
    ],
  },
];
const noticePresets = [
  ["", "직접 입력"],
  ["meal", "식사 안내"],
  ["parking", "주차 안내"],
  ["photo", "사진 촬영 안내"],
  ["flower", "화환 안내"],
];
const noticePresetValues = {
  meal: { title: "식사 안내", text: "예식 전후로 연회장을 편하게 이용해 주세요." },
  parking: { title: "주차 안내", text: "" },
  photo: { title: "사진 촬영 안내", text: "예식 중 사진 촬영은 다른 하객의 관람에 방해되지 않도록 부탁드립니다." },
  flower: { title: "화환 안내", text: "축하 화환은 정중히 사양합니다. 따뜻한 마음만 감사히 받겠습니다." },
};
const noticeContentPlaceholders = {
  "주차 안내": "주차권배부, 주차정산 내용",
  "연회장 이용 안내": "연회장 시간 및 위치 안내",
  "2부 예식안내": "2부 예식 관련 안내 내용을 입력해 주세요.",
};
const venueGuideTemplate = [
  { title: "주차 안내", text: "" },
  { title: "연회장 이용 안내", text: "" },
  { title: "2부 예식안내", text: "" },
];
const bankOptions = ["", "국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "새마을금고", "부산은행", "경남은행", "직접 입력"];

function sectionOrderText(items = []) {
  return items.join("\n");
}

function parseSectionOrder(value) {
  return sectionRegistry.parseOrder(value);
}

function normalizeSectionOrder(items = [], appendMissing = false) {
  return sectionRegistry.normalizeOrder(items, { appendMissing });
}

function editorIntroHelp(focus) {
  if (focus === "sections") return "청첩장에 어떤 순서로 무엇을 보여 줄지 정해요. 결혼식 전과 결혼식 당일부터 보여 줄 구성을 따로 정할 수 있어요.";
  if (focus === "share") return "카드에서 ①②③을 누르면 그 부분을 고칠 수 있어요. 다 고치면 오른쪽 아래 저장을 눌러 주세요.";
  if (focus === "gallery") return "사진을 고르면 바로 올라가요. 순서를 바꾼 뒤에는 저장을 눌러 주세요.";
  return "이름·날짜·장소·계좌처럼 청첩장의 뼈대가 되는 정보예요. 사진 꾸미기와 문구는 '편집' 탭에서 해요.";
}

function isWeddingDayNow() {
  const day = dateOnly(invitationData.wedding?.date);
  return Boolean(day) && dateInputToday() >= day;
}

function sectionModeTabs() {
  const current = isWeddingDayNow() ? "weddingDay" : "preWedding";
  const tab = (mode, label) => `<button type="button" class="${mode === current ? "is-active" : ""}" data-section-mode="${mode}" aria-pressed="${mode === current}"><strong>${label}</strong><small>${mode === current ? "지금 보이는 구성" : mode === "weddingDay" ? "예식일부터 자동 적용" : "예식 전날까지"}</small></button>`;
  return `<div class="section-mode-tabs" role="group" aria-label="적용 시기">${tab("preWedding", "결혼식 전까지")}${tab("weddingDay", "결혼식 당일부터")}</div>`;
}

function sectionOrderEditor(name, label, selected = [], previewMode = "") {
  const normalizedSelected = normalizeSectionOrder(selected);
  const ordered = normalizeSectionOrder(normalizedSelected, true);
  const resetKey = name.split(".").pop();
  const previewLabel = previewMode === "preWedding" ? "결혼식 전까지 미리보기" : "결혼식당일 이후 미리보기";
  return `
    <div class="section-order-editor" data-section-order data-section-order-mode="${escapeAdminHtml(previewMode)}">
      <div class="section-order-head">
        <strong>${label}</strong>
        <div class="section-order-actions">
          ${previewMode === "weddingDay" ? '<button class="btn section-text-action" type="button" data-section-copy-from="preWedding">결혼식 전과 똑같이</button>' : ""}
          <button class="btn section-text-action" type="button" data-section-reset="${escapeAdminHtml(resetKey)}">${tabIcon("M3 12a9 9 0 1 0 3-6.7 M3 3v6h6")}기본 순서로</button>
          <a class="btn section-text-action" href="./index.html?previewSectionMode=${escapeAdminHtml(previewMode)}" target="_blank" rel="noopener" aria-label="${escapeAdminHtml(previewLabel)}">${tabIcon("M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z", '<circle cx="12" cy="12" r="3"/>')}미리보기</a>
        </div>
      </div>
      <input type="hidden" name="${name}" value="${escapeAdminHtml(sectionOrderText(normalizedSelected))}">
      <div class="section-order-list">
        ${ordered.map((id) => `
          <div class="section-order-item" data-section-id="${id}">
            <label><input type="checkbox" ${normalizedSelected.includes(id) ? "checked" : ""}> <span>${sectionLabels[id]}</span><em class="section-hidden-tag">숨김</em></label>
            <button class="section-drag-handle" type="button" aria-label="${sectionLabels[id]} 길게 눌러 순서 변경" title="길게 눌러 순서 변경">☰</button>
          </div>`).join("")}
      </div>
    </div>`;
}

function weddingDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function weddingDateIso(value) {
  return value ? `${value}:00+09:00` : "";
}

function birthdayInputValue(value = "") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = String(value).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function birthdayDisplayValue(value = "") {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function weddingDisplayDate(value, format = "long_ko") {
  if (!value) return "";
  const date = new Date(weddingDateIso(value));
  if (Number.isNaN(date.getTime())) return "";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const day = weekdays[date.getDay()];
  const year = date.getFullYear();
  const shortYear = String(year).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(date.getDate()).padStart(2, "0");
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const twelveHour = hour % 12 || 12;
  if (format === "short_ko") return `${shortYear}-${month}-${dateOfMonth} (${day}) ${String(hour).padStart(2, "0")}시 ${minute}분`;
  if (format === "dot_numeric") return `${year}.${month}.${dateOfMonth} (${day}) ${String(hour).padStart(2, "0")}:${minute}`;
  if (format === "english") return `${year}. ${month}. ${dateOfMonth}. ${day}요일 · ${String(hour).padStart(2, "0")}:${minute}`;
  return `${year}. ${month}. ${dateOfMonth}. ${day}요일 ${period} ${twelveHour}시 ${minute}분`;
}

function findVenuePreset(value = "") {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return venuePresets.find((preset) => preset.names.some((name) => normalized.includes(name.replace(/\s+/g, "").toLowerCase())));
}

function mapLinksFor(venue = "", address = "") {
  const query = encodeURIComponent(String(address || "").trim() || String(venue || "").trim());
  return [
    { label: "네이버 지도", app: "naver", url: `https://map.naver.com/p/search/${query}` },
    { label: "카카오맵", app: "kakao", url: `https://map.kakao.com/link/search/${query}` },
    { label: "티맵", app: "tmap", url: `tmap://search?name=${query}`, fallbackUrl: `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${query}` },
  ];
}

function openAddressSearchModal({ venue = "", address = "", onSelect }) {
  const root = document.createElement("div");
  root.className = "address-search-backdrop";
  const resultMarkup = (query) => {
    const value = query || venue || address;
    const preset = findVenuePreset(value);
    const links = mapLinksFor(value, preset?.address || value);
    return `
      <div class="address-search-results">
        ${preset ? `<button class="address-result-card" type="button" data-address-result="${escapeAdminHtml(preset.address)}" data-venue-result="${escapeAdminHtml(preset.names[0])}">
          <strong>${escapeAdminHtml(preset.names[0])}</strong>
          <span>${escapeAdminHtml(preset.address)}</span>
          <small>이 항목 선택</small>
        </button>` : ""}
        <div class="map-links address-map-links">
          ${links.map((link) => `<a class="btn" data-map-app="${escapeAdminHtml(link.app || "")}" ${link.fallbackUrl ? `data-map-fallback="${escapeAdminHtml(link.fallbackUrl)}"` : ""} href="${escapeAdminHtml(link.url)}" target="_blank" rel="noopener">${escapeAdminHtml(link.label)}</a>`).join("")}
        </div>
      </div>`;
  };
  root.innerHTML = `<section class="address-search-modal">
    <div class="signup-modal-head">
      <div><p class="section-label">Address Search</p><h2>예식장 주소 검색</h2></div>
      <button class="icon-btn" type="button" data-address-close aria-label="주소 검색 닫기">×</button>
    </div>
    <label class="field"><span>웨딩홀 이름으로 검색</span><input data-address-query value="${escapeAdminHtml(venue)}" placeholder="웨딩홀 이름을 입력해 주세요."></label>
    <div class="address-postcode-embed" data-address-postcode><p class="admin-message">웨딩홀 이름을 입력하면 검색 결과가 표시됩니다.</p></div>
    <div data-address-results>${resultMarkup(venue || address)}</div>
    <div class="address-manual">
      <label class="field"><span>직접 입력 / 수정</span><input data-address-manual value="${escapeAdminHtml(address)}" placeholder="주소를 직접 입력하거나 수정할 수 있어요."></label>
      <button class="btn btn-primary" type="button" data-address-manual-apply>직접입력 적용</button>
    </div>
  </section>`;
  document.body.append(root);
  const close = () => root.remove();
  const queryInput = root.querySelector("[data-address-query]");
  const results = root.querySelector("[data-address-results]");
  const postcodeBox = root.querySelector("[data-address-postcode]");
  const runPostcodeSearch = (keyword) => {
    if (!postcodeBox) return;
    if (!keyword) {
      postcodeBox.innerHTML = `<p class="admin-message">웨딩홀 이름을 입력하면 검색 결과가 표시됩니다.</p>`;
      return;
    }
    if (!window.daum?.Postcode) {
      postcodeBox.innerHTML = `<p class="admin-message">주소 검색 위젯을 불러오지 못했습니다. 지도 링크나 직접 입력을 이용해 주세요.</p>`;
      return;
    }
    postcodeBox.innerHTML = "";
    new window.daum.Postcode({
      oncomplete: (data) => {
        const roadAddr = data.roadAddress || data.jibunAddress || data.autoRoadAddress || data.autoJibunAddress || "";
        // 사용자가 입력한 식장 이름을 우선하고, 비어 있을 때만 건물명을 사용 (예: 개명 전 건물명 "Festa via" 방지)
        onSelect({ venue: queryInput.value.trim() || venue || data.buildingName, address: roadAddr });
        close();
      },
      width: "100%",
      height: "100%",
    }).embed(postcodeBox, { autoClose: false, q: keyword });
  };
  if ((venue || "").trim()) runPostcodeSearch(venue.trim());
  let searchTimer;
  queryInput?.addEventListener("input", () => {
    results.innerHTML = resultMarkup(queryInput.value.trim());
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runPostcodeSearch(queryInput.value.trim()), 450);
  });
  root.addEventListener("click", (event) => {
    if (event.target === root || event.target.closest("[data-address-close]")) close();
    const result = event.target.closest("[data-address-result]");
    if (result) {
      onSelect({ venue: result.dataset.venueResult, address: result.dataset.addressResult });
      close();
    }
    if (event.target.closest("[data-address-manual-apply]")) {
      onSelect({ venue: queryInput.value.trim(), address: root.querySelector("[data-address-manual]")?.value.trim() || "" });
      close();
    }
  });
  queryInput?.focus();
}

function parentNames(value = "") {
  const parts = String(value || "").split("·").map((item) => item.trim());
  return parts.length > 1 ? [parts[0] || "", parts[1] || ""] : [parts[0] || "", ""];
}

function joinParentNames(...names) {
  const [father = "", mother = ""] = names.map((name) => String(name || "").trim());
  return father || mother ? `${father} · ${mother}` : "";
}

function displayParentNames(value = "") {
  return parentNames(value).filter(Boolean).join(" · ");
}

function quickInput(key, label, value = "", type = "text") {
  return `<label class="field"><span>${label}</span><input type="${type}" value="${escapeAdminHtml(value)}" data-quick="${key}"></label>`;
}

function recommendationEditor(name, label, value, items, isTextarea = false, useModal = false) {
  return `
    <div class="recommendation-editor" data-recommendation-editor>
      ${isTextarea ? textarea(name, label, value, 6) : input(name, label, value)}
      ${useModal
        ? `<button class="btn recommendation-open" type="button" data-recommendation-open>추천 문구 목록에서 선택</button>
          <div class="recommendation-modal" hidden>
            <div class="recommendation-modal-head"><strong>${label} 추천</strong><button class="btn" type="button" data-recommendation-close>닫기</button></div>
            <div class="recommendation-modal-list">${items.map((item) => `<button class="recommendation-modal-option" type="button" data-recommendation="${escapeAdminHtml(item)}">${escapeAdminHtml(item)}</button>`).join("")}</div>
          </div>`
        : `<div class="recommendation-options">
            ${items.map((item, index) => `<button class="recommendation-option ${index > 2 ? "is-extra" : ""}" type="button" data-recommendation="${escapeAdminHtml(item)}">${escapeAdminHtml(item)}</button>`).join("")}
            <button class="recommendation-more" type="button" data-recommendation-more aria-label="${label} 추천 더 보기">＋</button>
          </div>`}
    </div>`;
}

function recommendationSets(groom, bride) {
  return {
    hero: ["our wedding day", "together, always", "a beautiful beginning", "with love, forever", "our favorite day", "the start of us"],
    title: [`${groom.name} ♥ ${bride.name} 결혼합니다`, `${groom.name} · ${bride.name}의 결혼식`, `저희 두 사람, 결혼합니다`, `함께하는 첫날에 초대합니다`, `우리의 새로운 시작`, `소중한 날, 함께해 주세요`],
    invitationTitle: ["소중한 분들을 초대합니다", "저희의 시작을 함께해 주세요", "따뜻한 축복으로 함께해 주세요", "두 사람이 하나 되는 날", "기쁜 날에 모시고 싶습니다", "함께해 주시면 감사하겠습니다"],
    invitationParagraphs: [
      "저희 두 사람이 서로의 가장 가까운 사람이 되어\n새로운 시작을 함께하려 합니다.\n소중한 자리에 함께해 주세요.",
      "서로를 아끼고 사랑하며\n평생의 동반자로 걸어가려 합니다.\n따뜻한 축복을 나누어 주세요.",
      "좋은 날, 좋은 분들과 함께\n저희의 첫걸음을 내딛고 싶습니다.\n귀한 걸음으로 자리를 빛내 주세요.",
      "오랜 시간 곁을 지켜준 두 사람이\n이제 한 가족이 되려 합니다.\n기쁜 마음으로 함께해 주세요.",
      "서로의 하루를 다정히 지켜주며\n평생을 함께 살아가겠습니다.\n저희의 시작을 축복해 주세요.",
      "설레는 마음으로 새로운 계절을 맞이합니다.\n두 사람의 약속이 오래도록 빛날 수 있도록\n함께해 주세요.",
      "각자의 자리에서 서로 다른 시간을 걸어온 저희가\n이제 같은 방향을 바라보며 한 걸음씩 나아가려 합니다.\n저희 두 사람의 새로운 출발을 따뜻한 마음으로 지켜봐 주세요.",
      "처음 만난 날의 설렘과 함께 웃었던 수많은 순간을 간직하며\n서로의 가장 좋은 친구이자 든든한 가족이 되기로 약속했습니다.\n소중한 분들과 이 기쁨을 함께 나누고 싶습니다.",
      "서로의 평범한 하루를 특별하게 만들어 준 두 사람이\n이제 매일의 기쁨과 어려움까지 함께 나누려 합니다.\n귀한 걸음으로 저희의 첫날을 축복해 주세요.",
    ],
  };
}

function noticeEditor(notice = {}, index = 0) {
  return `
    <div class="notice-editor" data-notice-editor>
      <div class="notice-editor-head"><strong>식장 안내 ${index + 1}</strong><button class="icon-btn" type="button" data-notice-remove aria-label="식장 안내 ${index + 1} 삭제">−</button></div>
      ${select(`noticePreset.${index}`, `식장 안내 ${index + 1} 추천`, "", noticePresets)}
      ${input(`notice.${index}.title`, "제목", notice.title || "")}
      <label class="field"><span>내용</span><textarea name="notice.${index}.text" rows="2" placeholder="${escapeAdminHtml(noticeContentPlaceholders[notice.title] || "")}">${escapeAdminHtml(notice.text || "")}</textarea></label>
      <label class="consent"><input type="checkbox" name="notice.${index}.hidden" ${notice.hidden ? "checked" : ""}> <span>청첩장에서 숨기기</span></label>
    </div>`;
}

function noticeManager(notices = []) {
  const editableNotices = notices.length ? notices.slice(0, 3) : venueGuideTemplate;
  return `
    <section class="editor-subsection"><div class="editor-subsection-head"><strong>식장 안내</strong><span>식사, 주차, 촬영 등 하객에게 알릴 내용을 관리합니다.</span></div>
    <p class="admin-message micro-help">내용을 입력하지 않으면 청첩장에서 숨김처리됩니다.</p>
    <p class="admin-message micro-help">한 줄에 하나씩 적고 «라벨 · 내용» 형식으로 쓰면 번호가 붙은 항목으로 나뉩니다. 구분자 «·» 없는 줄은 바로 윗 항목에 이어집니다.</p>
    <div class="notice-manager" data-notice-manager>
      <div class="notice-manager-list" data-notice-list>${editableNotices.map(noticeEditor).join("")}</div>
      <div class="notice-ai-actions">
        <button class="btn ai-generate-btn" type="button" data-ai-venue-guide>AI로 식장안내 생성</button>
        <button class="btn notice-add" type="button" data-notice-add>＋ 식장 안내 추가</button>
      </div>
    </div></section>`;
}

function transportLineEditor(line = {}, itemIndex = 0, lineIndex = 0) {
  return `
    <div class="transport-line-editor" data-transport-line>
      <input class="transport-line-icon-input" name="transport.${itemIndex}.lines.${lineIndex}.icon" value="${escapeAdminHtml(line.icon || "")}" maxlength="4" aria-label="줄 ${lineIndex + 1} 아이콘">
      <textarea name="transport.${itemIndex}.lines.${lineIndex}.text" rows="2" aria-label="줄 ${lineIndex + 1} 내용">${escapeAdminHtml(line.text || "")}</textarea>
      <button class="icon-btn" type="button" data-transport-line-remove aria-label="줄 ${lineIndex + 1} 삭제">×</button>
    </div>`;
}

function transportEditor(item = {}, index = 0) {
  const { TRANSPORT_TYPES: transportTypes, normalizeTransportTitle, normalizeTransportLines } = adminUtils;
  const selected = transportTypes.length ? normalizeTransportTitle(item.title) : item.title || "";
  const lines = normalizeTransportLines(item);
  return `
    <div class="notice-editor" data-transport-editor>
      <div class="notice-editor-head"><strong>교통 안내 ${index + 1}</strong><button class="icon-btn" type="button" data-transport-remove aria-label="교통 안내 ${index + 1} 삭제">×</button></div>
      ${select(`transport.${index}.title`, "교통수단", selected, transportTypes.map((type) => [type.label, `${type.icon} ${type.label}`]))}
      <div class="transport-line-list" data-transport-line-list>${lines.map((line, lineIndex) => transportLineEditor(line, index, lineIndex)).join("")}</div>
      <button class="btn notice-add transport-line-add" type="button" data-transport-line-add>＋ 줄 추가</button>
      <label class="consent"><input type="checkbox" name="transport.${index}.hidden" ${item.hidden ? "checked" : ""}> <span>청첩장에서 숨기기</span></label>
    </div>`;
}

function transportManager(items = []) {
  return `
    <section class="editor-subsection"><div class="editor-subsection-head"><strong>교통 안내</strong><span>가까운 역·정류장 기준으로 경로와 소요시간을 항목별로 관리합니다.</span></div>
    <p class="admin-message micro-help">교통수단을 선택하고, 각 줄의 아이콘과 내용을 입력해 주세요. 줄을 추가/삭제할 수 있고, 한 줄 안에서도 줄바꿈으로 여러 문장을 적을 수 있습니다. AI 연결 시에는 식장 주소 기준 가장 가까운 기차/지하철역과 버스정류장을 찾아 안내를 생성합니다.</p>
    <div class="notice-manager" data-transport-manager>
      <div class="notice-manager-list" data-transport-list>${items.map(transportEditor).join("")}</div>
      <div class="notice-ai-actions">
        <button class="btn ai-generate-btn" type="button" data-ai-transport-guide>AI로 교통안내 생성</button>
        <button class="btn notice-add" type="button" data-transport-add>＋ 교통 안내 추가</button>
      </div>
    </div></section>`;
}

function ensureAccountRows(accounts = [], sourceData = invitationData, options = {}) {
  const appendMissing = options.appendMissing !== false;
  const [groomFather = "", groomMother = ""] = parentNames(sourceData.couple?.groom?.parents || "");
  const [brideFather = "", brideMother = ""] = parentNames(sourceData.couple?.bride?.parents || "");
  const expectedNames = {
    "신랑측:신랑": sourceData.couple?.groom?.name || "신랑",
    "신랑측:아버님": groomFather,
    "신랑측:어머님": groomMother,
    "신부측:신부": sourceData.couple?.bride?.name || "신부",
    "신부측:아버님": brideFather,
    "신부측:어머님": brideMother,
  };
  const defaults = [
    { side: "신랑측", relation: "신랑", name: expectedNames["신랑측:신랑"], bank: "", number: "" },
    { side: "신랑측", relation: "아버님", name: groomFather, bank: "", number: "" },
    { side: "신랑측", relation: "어머님", name: groomMother, bank: "", number: "" },
    { side: "신부측", relation: "신부", name: expectedNames["신부측:신부"], bank: "", number: "" },
    { side: "신부측", relation: "아버님", name: brideFather, bank: "", number: "" },
    { side: "신부측", relation: "어머님", name: brideMother, bank: "", number: "" },
  ].filter((account) => ["신랑", "신부"].includes(account.relation) || account.name);
  const autoKey = (account = {}) => [account.side || "", account.relation || "", account.name || account.personName || ""].join(":");
  const suppressed = new Set(sourceData.accountSuppressedKeys || []);
  const normalizeRelation = (relation = "") => {
    if (relation.includes("아버")) return "아버님";
    if (relation.includes("어머")) return "어머님";
    if (relation === "신랑") return "신랑";
    if (relation === "신부") return "신부";
    return relation || "";
  };
  const normalized = accounts.map((account) => {
    const side = account.side || "신랑측";
    const relation = normalizeRelation(account.relation);
    const expectedName = expectedNames[`${side}:${relation}`];
    if (expectedName === "") return null;
    return {
      side,
      relation,
      personName: expectedName || account.personName || account.name || "",
      name: expectedName || account.name || account.personName || "",
      bank: account.bank || "",
      number: account.number || "",
    };
  }).filter(Boolean);
  const missingDefaults = appendMissing ? defaults.filter((fallback) =>
    !suppressed.has(autoKey(fallback)) &&
    !normalized.some((account) => account.side === fallback.side && account.relation === fallback.relation)) : [];
  return [...normalized, ...missingDefaults];
}

function autoAccountKey(account = {}) {
  return [account.side || "", account.relation || "", account.personName || account.name || ""].join(":");
}

function formatAccountNumber(value = "") {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits || raw.includes("-") || digits.length < 8) return raw;
  if (digits.length <= 10) return digits.replace(/(\d{3})(\d{2,3})(\d+)/, "$1-$2-$3");
  if (digits.length <= 12) return digits.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3");
  return digits.replace(/(\d{3})(\d{4})(\d{4})(\d+)/, "$1-$2-$3-$4");
}

function accountManager(accounts = [], options = {}) {
  const groups = ["신랑측", "신부측"];
  const relationOptions = ["신랑", "신부", "아버님", "어머님", "형제", "자매", "직접입력"];
  const normalizedAccounts = ensureAccountRows(accounts, invitationData, options);
  const accountEditor = (account, index) => `
    <div class="account-editor" data-account-editor>
      <button class="icon-btn account-remove" type="button" data-account-remove aria-label="계좌 삭제">×</button>
      <input type="hidden" name="account.${index}.side" value="${escapeAdminHtml(account.side)}">
      <div class="account-row account-row-main">
        <div class="account-name-relation">
          ${input(`account.${index}.personName`, "이름", account.personName || account.name || "")}
          ${select(`account.${index}.relation`, "관계", relationOptions.includes(account.relation) ? account.relation : account.relation ? "직접입력" : "", [["", "선택"], ...relationOptions.map((item) => [item, item])])}
        </div>
      </div>
      <div class="account-row account-row-custom" data-account-relation-custom ${relationOptions.includes(account.relation) || !account.relation ? "hidden" : ""}>
        ${input(`account.${index}.relationCustom`, "관계 직접 입력", relationOptions.includes(account.relation) ? "" : account.relation || "")}
      </div>
      <div class="account-row">
        ${input(`account.${index}.name`, "예금주", account.name || account.personName || "")}
      </div>
      <div class="account-row account-row-bank">
        ${select(`account.${index}.bankSelect`, "은행", bankOptions.includes(account.bank) ? account.bank : account.bank ? "직접 입력" : "", bankOptions.map((bank) => [bank, bank || "선택"]))}
      </div>
      <div class="account-row">
        ${input(`account.${index}.number`, "계좌번호", formatAccountNumber(account.number))}
      </div>
      <div class="account-row account-row-custom" data-account-bank-custom ${bankOptions.includes(account.bank) ? "hidden" : ""}>
        ${input(`account.${index}.bank`, "은행 직접 입력", account.bank)}
      </div>
    </div>`;
  return `
    <section class="editor-subsection account-manager-section" data-account-manager><div class="editor-subsection-head"><strong>계좌 안내</strong><span>필요한 계좌만 남기고 추가·삭제할 수 있습니다.</span></div>
    <div class="account-manager" data-account-list>
      ${groups.map((side) => `
        <section class="account-side-group" data-account-side="${side}">
          <div class="account-side-head"><strong>${side} 계좌</strong></div>
          <div class="account-side-list">
            ${normalizedAccounts.map((account, index) => ({ account, index })).filter(({ account }) => account.side === side).map(({ account, index }) => accountEditor(account, index)).join("")}
          </div>
          <button class="btn account-add" type="button" data-account-add="${side}">＋ 계좌 추가</button>
        </section>`).join("")}
    </div></section>`;
}

function renderEditor(message = "", focus = "") {
  const viewByFocus = { copy: "copy-editor", share: "share-settings", gallery: "gallery", sections: "sections" };
  rememberAdminView(viewByFocus[focus] || "editor");
  const isCopyFocus = focus === "copy";
  const isGalleryFocus = focus === "gallery" || focus === "copy";
  window.WEDDING_DESIGN?.normalize(invitationData);
  document.documentElement.style.removeProperty("--save-lift");
  if (!Array.isArray(invitationData.accounts)) {
    invitationData.accounts = ensureAccountRows([]);
  }
  const { groom, bride } = invitationData.couple;
  const [groomFather = "", groomMother = ""] = parentNames(groom.parents);
  const [brideFather = "", brideMother = ""] = parentNames(bride.parents);
  const recommendations = recommendationSets(groom, bride);
  const gallery = Array.from({ length: GALLERY_MAX }, (_, index) => invitationData.gallery[index] || "");
  const galleryThumbs = Array.from({ length: GALLERY_MAX }, (_, index) => invitationData.galleryThumbs?.[index] || "");
  const editorTitle = focus === "share" ? "카카오톡 공유카드 설정" : focus === "gallery" ? "갤러리 설정" : focus === "copy" ? "편집 기능" : focus === "sections" ? "섹션 순서·보이기" : "기본 정보";
  const editorActiveMenu = focus === "copy" ? "copy" : focus === "share" ? "share" : focus === "gallery" ? "content" : focus === "sections" ? "sections" : "editor";
  const publicToday = dateInputToday();
  const publicWeddingDay = dateOnly(invitationData.wedding.date);
  const publicOpenMax = publicWeddingDay ? addDays(publicWeddingDay, -1) : "";
  let publicOpenValue = invitationData.publicPeriod?.openDate || publicToday;
  if (publicOpenValue < publicToday) publicOpenValue = publicToday;
  if (publicOpenMax && publicOpenValue > publicOpenMax) publicOpenValue = publicOpenMax;
  const publicCloseMax = publicWeddingDay ? addDays(publicWeddingDay, 3) : "";
  let publicCloseValue = invitationData.publicPeriod?.closeDate || publicWeddingDay;
  if (publicCloseValue && publicOpenValue && publicCloseValue < publicOpenValue) publicCloseValue = publicWeddingDay || publicOpenValue;
  if (publicCloseMax && publicCloseValue > publicCloseMax) publicCloseValue = publicCloseMax;
  adminApp.innerHTML = `
    ${adminHeader(editorActiveMenu)}
    ${focus === "gallery" ? contentBackBar("갤러리") : ""}
    <section class="admin-card admin-editor-view view-${escapeAdminHtml(focus || "basic")}${isCopyFocus ? copyEditorModeClass() : ""}">
      ${isCopyFocus ? (message ? `<p class="admin-message">${escapeAdminHtml(message)}</p>` : "") : `<div class="admin-editor-intro">
        <div><p class="section-label">${focus === "sections" ? "Sections" : focus === "share" ? "Share" : focus === "gallery" ? "Gallery" : "Basic"}</p><h2>${editorTitle}</h2></div>
      </div>
      <p class="admin-message">${escapeAdminHtml(message || editorIntroHelp(focus))}</p>`}
      ${focus === "sections" ? sectionModeTabs() : ""}
      <nav class="admin-quick-actions basic-pane guided-progress" aria-label="입력 단계">
        <button type="button" data-editor-jump="couple-settings"><b>1</b><span>기본정보</span></button>
        <button type="button" data-editor-jump="main-media-settings"><b>2</b><span>첫 사진</span></button>
        <button type="button" data-editor-jump="people-detail-settings"><b>3</b><span>두 사람</span></button>
        <button type="button" data-editor-jump="wedding-detail-settings"><b>4</b><span>예식장소</span></button>
        <button type="button" data-editor-jump="account-settings"><b>5</b><span>계좌</span></button>
        <button type="button" data-editor-jump="public-period-settings"><b>6</b><span>공개기간</span></button>
      </nav>
      <p class="guided-save-hint basic-pane" data-guided-save-hint hidden>신랑·신부 이름, 식장, 예식 일시, 주소를 채우면 저장할 수 있어요.</p>
      <form class="editor-form" id="invitation-editor">
        <fieldset class="basic-pane guided-step" id="couple-settings" data-guided-step="core"><legend><b class="step-no">1</b>기본 정보</legend>
          <p class="admin-message">가장 먼저 채워 주세요. 입력하면 첫 화면·초대글·두 사람 소개·계좌에 바로 반영돼요.</p>
          <div class="quick-couple-cards">
            <section class="quick-side-card">
              <h3>신랑</h3>
              <div class="quick-field-row">
                ${quickInput("couple.groom.name", "이름", groom.name)}
                ${quickInput("couple.groom.birthday", "생일", birthdayInputValue(groom.birthday), "date")}
              </div>
              <div class="quick-field-row">
                ${quickInput("groomFather", "아버지", groomFather)}
                ${quickInput("groomMother", "어머니", groomMother)}
              </div>
            </section>
            <section class="quick-side-card">
              <h3>신부</h3>
              <div class="quick-field-row">
                ${quickInput("couple.bride.name", "이름", bride.name)}
                ${quickInput("couple.bride.birthday", "생일", birthdayInputValue(bride.birthday), "date")}
              </div>
              <div class="quick-field-row">
                ${quickInput("brideFather", "아버지", brideFather)}
                ${quickInput("brideMother", "어머니", brideMother)}
              </div>
            </section>
          </div>
          <p class="basic-subhead">예식</p>
          <div class="quick-input-grid">
            ${quickInput("wedding.venue", "식장", invitationData.wedding.venue)}
            ${quickInput("wedding.hall", "홀", invitationData.wedding.hall || "")}
            ${quickInput("wedding.date", "날짜·시간", weddingDateInputValue(invitationData.wedding.date), "datetime-local")}
          </div>
          <p class="basic-subhead">청첩장에 보여 줄 정보</p>
          <div class="visibility-switch-grid">
            ${visibilitySelect("displaySettings.showInvitationParents", "초대글 부모님 성함", invitationData.displaySettings?.showInvitationParents)}
            ${visibilitySelect("displaySettings.showProfileParents", "두 사람 소개 부모님 성함", invitationData.displaySettings?.showProfileParents)}
            ${visibilitySelect("displaySettings.showProfileBirthdays", "두 사람 소개 생일", invitationData.displaySettings?.showProfileBirthdays)}
          </div>
          <p class="admin-message micro-help">끄면 그 부분만 청첩장에서 숨겨져요. 계좌 이름에는 그대로 쓰여요.</p>
        </fieldset>
        <fieldset class="basic-pane guided-step" id="main-media-settings" data-guided-step="media" data-step-requires="core"><legend><b class="step-no">2</b>첫 화면 사진</legend>
          <p class="admin-message micro-help">청첩장을 열면 가장 먼저 크게 보이는 사진이에요. 글자 위치·크기는 편집 탭에서 바꿀 수 있어요.</p>
          ${heroActiveMediaField(invitationData.hero)}
          ${imageField("hero.image", "메인 사진", invitationData.hero.image)}
          <input type="hidden" name="hero.video" value="">
        </fieldset>
        <div class="share-pane share-link-box">
          <strong>내 청첩장 링크</strong>
          <button class="share-link-copy" type="button" data-share-link-copy data-share-link="" aria-label="청첩장 링크 복사" title="링크 복사">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
            <span class="share-link-copied" aria-hidden="true">복사됐어요</span>
          </button>
        </div>
        <div class="share-pane share-link-box share-guest-link">
          <label><strong>이름 넣은 링크</strong><span>봉투에 "to. 이름"이 보여요</span>
            <input type="text" maxlength="20" placeholder="받는 분 이름" autocomplete="off" data-share-guest-name>
          </label>
          <button class="share-link-copy" type="button" data-share-guest-copy aria-label="이름 넣은 링크 복사" title="링크 복사">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
            <span class="share-link-copied" aria-hidden="true">복사됐어요</span>
          </button>
        </div>
        <fieldset class="share-pane" id="share-settings"><legend>미리보기</legend>
          <div class="kakao-card-preview" data-kakao-preview aria-label="카카오톡 공유 카드 미리보기">
            <div class="kakao-chat-row">
              <span class="kakao-chat-avatar" aria-hidden="true"></span>
              <div class="kakao-card">
                <div class="kakao-card-image" data-kakao-image data-share-jump="1" role="button" tabindex="0" aria-label="카드 사진 고치기"><b class="share-step-mark">1</b><span data-kakao-image-empty>사진 없음</span></div>
                <div class="kakao-card-body">
                  <strong data-kakao-title data-share-jump="2" role="button" tabindex="0" aria-label="카드 제목 고치기"></strong><b class="share-step-mark" data-share-jump="2">2</b>
                  <p data-kakao-desc data-share-jump="3" role="button" tabindex="0" aria-label="카드 설명 고치기"></p><b class="share-step-mark" data-share-jump="3">3</b>
                </div>
                <div class="kakao-card-buttons"><span>청첩장 보기</span><span>위치 보기</span></div>
              </div>
            </div>
          </div>
          <div class="share-summary">
            <button type="button" data-share-jump="1"><b class="share-step-mark">1</b><span>카드 사진</span><em data-share-summary="1"></em><i aria-hidden="true">›</i></button>
            <button type="button" data-share-jump="2"><b class="share-step-mark">2</b><span>카드 제목</span><em data-share-summary="2"></em><i aria-hidden="true">›</i></button>
            <button type="button" data-share-jump="3"><b class="share-step-mark">3</b><span>카드 설명</span><em data-share-summary="3"></em><i aria-hidden="true">›</i></button>
          </div>
          <section class="share-sheet" data-share-sheet hidden aria-label="공유 카드 편집">
            <div class="share-sheet-head">
              <b class="share-step-mark" data-share-sheet-mark>1</b><strong data-share-sheet-title>카드 사진</strong>
              <button class="btn btn-primary" type="button" data-share-sheet-close>완료</button>
            </div>
            <div class="share-edit-panel" data-share-panel="1">
              ${imageField("meta.shareImage", "카드 사진 (선택)", invitationData.meta.shareImage || "")}
              <p class="admin-message micro-help">비워 두면 첫 화면 메인 사진이 들어가요. 세로 3:4(예: 600×800) 사진이 카드에 가장 잘 맞아요.</p>
            </div>
            <div class="share-edit-panel" data-share-panel="2" hidden>
              ${recommendationEditor("meta.title", "카드 제목", invitationData.meta.title, recommendations.title)}
              <p class="admin-message micro-help">카드 맨 위 굵은 글씨예요. 인터넷 창 제목과 링크 미리보기 제목으로도 쓰여요.</p>
            </div>
            <div class="share-edit-panel" data-share-panel="3" hidden>
              ${textarea("meta.description", "카드 설명 (선택)", invitationData.meta.description)}
              <p class="admin-message micro-help">제목 아래 회색 글씨예요. 비워 두면 예식 날짜와 식장이 자동으로 들어가요. 두 줄 안쪽이 보기 좋아요.</p>
            </div>
          </section>
          <p class="admin-message micro-help share-cache-note">카카오톡은 같은 링크의 미리보기를 한동안 기억해요. 링크를 붙여 넣어 보내면 바꾼 내용이 늦게 보일 수 있지만, 청첩장 안의 공유 버튼으로 보내면 바로 반영돼요.</p>
        </fieldset>
        <div class="couple-editor-grid basic-pane guided-step" id="people-detail-settings" data-guided-step="people" data-step-requires="core">
        <div class="guided-group-title"><strong><b class="step-no">3</b>두 사람 소개</strong><span>'두 사람 소개' 섹션에 들어가는 연락처·사진·태그예요. 이름과 부모님은 1번에서 바꿔요.</span></div>
        <fieldset class="couple-editor-card"><legend>신랑</legend>
          <input type="hidden" name="couple.groom.name" value="${escapeAdminHtml(groom.name)}">
          <input type="hidden" name="couple.groom.parents" value="${escapeAdminHtml(groom.parents)}">
          <input type="hidden" name="couple.groom.birthday" value="${escapeAdminHtml(birthdayInputValue(groom.birthday))}">
          <div class="person-head">
            ${imageField("couple.groom.photo", "신랑 사진", groom.photo)}
            <div class="auto-filled-fields" data-auto-summary="groom"><strong data-auto-value="groom.name">${escapeAdminHtml(groom.name)}</strong><span><b>부모님</b><i data-auto-value="groom.parents">${escapeAdminHtml(displayParentNames(groom.parents) || "미입력")}</i></span><span><b>생일</b><i data-auto-value="groom.birthday">${escapeAdminHtml(groom.birthday || "미입력")}</i></span></div>
          </div>
          <div class="person-fields">
            ${input("couple.groom.relation", "관계 문구 (예: 의 아들)", groom.relation)}
            ${input("couple.groom.phone", "연락처", groom.phone, "tel")}
          </div>
          ${input("couple.groom.mbti", "별칭·MBTI 등", groom.mbti)}
          ${tagFields("couple.groom.tags", "성격 태그", groom.tags)}
        </fieldset>
        <fieldset class="couple-editor-card"><legend>신부</legend>
          <input type="hidden" name="couple.bride.name" value="${escapeAdminHtml(bride.name)}">
          <input type="hidden" name="couple.bride.parents" value="${escapeAdminHtml(bride.parents)}">
          <input type="hidden" name="couple.bride.birthday" value="${escapeAdminHtml(birthdayInputValue(bride.birthday))}">
          <div class="person-head">
            ${imageField("couple.bride.photo", "신부 사진", bride.photo)}
            <div class="auto-filled-fields" data-auto-summary="bride"><strong data-auto-value="bride.name">${escapeAdminHtml(bride.name)}</strong><span><b>부모님</b><i data-auto-value="bride.parents">${escapeAdminHtml(displayParentNames(bride.parents) || "미입력")}</i></span><span><b>생일</b><i data-auto-value="bride.birthday">${escapeAdminHtml(bride.birthday || "미입력")}</i></span></div>
          </div>
          <div class="person-fields">
            ${input("couple.bride.relation", "관계 문구 (예: 의 아들)", bride.relation)}
            ${input("couple.bride.phone", "연락처", bride.phone, "tel")}
          </div>
          ${input("couple.bride.mbti", "별칭·MBTI 등", bride.mbti)}
          ${tagFields("couple.bride.tags", "성격 태그", bride.tags)}
        </fieldset>
        </div>
        <fieldset class="basic-pane guided-step" id="wedding-detail-settings" data-guided-step="wedding" data-step-requires="core"><legend><b class="step-no">4</b>예식 장소</legend>
          <input type="hidden" name="wedding.date" value="${escapeAdminHtml(weddingDateInputValue(invitationData.wedding.date))}">
          <input type="hidden" name="wedding.venue" value="${escapeAdminHtml(invitationData.wedding.venue)}">
          <input type="hidden" name="wedding.hall" value="${escapeAdminHtml(invitationData.wedding.hall || "")}">
          <div class="auto-filled-fields" data-auto-summary="wedding"><strong data-auto-value="wedding.venue">${escapeAdminHtml(invitationData.wedding.venue)}</strong><span><i data-auto-value="wedding.hallDate">${escapeAdminHtml(invitationData.wedding.hall || "홀 정보 없음")} · ${escapeAdminHtml(invitationData.wedding.displayDate)}</i></span></div>
          ${select("wedding.displayDateFormat", "청첩장에 보일 날짜 형식", invitationData.wedding.displayDateFormat || "long_ko", [["long_ko", "2026. 10. 04. 일요일 오후 12시 20분"], ["short_ko", "26-10-04 (일) 12시 20분"], ["dot_numeric", "2026.10.04 (일) 12:20"], ["english", "2026. 10. 04. 일요일 · 12:20"], ["custom", "직접 입력"]])}
          ${input("wedding.displayDateCustom", "보일 날짜 (직접 고칠 수 있어요)", invitationData.wedding.displayDateCustom || invitationData.wedding.displayDate)}
          <div class="address-row">
            ${input("wedding.address", "주소", invitationData.wedding.address)}
            <button class="btn address-search-btn" type="button" data-address-search>검색</button>
          </div>
          ${input("wedding.officialUrl", "식장 홈페이지 (선택)", invitationData.wedding.officialUrl || "", "url")}
          <p class="admin-message" data-venue-status>등록된 식장은 이름을 입력하면 주소가 자동으로 채워집니다. 다른 식장은 주소 검색에서 지도 확인 또는 직접입력을 사용할 수 있습니다.</p>
          <div class="interlude-upload-admin">
            ${imageField("media.interludePhoto", "중간 사진 (달력과 오시는 길 사이)", invitationData.media?.interludePhoto || "")}
          </div>
        </fieldset>
        <details class="editor-details basic-pane guided-step" id="account-settings" open data-guided-step="accounts" data-step-requires="wedding"><summary><b class="step-no">5</b>계좌 안내</summary><div class="editor-details-body">
          ${textarea("sectionDescriptions.account", "계좌 안내 문구", invitationData.sectionDescriptions?.account || "참석이 어려우신 분들을 위해\n계좌번호를 안내해 드립니다.")}
          ${accountManager(invitationData.accounts)}
        </div></details>
        <details class="editor-details basic-pane guided-step" id="public-period-settings" open data-guided-step="guestPhotos" data-step-requires="wedding"><summary><b class="step-no">6</b>공개 기간</summary><div class="editor-details-body">
          <p class="admin-message micro-help">이 기간에만 링크로 청첩장을 볼 수 있어요.</p>
          <p class="basic-subhead">청첩장 공개 기간</p>
          <div class="quick-input-grid">
            <label class="field"><span>시작일</span><input name="publicPeriod.openDate" type="date" value="${escapeAdminHtml(publicOpenValue)}" min="${escapeAdminHtml(publicToday)}" max="${escapeAdminHtml(publicOpenMax)}"></label>
            <label class="field"><span>종료일</span><input name="publicPeriod.closeDate" type="date" value="${escapeAdminHtml(publicCloseValue)}" min="${escapeAdminHtml(publicOpenValue)}" max="${escapeAdminHtml(publicCloseMax)}"></label>
          </div>
          <p class="admin-message micro-help">종료일은 예식일로부터 3일 뒤까지 고를 수 있어요.</p>
        </div></details>
        ${isCopyFocus ? `<section class="copy-pane" data-copy-editor-panel>
          <div class="copy-editor-page${copyEditorModeClass()}">
            <button type="button" class="design-summary" data-design-toggle aria-expanded="false">
              <span class="design-summary-label">전체 디자인</span>
              <span class="design-summary-value" data-design-summary></span>
              <span class="design-summary-action">변경</span>
            </button>
            ${editorDesignPanel()}
            <p class="editor-area-label editor-area-screens">편집할 화면</p>
            ${editorSubTabs(copyEditorMode)}
            <p class="admin-message editor-subtab-help" data-editor-subtab-help>${escapeAdminHtml(copyEditorHelp())}</p>
            ${musicPanelMarkup()}
            <button class="copy-frame-interaction-toggle" type="button" aria-pressed="false" data-copy-frame-toggle>
              <span class="copy-frame-toggle-label">수정모드</span>
              <span class="copy-frame-toggle-switch" aria-hidden="true"></span>
              <span class="copy-frame-toggle-state" data-copy-frame-toggle-state>OFF</span>
            </button>
            <div class="copy-editor-frame-scroll" data-copy-frame-scroll>
              <iframe class="copy-editor-public-frame" src="./index.html?copyEditorPreview=1&v=20261027-intro1" title="공개 청첩장 문구 수정 미리보기" scrolling="yes" data-copy-editor-frame></iframe>
            </div>
            <aside class="copy-editor-drawer" data-copy-editor-drawer>
            <section class="copy-editor-section copy-editor-intro-settings">
          ${introDesignEditor(groom, bride)}
            </section>
            </aside>
            <div class="copy-editor-field-store" hidden>
          ${Object.entries(invitationData.sectionTitles || {}).map(([key, title]) => `
              <div class="quick-input-grid">
              ${input(`sectionTitles.${key}.en`, `${key} 영문 타이틀`, title.en || "")}
              ${input(`sectionTitles.${key}.ko`, `${key} 국문 타이틀`, title.ko || "")}
              </div>
              ${key === "invitation" ? `${recommendationEditor("invitation.title", "초대 문구 제목", invitationData.invitation.title, recommendations.invitationTitle)}
              ${textarea("invitation.paragraphs", "초대 문구 · **글자**로 감싸면 굵게", invitationData.invitation.paragraphs.join("\n\n"))}` : ""}`).join("")}
          ${textarea("sectionDescriptions.attendance", "참석 의사 안내 문구", invitationData.sectionDescriptions?.attendance || "신랑, 신부에게 참석의사를\n미리 전달할 수 있어요.")}
          ${textarea("sectionDescriptions.guestbook", "방명록 안내 문구", invitationData.sectionDescriptions?.guestbook || "따뜻한 마음을 짧게 남겨 주세요.")}
          ${textarea("ending.text", "마지막 문구", invitationData.ending.text)}
          ${imageField("ending.image", "마지막 사진", invitationData.ending.image)}
            </div>
          </div>
        </section>` : '<section class="copy-pane" data-copy-editor-panel hidden></section>'}
        ${isGalleryFocus ? `<section class="editor-details content-pane content-settings-card" id="gallery-settings"><div class="editor-details-title">갤러리<button class="btn btn-secondary gallery-modal-close" type="button" data-gallery-modal-close hidden>닫기</button></div><div class="editor-details-body">
          <p class="admin-message">최대 ${GALLERY_MAX}장까지 등록할 수 있습니다. 공개 화면에는 접속할 때마다 등록 사진 중 무작위 6장이 미리보기로 표시됩니다.</p>
          ${select("galleryDisplayMode", "사진 확대 화면 표시 방식", invitationData.galleryDisplayMode || "portrait", [["portrait", "세로형 화면에 맞추기"], ["original", "원본 사진 비율 유지"]])}
          ${galleryManager(gallery, galleryThumbs)}
        </div></section>` : '<section class="editor-details content-pane content-settings-card" id="gallery-settings" hidden></section>'}
        <details class="editor-details section-pane" open data-guided-step="sections" data-step-requires="wedding"><summary>섹션 순서와 노출 설정</summary><div class="editor-details-body">
          <ul class="section-order-tips">
            <li><b>☑</b>체크를 끄면 그 섹션이 청첩장에서 숨겨져요.</li>
            <li><b>☰</b>오른쪽 손잡이를 누른 채 위아래로 끌면 순서가 바뀌어요.</li>
          </ul>
          <div class="section-order-columns" data-section-columns data-active="${isWeddingDayNow() ? "weddingDay" : "preWedding"}">
            ${sectionOrderEditor("sectionSettings.preWedding", "결혼식 전까지", invitationData.sectionSettings?.preWedding, "preWedding")}
            ${sectionOrderEditor("sectionSettings.weddingDay", "결혼식 당일부터", invitationData.sectionSettings?.weddingDay, "weddingDay")}
          </div>
          <p class="admin-message micro-help">미리보기는 저장된 내용으로 열려요. 바꾼 뒤 먼저 저장해 주세요.</p>
        </div></details>
        <button class="btn btn-primary editor-save" id="editor-save">청첩장 저장</button>
      </form>
      ${isCopyFocus ? stickerSheetMarkup() : ""}
    </section>`;
  bindAdminNavigation();
  bindEditor();
  if (focus === "share") bindKakaoPreview();
  startEditorChangeTracking();
  if (isCopyFocus) {
    bindDesignSummary();
    bindIntroSheet();
    bindStickerTools();
    bindMusicPanel();
  }
  bindSectionModeTabs();
  bindGuidedStepHighlight();
  bindBasicAccordion();
}

// 편집 탭 '전체 디자인': 평소엔 '레이아웃 · 테마' 한 줄, 누르면 고르는 칸이 펼쳐짐
function bindDesignSummary() {
  const toggle = adminApp.querySelector("[data-design-toggle]");
  const page = adminApp.querySelector(".copy-editor-page");
  if (!toggle || !page) return;
  const value = toggle.querySelector("[data-design-summary]");
  const update = () => {
    const layout = page.querySelector(".editor-layout-btn.is-active")?.textContent.replace("✓", "").trim() || "";
    const themeSelect = page.querySelector(".editor-theme-strip select");
    const theme = themeSelect?.selectedOptions?.[0]?.textContent.trim() || "";
    value.textContent = [layout, theme].filter(Boolean).join(" · ");
  };
  toggle.addEventListener("click", () => {
    const open = !page.classList.contains("is-design-open");
    page.classList.toggle("is-design-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".design-summary-action").textContent = open ? "접기" : "변경";
  });
  page.addEventListener("click", () => requestAnimationFrame(update));
  page.addEventListener("change", update);
  update();
}

// 진입 화면: 미리보기는 위, 조절 칸은 아래 고정 편집창에서 한 묶음씩
function bindIntroSheet() {
  const sheet = adminApp.querySelector("[data-intro-sheet]");
  if (!sheet) return;
  const root = document.documentElement;
  const syncLift = () => {
    if (!sheet.isConnected) { observer.disconnect(); root.style.removeProperty("--save-lift"); return; }
    const fixed = getComputedStyle(sheet).position === "fixed" && sheet.offsetHeight > 0;
    if (fixed) root.style.setProperty("--save-lift", `${sheet.offsetHeight}px`);
    else root.style.removeProperty("--save-lift");
  };
  const observer = new ResizeObserver(syncLift);
  observer.observe(sheet);
  sheet.addEventListener("editor-mode-sync", syncLift);
  syncLift();
  sheet.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-intro-sheet-tab]");
    if (!tab) return;
    sheet.querySelectorAll("[data-intro-sheet-tab]").forEach((button) => button.classList.toggle("is-active", button === tab));
    sheet.querySelectorAll("[data-intro-pane]").forEach((pane) => { pane.hidden = pane.dataset.introPane !== tab.dataset.introSheetTab; });
    sheet.scrollTop = 0;
  });
  // 모양을 바꿔 지금 탭이 숨겨지면(봉투↔타이핑) 첫 탭으로
  sheet.addEventListener("click", (event) => {
    if (!event.target.closest('[data-intro-choice="style"]')) return;
    requestAnimationFrame(() => {
      const active = sheet.querySelector("[data-intro-sheet-tab].is-active");
      if (active?.hidden) sheet.querySelector('[data-intro-sheet-tab="shape"]')?.click();
    });
  });
}

// 공유 탭: 입력한 값으로 카카오톡 카드 미리보기를 바로 그림
function bindKakaoPreview() {
  const preview = adminApp.querySelector("[data-kakao-preview]");
  const form = adminApp.querySelector("#invitation-editor");
  if (!preview || !form) return;
  const image = preview.querySelector("[data-kakao-image]");
  const title = preview.querySelector("[data-kakao-title]");
  const desc = preview.querySelector("[data-kakao-desc]");
  const descField = form.elements["meta.description"];
  const defaultDesc = () => [invitationData.wedding?.displayDate, invitationData.wedding?.venue].filter(Boolean).join("\n");
  if (descField) descField.placeholder = `비워 두면: ${defaultDesc().replace("\n", " · ")}`;
  const update = () => {
    const src = form.elements["meta.shareImage"]?.value || form.elements["hero.image"]?.value || invitationData.hero?.image || "";
    image.style.backgroundImage = src ? `url("${adminMediaUrl(src)}")` : "";
    image.classList.toggle("is-empty", !src);
    title.textContent = form.elements["meta.title"]?.value.trim() || "카드 제목을 입력해 주세요";
    desc.textContent = descField?.value.trim() || defaultDesc();
    const summary = (step) => adminApp.querySelector(`[data-share-summary="${step}"]`);
    if (summary(1)) summary(1).textContent = form.elements["meta.shareImage"]?.value ? "직접 고른 사진" : "메인 사진 사용 중";
    if (summary(2)) summary(2).textContent = title.textContent;
    if (summary(3)) summary(3).textContent = descField?.value.trim() ? descField.value.trim().replace(/\s*\n\s*/g, " ") : "자동 (날짜·식장)";
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("click", (event) => { if (event.target.closest("[data-recommendation]")) setTimeout(update, 0); });
  // 사진은 올리거나 지우면 숨은 칸 값만 바뀌므로 사진 미리보기 변화를 보고 다시 그림
  const imagePreview = form.querySelector('[data-image-preview="meta.shareImage"]');
  if (imagePreview) new MutationObserver(update).observe(imagePreview, { childList: true, subtree: true, attributes: true });
  update();

  // 카드의 ①②③(사진·제목·설명)이나 아래 목록을 누르면 그 칸만 담긴 편집창이 아래에서 올라옴
  const sheet = adminApp.querySelector("[data-share-sheet]");
  const stepTitles = { 1: "카드 사진", 2: "카드 제목", 3: "카드 설명" };
  const fieldForStep = { 2: "meta.title", 3: "meta.description" };
  const hideSheet = () => {
    sheet.hidden = true;
    preview.querySelectorAll(".is-editing").forEach((node) => node.classList.remove("is-editing"));
    document.activeElement?.blur?.();
  };
  const openSheet = (step) => {
    if (sheet.hidden) openAdminOverlay(hideSheet);
    sheet.hidden = false;
    sheet.querySelector("[data-share-sheet-mark]").textContent = step;
    sheet.querySelector("[data-share-sheet-title]").textContent = stepTitles[step];
    sheet.querySelectorAll("[data-share-panel]").forEach((panel) => { panel.hidden = panel.dataset.sharePanel !== String(step); });
    preview.querySelectorAll("[data-share-jump]").forEach((node) => node.classList.toggle("is-editing", node.dataset.shareJump === String(step)));
    // 카드가 편집창에 가리지 않게 카드 위쪽으로 맞춤
    window.scrollTo({ top: Math.max(0, preview.getBoundingClientRect().top + window.scrollY - 76), behavior: "smooth" });
    const field = form.elements[fieldForStep[step]];
    if (field) field.focus({ preventScroll: true });
  };
  const closeSheet = () => {
    hideSheet();
    closeAdminOverlay(hideSheet);
  };
  adminApp.querySelector("#share-settings").addEventListener("click", (event) => {
    const target = event.target.closest("[data-share-jump]");
    if (target) openSheet(target.dataset.shareJump);
  });
  preview.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-share-jump]");
    if (target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openSheet(target.dataset.shareJump); }
  });
  sheet.querySelector("[data-share-sheet-close]").addEventListener("click", closeSheet);

  const slug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || currentInvitationSite?.slug || "";
  const link = adminApp.querySelector("[data-share-link]");
  // 사용자별 주소: /청첩장주소, 이름 넣은 링크는 /청첩장주소/받는분 (기본 청첩장은 사이트 첫 주소)
  const invitationLink = (to = "") => window.RSVP_STORAGE?.invitationPageUrl?.(slug, to) || `${location.origin}/`;
  if (link) link.dataset.shareLink = invitationLink();
  const copyLink = async (button, url) => {
    try {
      await navigator.clipboard.writeText(url);
      button.classList.add("is-copied");
      setTimeout(() => button.classList.remove("is-copied"), 1600);
    } catch {
      window.prompt("아래 링크를 길게 눌러 복사해 주세요", url);
    }
  };
  adminApp.querySelector("[data-share-link-copy]")?.addEventListener("click", (event) => copyLink(event.currentTarget, link.dataset.shareLink));
  // 이름 넣은 링크: 비워 두고 누르면 이름 없는 기본 링크가 복사됨
  const guestName = adminApp.querySelector("[data-share-guest-name]");
  adminApp.querySelector("[data-share-guest-copy]")?.addEventListener("click", (event) => copyLink(event.currentTarget, invitationLink(guestName?.value.trim() || "")));
}

function bindSectionModeTabs() {
  const columns = adminApp.querySelector("[data-section-columns]");
  if (!columns) return;
  adminApp.querySelectorAll("[data-section-mode]").forEach((button) => button.addEventListener("click", () => {
    columns.dataset.active = button.dataset.sectionMode;
    adminApp.querySelectorAll("[data-section-mode]").forEach((other) => {
      other.classList.toggle("is-active", other === button);
      other.setAttribute("aria-pressed", String(other === button));
    });
  }));
}

const BASIC_STEPS = [
  { id: "couple-settings", title: "기본 정보", required: { "couple.groom.name": "신랑 이름", "couple.bride.name": "신부 이름", "wedding.venue": "식장 이름", "wedding.date": "예식 일시" } },
  { id: "main-media-settings", title: "첫 화면 사진", required: { "hero.image": "메인 사진" } },
  { id: "people-detail-settings", title: "두 사람 소개", required: {} },
  { id: "wedding-detail-settings", title: "예식 장소", required: { "wedding.address": "주소" } },
  { id: "account-settings", title: "계좌 안내", required: {} },
  { id: "public-period-settings", title: "공개 기간", required: {} },
];

function bindBasicAccordion() {
  const host = adminApp.querySelector(".admin-editor-view.view-basic");
  const form = adminApp.querySelector("#invitation-editor");
  if (!host || !form) return;
  // 같은 이름 칸이 둘(입력칸+숨은 칸)인 경우가 있어 하나라도 값이 있으면 채운 것으로 봄
  const valueOf = (name) => {
    const field = form.elements[name];
    const nodes = field instanceof RadioNodeList ? [...field] : [field];
    return nodes.map((node) => node?.value?.trim?.() || "").find(Boolean) || "";
  };
  const quick = (key) => form.querySelector(`[data-quick="${key}"]`)?.value.trim() || "";
  const shortDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };
  const summaries = {
    "couple-settings": () => [
      [quick("couple.groom.name") || valueOf("couple.groom.name"), quick("couple.bride.name") || valueOf("couple.bride.name")].filter(Boolean).join(" · "),
      shortDate(quick("wedding.date") || valueOf("wedding.date")),
      quick("wedding.venue") || valueOf("wedding.venue"),
    ].filter(Boolean).join(" · "),
    "main-media-settings": () => (valueOf("hero.image") ? "메인 사진 등록됨" : "메인 사진이 아직 없어요"),
    "people-detail-settings": () => {
      const phones = ["couple.groom.phone", "couple.bride.phone"].filter(valueOf).length;
      const photos = ["couple.groom.photo", "couple.bride.photo"].filter(valueOf).length;
      return `연락처 ${phones}/2 · 사진 ${photos}/2`;
    },
    "wedding-detail-settings": () => valueOf("wedding.address") || "주소가 아직 없어요",
    "account-settings": () => {
      const count = [...form.querySelectorAll('input[name$=".number"]')].filter((input) => input.name.startsWith("account.") && input.value.trim()).length;
      return count ? `계좌 ${count}개` : "계좌를 아직 넣지 않았어요";
    },
    "public-period-settings": () => {
      const open = valueOf("publicPeriod.openDate");
      const close = valueOf("publicPeriod.closeDate");
      return open || close ? `${open.replaceAll("-", ".")} ~ ${close.replaceAll("-", ".")}` : "기간을 정하지 않았어요";
    },
  };
  // 테두리 없는 행 목록이라 빈 칸도 입력칸인 게 보이도록 흐린 안내 글자
  host.querySelectorAll(":is(.quick-side-card, .quick-input-grid, .account-editor) .field input:not([type=hidden]):not([type=date]):not([type=datetime-local]):not([placeholder])").forEach((input) => {
    input.placeholder = /.number$/.test(input.name) ? "숫자만 입력" : "입력";
  });
  const steps = BASIC_STEPS.map((info) => ({ ...info, el: document.getElementById(info.id) })).filter((step) => step.el);
  const headerOf = (el) => el.querySelector(":scope > legend, :scope > summary, :scope > .guided-group-title");
  steps.forEach((step, index) => {
    const header = headerOf(step.el);
    if (!header || header.dataset.accordionReady) return;
    header.dataset.accordionReady = "1";
    header.classList.add("step-header");
    header.insertAdjacentHTML("beforeend", '<span class="step-status" data-step-status></span>');
    header.insertAdjacentHTML("afterend", '<button type="button" class="step-summary" data-step-summary></button>');
    const next = steps[index + 1];
    step.el.insertAdjacentHTML("beforeend", next
      ? `<button type="button" class="step-next" data-step-next="${next.id}">다음: ${next.title} <span aria-hidden="true">→</span></button>`
      : '<button type="submit" form="invitation-editor" class="step-next step-save">저장하기</button>');
  });
  // 위쪽 진행 상황: 단계별 막대 + 남은 필수 칸 안내(칩 메뉴 대신)
  if (!host.querySelector("[data-basic-progress]")) {
    const anchor = host.querySelector(".guided-progress") || form;
    anchor.insertAdjacentHTML("beforebegin", `<div class="basic-progress" data-basic-progress>
      <p class="basic-progress-text" data-basic-progress-text></p>
      <div class="basic-progress-bar">${steps.map((step) => `<i data-progress-step="${step.id}" title="${step.title}"></i>`).join("")}</div>
    </div>`);
  }
  const missingOf = (step) => Object.entries(step.required).filter(([name]) => !(valueOf(name) || quick(name))).map(([, label]) => label);
  const refresh = () => {
    steps.forEach((step) => {
      const missing = missingOf(step);
      const status = step.el.querySelector("[data-step-status]");
      const summary = step.el.querySelector("[data-step-summary]");
      const optional = !Object.keys(step.required).length;
      if (status) {
        status.textContent = missing.length ? `필수 ${missing.length}개 남음` : optional ? "선택" : "완료";
        status.className = `step-status ${missing.length ? "is-missing" : optional ? "is-optional" : "is-done"}`;
      }
      if (summary) summary.textContent = summaries[step.id]?.() || "";
      const chip = host.querySelector(`.guided-progress [data-editor-jump="${step.id}"]`);
      chip?.classList.toggle("is-done", !missing.length && !optional);
      chip?.classList.toggle("is-missing", missing.length > 0);
      const bar = host.querySelector(`[data-progress-step="${step.id}"]`);
      if (bar) bar.className = missing.length ? "is-missing" : optional ? "is-optional" : "is-done";
    });
    const allMissing = steps.flatMap(missingOf);
    const text = host.querySelector("[data-basic-progress-text]");
    if (text) text.innerHTML = allMissing.length
      ? `남은 필수 칸 <strong>${allMissing.length}개</strong> · ${escapeAdminHtml(allMissing.join(", "))} <span>(채워야 저장할 수 있어요)</span>`
      : "<strong>필수 정보를 모두 채웠어요.</strong> 나머지는 필요한 것만 채우면 돼요.";
  };
  const expand = (id, { scroll = true } = {}) => {
    steps.forEach((step) => step.el.classList.toggle("is-collapsed", step.id !== id));
    const target = steps.find((step) => step.id === id)?.el;
    if (scroll && target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  host.addEventListener("click", (event) => {
    const header = event.target.closest(".step-header, [data-step-summary]");
    const nextButton = event.target.closest("[data-step-next]");
    if (nextButton) { expand(nextButton.dataset.stepNext); return; }
    if (!header) return;
    // 기본 동작(details 열고 닫기)은 막고 우리가 펼침을 관리
    event.preventDefault();
    const step = header.closest(".guided-step");
    if (!step) return;
    if (step.classList.contains("is-collapsed")) expand(step.id);
    else step.classList.add("is-collapsed");
  });
  // 위쪽 단계 바로가기: 그 단계를 펼치고 이동
  host.querySelector(".guided-progress")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-editor-jump]");
    if (!chip) return;
    event.stopImmediatePropagation();
    expand(chip.dataset.editorJump);
  }, true);
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  refresh();
  setTimeout(refresh, 450);
  // 처음엔 아직 덜 채운 첫 단계만 펼침. 다 채운 사람은 모두 접힌 요약 목록으로 시작
  const firstMissing = steps.find((step) => missingOf(step).length);
  if (firstMissing) expand(firstMissing.id, { scroll: false });
  else steps.forEach((step) => step.el.classList.add("is-collapsed"));
}

// 기본 탭: 스크롤 중인 단계를 위쪽 바로가기에 표시
function bindGuidedStepHighlight() {
  const nav = adminApp.querySelector(".view-basic .guided-progress");
  if (!nav) return;
  const buttons = [...nav.querySelectorAll("[data-editor-jump]")];
  let frame = 0;
  let lastId = "";
  // 화면 위쪽(바로가기 바로 아래)을 지난 마지막 단계를 지금 단계로 봄
  const update = () => {
    frame = 0;
    if (!nav.isConnected) { window.removeEventListener("scroll", onScroll); return; }
    const line = Math.max(nav.getBoundingClientRect().bottom + 90, window.innerHeight * 0.3);
    let current = buttons[0];
    buttons.forEach((button) => {
      const target = document.getElementById(button.dataset.editorJump);
      if (target && target.offsetParent !== null && target.getBoundingClientRect().top <= line) current = button;
    });
    if (current.dataset.editorJump === lastId) return;
    lastId = current.dataset.editorJump;
    buttons.forEach((button) => button.classList.toggle("is-current", button === current));
    nav.scrollTo({ left: current.offsetLeft - nav.clientWidth / 2 + current.offsetWidth / 2, behavior: "smooth" });
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
}

function setNested(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((object, key) => {
    if (!object[key] || typeof object[key] !== "object") object[key] = {};
    return object[key];
  }, target);
  parent[last] = value;
}

function getNested(target, path, fallback = "") {
  return path.split(".").reduce((current, key) => current?.[key], target) ?? fallback;
}

function editorData(form) {
  const next = JSON.parse(JSON.stringify(invitationData));
  const fields = new FormData(form);
  for (const [name, value] of fields.entries()) {
    if (name === "appearance.preset" || name === "editorPresetId" || name.startsWith("notice.") || name.startsWith("noticePreset.") || name.startsWith("account.") || name.startsWith("transport.")) {
      continue;
    }
    if (name === "guestPhotos.previewVisible" || name === "music.enabled" || name.startsWith("displaySettings.")) {
      setNested(next, name, value === "true");
    } else if (name === "music.volume") {
      setNested(next, name, Math.max(0, Math.min(1, Number(value) || 0)));
    } else if (name === "wedding.date") {
      setNested(next, name, weddingDateIso(value));
    } else if (name === "couple.groom.birthday" || name === "couple.bride.birthday") {
      setNested(next, name, birthdayDisplayValue(value));
    } else if (name.startsWith("sectionSettings.")) {
      setNested(next, name, parseSectionOrder(value));
    } else if (name === "couple.groom.tags" || name === "couple.bride.tags") {
      continue;
    } else if (name === "invitation.paragraphs") {
      setNested(next, name, value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean));
    } else if (name === "rsvp.transportOptions") {
      const options = value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      setNested(next, name, options.includes("직접입력") ? options : [...options, "직접입력"]);
    } else if (name === "notices") {
      next.notices = parseList(value, ["title", "text"]);
    } else {
      setNested(next, name, value.trim());
    }
  }
  // 안내사항/교통안내 편집기는 "편집 기능"(복사 에디터)의 툴독에만 존재합니다.
  // 기본 에디터에서 저장할 때는 이 편집기들이 DOM에 없으므로, 무조건 덮어쓰면
  // 저장돼 있던 notices/transport가 빈 배열로 지워집니다. 편집기가 실제로
  // 렌더된 경우(=해당 매니저가 폼 안에 있을 때)에만 다시 수집합니다.
  if (form.querySelector("[data-notice-manager]")) {
    next.notices = [...form.querySelectorAll("[data-notice-editor]")].map((editor) => ({
      title: editor.querySelector('input[name*=".title"]').value.trim(),
      text: editor.querySelector('textarea[name*=".text"]').value.trim(),
      hidden: editor.querySelector('input[name*=".hidden"]').checked,
    })).filter((notice) => notice.title || notice.text);
  }
  if (form.querySelector("[data-transport-manager]")) {
    next.transport = [...form.querySelectorAll("[data-transport-editor]")].map((editor) => ({
      title: editor.querySelector('[name*=".title"]').value.trim(),
      lines: [...editor.querySelectorAll("[data-transport-line]")].map((line) => ({
        icon: line.querySelector('input').value.trim(),
        text: line.querySelector('textarea').value.trim(),
      })).filter((line) => line.icon || line.text),
      hidden: editor.querySelector('input[name*=".hidden"]').checked,
    })).filter((item) => item.title || item.lines.length);
  }
  next.couple.groom.tags = fields.getAll("couple.groom.tags").map((item) => item.trim().replace(/^#+/, "")).filter(Boolean).slice(0, 3);
  next.couple.bride.tags = fields.getAll("couple.bride.tags").map((item) => item.trim().replace(/^#+/, "")).filter(Boolean).slice(0, 3);
  const quickValue = (key) => form.querySelector(`[data-quick="${key}"]`)?.value?.trim?.() || "";
  next.couple.groom.parents = joinParentNames(quickValue("groomFather"), quickValue("groomMother"));
  next.couple.bride.parents = joinParentNames(quickValue("brideFather"), quickValue("brideMother"));
  next.accounts = ensureAccountRows([...form.querySelectorAll("[data-account-editor]")].map((editor) => {
    const relationSelect = editor.querySelector('select[name*=".relation"]')?.value || "";
    const relationCustom = editor.querySelector('input[name*=".relationCustom"]')?.value.trim() || "";
    const bankSelect = editor.querySelector('select[name*=".bankSelect"]')?.value || "";
    const bankCustom = editor.querySelector('input[name*=".bank"]')?.value.trim() || "";
    return {
      side: editor.querySelector('input[name*=".side"]')?.value.trim() || "신랑측",
      personName: editor.querySelector('input[name*=".personName"]')?.value.trim() || "",
      name: editor.querySelector('input[name*=".name"]')?.value.trim() || "",
      bank: bankSelect === "직접 입력" ? bankCustom : bankSelect,
      number: editor.querySelector('input[name*=".number"]')?.value.trim() || "",
      relation: relationSelect === "직접입력" ? relationCustom : relationSelect,
    };
  }).filter((account) => account.name || account.bank || account.number || account.relation), next, { appendMissing: false });
  const selectedPreset = next.designSystem?.themes?.find((theme) => theme.id === fields.get("editorPresetId"));
  if (selectedPreset) {
    next.appearance.theme = selectedPreset.type === "color" ? selectedPreset.id : (next.appearance.theme || "sky");
    next.appearance.movieConcept = selectedPreset.type === "movie" ? selectedPreset.id : "none";
    next.appearance.design = next.appearance.design || {};
    next.appearance.design.presetId = selectedPreset.id;
  }
  next.appearance.design = next.appearance.design || {};
  if (form.elements["appearance.design.heroEyebrowEnabled"]) {
    next.appearance.design.heroEyebrowEnabled = fields.get("appearance.design.heroEyebrowEnabled") === "on";
    next.appearance.design.heroNamesEnabled = fields.get("appearance.design.heroNamesEnabled") === "on";
    next.appearance.design.heroDateEnabled = fields.get("appearance.design.heroDateEnabled") === "on";
    next.appearance.design.heroTextXPercent = Number(fields.get("appearance.design.heroTextXPercent") || next.appearance.design.heroTextXPercent || 50);
    next.appearance.design.heroTextYPercent = Number(fields.get("appearance.design.heroTextYPercent") || next.appearance.design.heroTextYPercent || 76);
    if (form.elements["appearance.design.heroTextPositioned"]) next.appearance.design.heroTextPositioned = fields.get("appearance.design.heroTextPositioned") === "true";
    ["heroTextScale", "heroEyebrowScale", "heroNamesScale", "heroDateScale"].forEach((key) => {
      if (form.elements[`appearance.design.${key}`]) next.appearance.design[key] = heroScaleValue(fields.get(`appearance.design.${key}`));
    });
    ["heroGapTop", "heroGapBottom"].forEach((key) => {
      if (form.elements[`appearance.design.${key}`]) next.appearance.design[key] = heroGapValue(fields.get(`appearance.design.${key}`));
    });
    if (form.elements["appearance.design.heroToYPercent"]) {
      next.appearance.design.heroToEnabled = fields.get("appearance.design.heroToEnabled") === "on";
      next.appearance.design.heroToXPercent = Number(fields.get("appearance.design.heroToXPercent") || 50);
      next.appearance.design.heroToYPercent = Number(fields.get("appearance.design.heroToYPercent") || 12);
      next.appearance.design.heroToScale = heroScaleValue(fields.get("appearance.design.heroToScale"));
      next.appearance.design.heroToColor = fields.get("appearance.design.heroToColor") || "#ffffff";
      next.appearance.design.heroToAlign = fields.get("appearance.design.heroToAlign") || "center";
    }
    if (fields.get("appearance.design.heroDecoration")) next.appearance.design.heroDecoration = fields.get("appearance.design.heroDecoration");
    if (fields.get("appearance.design.heroDecorationTint")) next.appearance.design.heroDecorationTint = fields.get("appearance.design.heroDecorationTint");
    next.appearance.design.heroDecorationSize = Number(fields.get("appearance.design.heroDecorationSize") || next.appearance.design.heroDecorationSize || 100);
    next.appearance.design.heroDecorationStrokeWidth = Number(fields.get("appearance.design.heroDecorationStrokeWidth") || next.appearance.design.heroDecorationStrokeWidth || 3);
    next.appearance.design.heroDecorationYPercent = Number(fields.get("appearance.design.heroDecorationYPercent") || next.appearance.design.heroDecorationYPercent || 0);
  }
  if (form.elements["hero.imageFrame.x"]) {
    const frameNumber = (key, fallback) => {
      const number = Number(fields.get(`hero.imageFrame.${key}`));
      return Number.isFinite(number) ? number : fallback;
    };
    next.hero.imageFrame = {
      enabled: fields.get("hero.imageFrame.enabled") === "true",
      x: frameNumber("x", 50),
      y: frameNumber("y", 50),
      zoom: frameNumber("zoom", 100),
      ratio: frameNumber("ratio", 0),
    };
  }
  if (form.elements["media.interludeFrame.x"]) {
    const frameNumber = (key, fallback) => {
      const number = Number(fields.get(`media.interludeFrame.${key}`));
      return Number.isFinite(number) ? number : fallback;
    };
    next.media = next.media || {};
    next.media.interludeFrame = {
      enabled: fields.get("media.interludeFrame.enabled") === "true",
      x: frameNumber("x", 50),
      y: frameNumber("y", 70),
      zoom: frameNumber("zoom", 100),
      ratio: frameNumber("ratio", 0),
    };
  }
  // 메인 문구는 '메인 문구' 시트(크기 탭)로 통합 — 예전 줄별 글자 크기/위치 값은 정리
  if (next.textStyles) ["hero.eyebrow", "coupleNames", "wedding.displayDateCustom"].forEach((key) => delete next.textStyles[key]);
  const displayFormat = form.elements["wedding.displayDateFormat"]?.value || "long_ko";
  const displayCustom = form.elements["wedding.displayDateCustom"]?.value.trim() || "";
  next.wedding.displayDate = displayCustom || weddingDisplayDate(form.elements["wedding.date"]?.value, displayFormat);
  next.wedding.mapLinks = mapLinksFor(next.wedding.venue, next.wedding.address);
  return next;
}

function bindEditor() {
  const form = document.querySelector("#invitation-editor");
  const copyEditor = form.querySelector("[data-copy-editor-panel]");
  const bindGuidedBasicFlow = () => {
    const host = document.querySelector(".admin-editor-view.view-basic");
    if (!host) return;
    const steps = [...form.querySelectorAll("[data-guided-step]")];
    const progressNav = host.querySelector(".admin-quick-actions.guided-progress");
    const progressPlaceholder = document.createElement("div");
    progressPlaceholder.className = "guided-progress-placeholder";
    const saveButtons = [...document.querySelectorAll('#editor-save, .admin-floating-save[form="invitation-editor"]')];
    const requiredByStep = {
      core: ["couple.groom.name", "couple.bride.name", "wedding.venue", "wedding.date"],
      media: ["hero.image"],
      people: [],
      wedding: ["wedding.address"],
      accounts: [],
      guestPhotos: [],
      sections: [],
    };
    const savedValueFieldsByStep = {
      media: ["hero.image"],
      people: ["couple.groom.phone", "couple.bride.phone", "couple.groom.photo", "couple.bride.photo"],
      wedding: ["wedding.address"],
      accounts: ["account.0.number", "account.1.number", "account.2.number", "account.3.number", "account.4.number", "account.5.number"],
      guestPhotos: ["publicPeriod.openDate", "publicPeriod.closeDate"],
      sections: ["sectionSettings.preWedding", "sectionSettings.weddingDay"],
    };
    // 같은 이름 칸이 둘(입력칸+숨은 칸)이면 RadioNodeList.value 가 비어 보이므로 하나씩 확인
    const hasValue = (name) => {
      const field = form.elements[name];
      const nodes = field instanceof RadioNodeList ? [...field] : [field];
      return nodes.some((node) => Boolean(node?.value?.trim?.()));
    };
    const complete = (step) => (requiredByStep[step] || []).every(hasValue);
    const hasAnySavedValue = (step) => (savedValueFieldsByStep[step] || []).some(hasValue);
    const update = () => {
      host.classList.add("is-guided-ready");
      const opened = new Set(["core"]);
      const stepOrder = ["media", "people", "wedding", "accounts", "guestPhotos", "sections"];
      stepOrder.forEach((stepName) => {
        const step = steps.find((item) => item.dataset.guidedStep === stepName);
        if (!step) return;
        const requires = step.dataset.stepRequires;
        const canOpen = hasAnySavedValue(stepName) || !requires || complete(requires);
        if (canOpen) opened.add(stepName);
      });
      steps.forEach((step) => {
        const visible = opened.has(step.dataset.guidedStep);
        step.classList.toggle("is-visible", visible);
        step.classList.toggle("is-complete", complete(step.dataset.guidedStep));
      });
      const canSave = complete("core") && complete("wedding");
      saveButtons.forEach((button) => { button.disabled = !canSave; });
      const saveHint = document.querySelector("[data-guided-save-hint]");
      if (saveHint) saveHint.hidden = canSave;
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
    // 주소처럼 늦게 채워지는 칸이 있어 한 번 더 확인
    setTimeout(update, 400);
    if (progressNav && !progressNav.previousElementSibling?.classList.contains("guided-progress-placeholder")) {
      progressNav.before(progressPlaceholder);
    }
    const syncProgressPin = () => {
      if (!progressNav) return;
      const topLimit = 72 + (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat")) || 0);
      const anchor = progressNav.previousElementSibling?.classList.contains("guided-progress-placeholder")
        ? progressNav.previousElementSibling
        : progressNav;
      const shouldPin = anchor.getBoundingClientRect().top <= topLimit;
      host.classList.toggle("is-guided-progress-pinned", shouldPin);
      anchor.style.height = shouldPin ? `${progressNav.offsetHeight + 18}px` : "0px";
    };
    if (window.__weddingBasicProgressPin) {
      window.removeEventListener("scroll", window.__weddingBasicProgressPin);
      window.removeEventListener("resize", window.__weddingBasicProgressPin);
    }
    window.__weddingBasicProgressPin = syncProgressPin;
    window.addEventListener("scroll", syncProgressPin, { passive: true });
    window.addEventListener("resize", syncProgressPin);
    syncProgressPin();
  };
  bindGuidedBasicFlow();
  const updateIntroDesignPreview = () => {
    const preview = copyEditor.querySelector("[data-intro-design-preview]");
    if (!preview) return;
    const value = (name, fallback) => form.elements[`hero.introDesign.${name}`]?.value || fallback;
    preview.style.setProperty("--intro-align", form.elements["hero.introDesign.align"]?.value || "center");
    preview.style.setProperty("--intro-eyebrow-size", `${value("eyebrowSize", 11)}px`);
    preview.style.setProperty("--intro-name-size", `${value("nameSize", 30)}px`);
    preview.style.setProperty("--intro-date-size", `${value("dateSize", 11)}px`);
    preview.style.setProperty("--intro-eyebrow-name-gap", `${value("eyebrowNameGap", 10)}px`);
    preview.style.setProperty("--intro-name-date-gap", `${value("nameDateGap", 10)}px`);
    preview.style.setProperty("--intro-offset-y", `${value("offsetY", 0)}px`);
    const koFont = window.ENVELOPE_INTRO?.koFont(form.elements["hero.introDesign.koFont"]?.value);
    if (koFont) preview.style.setProperty("--intro-ko-font", koFont);
    else preview.style.removeProperty("--intro-ko-font");
    preview.querySelector("[data-intro-preview-eyebrow]").textContent = form.elements["hero.introEyebrow"].value || invitationData.hero.eyebrow || "our wedding day";
    preview.querySelector("[data-intro-preview-name]").textContent = form.elements["hero.introName"].value || `${form.elements["couple.groom.name"].value} · ${form.elements["couple.bride.name"].value}`;
    preview.querySelector("[data-intro-preview-date]").textContent = form.elements["hero.introDate"].value || form.elements["wedding.displayDateCustom"].value;
  };
  // 봉투 미리보기: 청첩장과 같은 봉투(shared-utils.js ENVELOPE_INTRO)를 미리보기 틀 너비(cqw) 기준으로 다시 그림
  const introDesignValues = () => Object.fromEntries([...copyEditor.querySelectorAll('[name^="hero.introDesign."]')].map((field) => [field.name.slice("hero.introDesign.".length), field.value]));
  const updateEnvelopePreview = () => {
    const canvas = copyEditor.querySelector("[data-envelope-preview]");
    if (!canvas || !window.ENVELOPE_INTRO) return;
    const name = form.elements["hero.introName"].value || `${form.elements["couple.groom.name"].value} · ${form.elements["couple.bride.name"].value}`;
    const date = form.elements["hero.introDate"].value || form.elements["wedding.displayDateCustom"]?.value || invitationData.wedding.displayDate;
    const envelope = window.ENVELOPE_INTRO.render({ script: form.elements["hero.introScript"]?.value, name, date, design: introDesignValues(), unit: "cqw" });
    canvas.innerHTML = `<div class="invitation-intro envelope-intro" ${envelope.attrs}>${envelope.stage}</div>`;
  };
  // 고른 스타일의 항목만 보이고, 색은 '직접 선택'일 때만 색상표가 보임
  const updateIntroFields = () => {
    const style = form.elements["hero.introDesign.style"]?.value || "typing";
    copyEditor.querySelectorAll("[data-intro-fields]").forEach((group) => { group.hidden = group.dataset.introFields !== style; });
    copyEditor.querySelectorAll("[data-intro-color-custom]").forEach((group) => {
      group.hidden = form.elements[`hero.introDesign.${group.dataset.introColorCustom}`]?.value !== "custom";
    });
  };
  const updateIntroEditor = () => {
    updateIntroFields();
    updateIntroDesignPreview();
    updateEnvelopePreview();
  };
  copyEditor.querySelectorAll('[name^="hero.intro"]').forEach((field) => {
    field.addEventListener("input", () => {
      if (field.type === "range") field.nextElementSibling.textContent = field.value;
      updateIntroEditor();
    });
    if (field.tagName === "SELECT") field.addEventListener("change", updateIntroEditor);
    // 아이폰 색상표는 고르고 닫을 때만 change를 보내는 경우가 있어 change도 받음
    if (field.type === "color") field.addEventListener("change", updateIntroEditor);
  });
  // 봉투·실링·박 색을 '직접 선택'으로 바꾸면, 예전에 저장된 엉뚱한 색이 아니라 방금까지 보이던 색에서 시작
  copyEditor.querySelectorAll('select[name^="hero.introDesign."][name$="Color"]').forEach((select) => {
    let previous = select.value;
    select.addEventListener("change", () => {
      const key = select.name.slice("hero.introDesign.".length);
      const customField = form.elements[`hero.introDesign.${key.replace(/Color$/, "CustomColor")}`];
      if (select.value === "custom" && previous !== "custom" && customField && window.ENVELOPE_INTRO) {
        const shown = window.ENVELOPE_INTRO.colors({ ...introDesignValues(), [key]: previous });
        const start = key === "sealColor" ? shown.seal : key === "envelopeColor" ? shown.envelope : window.ENVELOPE_INTRO.FOIL_COLORS[previous];
        if (start) customField.value = start;
        updateIntroEditor();
      }
      previous = select.value;
    });
  });
  copyEditor.querySelector("[data-envelope-preview-replay]")?.addEventListener("click", () => {
    const intro = copyEditor.querySelector("[data-envelope-preview] .envelope-intro");
    if (!intro || intro.classList.contains("is-opening")) return;
    intro.classList.add("is-opening");
    setTimeout(updateEnvelopePreview, 2600);
  });
  updateIntroEditor();
  copyEditor.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-intro-choice]");
    if (!chip) return;
    const key = chip.dataset.introChoice;
    const field = form.elements[`hero.introDesign.${key}`];
    if (!field) return;
    field.value = chip.dataset.value;
    copyEditor.querySelectorAll(`[data-intro-choice="${key}"]`).forEach((other) => {
      other.classList.toggle("is-active", other === chip);
      if (other.hasAttribute("aria-checked")) other.setAttribute("aria-checked", String(other === chip));
    });
    const name = copyEditor.querySelector(`[data-intro-choice-name="${key}"]`);
    if (name && chip.classList.contains("intro-swatch")) name.textContent = chip.dataset.label;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const toolPanel = copyEditor.querySelector("[data-editor-tool-panel]");
  if (window.visualViewport) {
    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - window.visualViewport.height);
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    };
    window.visualViewport.addEventListener("resize", updateKeyboardOffset);
    updateKeyboardOffset();
  }
  let activeProfileTarget = "";
  let activeTextTarget = null;
  let frameDocumentRef = null;
  let heroEditSnapshot = null;
  let heroFrameAdjusting = false;
  let refreshEditHandles = () => {};
  let syncFrameScrollHeight = () => {};
  const resetPreviewInteractionState = () => {
    frameDocumentRef?.querySelectorAll("[data-copy-edit-handle]").forEach((item) => item.remove());
    frameDocumentRef?.querySelectorAll(".copy-editable-target").forEach((item) => {
      item.classList.remove("copy-editable-target");
      item.removeAttribute("data-edit-label");
      delete item.dataset.editTargetIndex;
    });
    activeProfileTarget = "";
    activeTextTarget = null;
    if (!toolPanel) return;
    toolPanel.hidden = true;
    toolPanel.classList.remove("is-collapsed");
    toolPanel.classList.remove("is-manager", "is-hero", "is-profile", "is-copy");
    delete toolPanel.dataset.context;
    delete toolPanel.dataset.profileSide;
    updateFloatingSaveForToolDock();
  };
  const frameToggle = copyEditor.querySelector("[data-copy-frame-toggle]");
  const frameToggleState = copyEditor.querySelector("[data-copy-frame-toggle-state]");
  frameToggle?.addEventListener("click", () => {
    const nextEnabled = !copyEditor.classList.contains("is-frame-interaction-enabled");
    copyEditor.classList.toggle("is-frame-interaction-enabled", nextEnabled);
    frameToggle.classList.toggle("is-on", nextEnabled);
    frameToggle.setAttribute("aria-pressed", String(nextEnabled));
    if (frameToggleState) frameToggleState.textContent = nextEnabled ? "ON" : "OFF";
    if (nextEnabled) refreshEditHandles();
    else resetPreviewInteractionState();
  });
  const previewDraft = () => {
    try {
      return editorData(form);
    } catch {
      return JSON.parse(JSON.stringify(invitationData));
    }
  };
  const refreshFrameAppearance = () => {
    const frameWindow = copyEditor.querySelector("[data-copy-editor-frame]")?.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument?.body) return;
    const draft = previewDraft();
    frameWindow.WEDDING_DESIGN?.normalize(draft);
    frameWindow.WEDDING_DESIGN?.apply(draft, frameDocument.body);
    const position = draft.hero?.contentPosition || "bottom";
    const heroContent = frameDocument.querySelector(".hero-content");
    if (heroContent) {
      heroContent.classList.remove("hero-content-top", "hero-content-middle", "hero-content-bottom");
      heroContent.classList.add(`hero-content-${position}`);
    }
    renderHeroFrameMedia();
  };
  const refreshFrameLists = () => {
    // 직접 만든 미리보기 마크업은 실제 화면(아이콘·탭)과 달라져서, 실제 렌더링으로 다시 그림
    schedulePreviewRender();
  };
  const refreshFrameGallery = () => {
    if (!frameDocumentRef) return;
    const images = Array.from({ length: GALLERY_MAX }, (_, index) => form.elements[`gallery.${index}`]?.value ?? invitationData.gallery?.[index] ?? "");
    const thumbs = Array.from({ length: GALLERY_MAX }, (_, index) => form.elements[`galleryThumb.${index}`]?.value ?? invitationData.galleryThumbs?.[index] ?? "");
    const photos = images.map((image, index) => ({ image, thumb: thumbs[index] || image })).filter((photo) => photo.image);
    const galleryGrid = frameDocumentRef.querySelector(".gallery-grid");
    if (!galleryGrid) return;
    galleryGrid.innerHTML = photos.slice(0, 6).map((photo, index) => `
      <button class="gallery-item" data-gallery="${index}" aria-label="사진 ${index + 1} 크게 보기">
        <span class="media" style="background-image:url('${escapeAdminHtml(adminMediaUrl(photo.thumb))}')"></span>
      </button>`).join("");
    frameDocumentRef.querySelector("#gallery")?.classList.add("copy-editable-target");
    frameDocumentRef.querySelector("#gallery")?.setAttribute("data-edit-label", "갤러리 사진");
    refreshEditHandles();
    renderGallerySheet();
  };
  const sectionIdMap = sectionRegistry.titleKeys;
  const inlineTarget = (target) => {
    const section = target.closest(".section");
    const key = sectionIdMap[section?.id];
    if (target.matches(".hero-eyebrow")) return { name: "hero.eyebrow" };
    if (target.matches(".hero-names")) return { name: "coupleNames", names: true };
    if (target.matches(".hero-date")) return { name: "wedding.displayDateCustom" };
    if (target.matches(".section-label") && key) return { name: `sectionTitles.${key}.en` };
    if (target.matches(".section-title") && key) return { name: `sectionTitles.${key}.ko` };
    if (target.matches(".location-venue")) return { name: "wedding.venue" };
    if (target.matches(".location-hall")) return { name: "wedding.hall" };
    if (target.matches(".location-address")) return { name: "wedding.address" };
    if (target.matches("#attendance .subtle")) return { name: "sectionDescriptions.attendance", multiline: true };
    if (target.matches("#account .subtle")) return { name: "sectionDescriptions.account", multiline: true };
    if (target.matches("#guestbook .subtle")) return { name: "sectionDescriptions.guestbook", multiline: true };
    if (target.matches(".ending-content .preserve")) return { name: "ending.text", multiline: true };
    if (target.matches(".invitation-copy-group")) return { name: "invitation.paragraphs", multiline: true, wholeParagraphs: true };
    return null;
  };
  const refreshSelectedTextStyle = () => {
    if (!activeTextTarget) return;
    const sizeField = copyEditor.querySelector("[data-preview-text-size]");
    const offsetField = copyEditor.querySelector("[data-preview-text-y]");
    const offsetXField = copyEditor.querySelector("[data-preview-text-x]");
    const size = sizeField?.value;
    const offset = offsetField?.value || "0";
    const offsetX = offsetXField?.value || "0";
    const originalSize = activeTextTarget.dataset.originalTextSize;
    const originalOffset = activeTextTarget.dataset.originalTextOffsetY || "0";
    const originalOffsetX = activeTextTarget.dataset.originalTextOffsetX || "0";
    const isDefault = String(size) === String(originalSize) && String(offset) === String(originalOffset) && String(offsetX) === String(originalOffsetX);
    const targets = [activeTextTarget].filter((target) => target?.isConnected);
    targets.forEach((target) => {
      if (isDefault) {
        target.style.removeProperty("font-size");
        target.style.removeProperty("transform");
        target.style.removeProperty("position");
        target.style.removeProperty("z-index");
        return;
      }
      if (size) target.style.setProperty("font-size", `${size}px`, "important");
      if (Number(offset) || Number(offsetX)) {
        target.style.setProperty("transform", `translate(${offsetX}px, ${offset}px)`, "important");
        target.style.setProperty("position", "relative", "important");
        target.style.setProperty("z-index", "18", "important");
      } else {
        target.style.removeProperty("transform");
        target.style.removeProperty("position");
        target.style.removeProperty("z-index");
      }
    });
    activeTextTarget.dataset.textSize = size || "";
    activeTextTarget.dataset.textOffsetY = offset;
    activeTextTarget.dataset.textOffsetX = offsetX;
    const name = inlineTarget(activeTextTarget)?.name;
    if (name) {
      invitationData.textStyles ||= {};
      if (isDefault) {
        delete invitationData.textStyles[name];
      } else {
        invitationData.textStyles[name] = { fontSize: Number(size) || undefined, offsetY: Number(offset) || 0, offsetX: Number(offsetX) || 0 };
      }
    }
    copyEditor.querySelector("[data-preview-text-size-output]")?.replaceChildren(String(size || activeTextTarget.dataset.originalTextSize || 16));
    copyEditor.querySelector("[data-preview-text-y-output]")?.replaceChildren(String(offset || 0));
    copyEditor.querySelector("[data-preview-text-x-output]")?.replaceChildren(String(offsetX || 0));
  };
  const resetSelectedTextStyle = () => {
    if (!activeTextTarget) return;
    const size = activeTextTarget.dataset.originalTextSize || "16";
    const offset = activeTextTarget.dataset.originalTextOffsetY || "0";
    const offsetX = activeTextTarget.dataset.originalTextOffsetX || "0";
    const sizeField = copyEditor.querySelector("[data-preview-text-size]");
    const yField = copyEditor.querySelector("[data-preview-text-y]");
    const xField = copyEditor.querySelector("[data-preview-text-x]");
    if (sizeField) sizeField.value = size;
    if (yField) yField.value = offset;
    if (xField) xField.value = offsetX;
    refreshSelectedTextStyle();
  };
  // 메인 영상은 쓰지 않음(egress 절감) — 첫 화면은 항상 이미지
  const updateHeroMediaControls = () => {
    const image = form.elements["hero.image"]?.value?.trim() || "";
    const imageThumb = copyEditor.querySelector("[data-hero-image-thumb]");
    if (imageThumb) imageThumb.style.backgroundImage = image ? `url("${adminMediaUrl(image).replace(/"/g, "%22")}")` : "";
    copyEditor.querySelector('[data-tool-action="hero-image"]')?.classList.toggle("has-media", Boolean(image));
    copyEditor.querySelector('[data-tool-action="hero-image"] strong')?.replaceChildren(image ? "이미지 등록됨" : "이미지 업로드");
    copyEditor.querySelector('[data-hero-media-actions="image"]')?.toggleAttribute("hidden", true);
  };
  const renderHeroFrameMedia = () => {
    if (!frameDocumentRef) return;
    const heroMedia = frameDocumentRef.querySelector(".hero-media");
    if (!heroMedia) return;
    const image = form.elements["hero.image"]?.value?.trim() || "";
    heroMedia.style.backgroundImage = image ? `url("${adminMediaUrl(image).replace(/"/g, "%22")}")` : "";
    heroMedia.dataset.activeMedia = "image";
    heroMedia.innerHTML = "";
    applyHeroFramePreview();
    refreshEditHandles();
  };
  const refreshFrameMedia = (target, url, type = "image") => {
    if (!frameDocumentRef) return;
    const mediaStyleText = url ? `url("${adminMediaUrl(url).replace(/"/g, "%22")}")` : "";
    if (target === "hero.image") {
      // 새 사진이면 보이는 영역 설정은 처음부터
      setFormValue("hero.imageFrame.enabled", "false");
      setFormValue("hero.imageFrame.x", "50");
      setFormValue("hero.imageFrame.y", "50");
      setFormValue("hero.imageFrame.zoom", "100");
      setFormValue("hero.imageFrame.ratio", "0");
      syncHeroControlsUi();
    }
    if (target === "hero.image") {
      updateHeroMediaControls();
      renderHeroFrameMedia();
    }
    if (target === "media.interludePhoto") {
      setFormValue("media.interludeFrame.enabled", "false");
      setFormValue("media.interludeFrame.x", "50");
      setFormValue("media.interludeFrame.y", "70");
      setFormValue("media.interludeFrame.zoom", "100");
      setFormValue("media.interludeFrame.ratio", "0");
      updateInterludeState();
      schedulePreviewRender();
    }
    if (target === "couple.groom.photo" || target === "couple.bride.photo") {
      const index = target === "couple.groom.photo" ? 0 : 1;
      const profilePhoto = frameDocumentRef.querySelectorAll(".profile-photo")[index];
      if (profilePhoto) profilePhoto.style.backgroundImage = mediaStyleText;
      refreshEditHandles();
    }
  };
  // 뒤로가기로 닫을 때: 완료 버튼이 있으면 완료(고친 값 유지), 없으면 그냥 닫음
  const closeToolDockFromHistory = () => {
    const done = toolPanel?.querySelector("[data-tooldock-actions]:not([hidden]) [data-tooldock-done]");
    if (done) done.click();
    else if (toolPanel) {
      toolPanel.hidden = true;
      updateFloatingSaveForToolDock();
    }
  };
  const updateFloatingSaveForToolDock = () => {
    // 접힌 편집 도구 머리와 저장 버튼이 겹치지 않게 저장 버튼 위치를 바꾸는 표시(styles.css)
    document.body.classList.toggle("has-collapsed-tooldock", Boolean(toolPanel && !toolPanel.hidden && toolPanel.classList.contains("is-collapsed")));
    if (toolPanel && !toolPanel.hidden) openAdminOverlay(closeToolDockFromHistory);
    else closeAdminOverlay(closeToolDockFromHistory);
  };
  const setToolDock = (title, help, activeTab = "media", context = "text") => {
    if (!toolPanel) return;
    toolPanel.hidden = false;
    toolPanel.classList.remove("is-collapsed");
    toolPanel.classList.toggle("is-manager", context === "information" || context === "location" || context === "wedding-snap-detail" || context === "rsvp-detail" || (context === "hero" && activeTab === "frame"));
    toolPanel.classList.toggle("is-hero", context === "hero");
    toolPanel.classList.toggle("is-profile", context === "profile");
    toolPanel.classList.toggle("is-copy", context === "hero-copy" || context === "text-copy");
    toolPanel.dataset.context = context;
    // 취소/완료: 열 때 상태를 저장해 두는 섹션 시트에만 (목록 관리형은 완료만)
    const sheetContexts = ["hero", "hero-copy", "text-copy", "profile", "parents", "interlude", "rsvp-detail", "information", "location", "gallery-sheet", "account", "calendar"];
    if (context !== "account") returnAccountManager();
    toolPanel.querySelector("[data-tooldock-actions]")?.toggleAttribute("hidden", !sheetContexts.includes(context));
    toolPanel.querySelector("[data-tooldock-cancel]")?.toggleAttribute("hidden", context === "information" || context === "location");
    if (!sheetContexts.includes(context)) heroEditSnapshot = null;
    if (heroFrameAdjusting && context !== "hero") stopHeroFrameAdjust();
    if (interludeAdjusting && context !== "interlude") stopInterludeFrameAdjust();
    toolPanel.querySelector("[data-tooldock-title]").textContent = title;
    toolPanel.querySelector("[data-tooldock-help]").textContent = help;
    let visibleTabCount = 0;
    toolPanel.querySelectorAll("[data-tooldock-tab]").forEach((button) => {
      const tab = button.dataset.tooldockTab;
      const visible = context === "hero"
        ? ["media", "frame"].includes(tab)
        : context === "hero-copy"
          ? ["copy", "position", "size", "hero-to", "text"].includes(tab)
        : context === "profile"
          ? ["media", "profile-info"].includes(tab)
        : context === "parents" || context === "interlude" || context === "account" || context === "calendar"
          ? tab === context
        : context === "gallery-sheet"
          ? tab === "gallery"
          : context === "gallery"
            ? tab === "media"
          : context === "information" || context === "location" || context === "wedding-snap-detail" || context === "rsvp-detail"
            ? tab === "items"
            : context === "text-copy"
              ? tab === "style"
              : false;
      button.hidden = !visible;
      if (visible) visibleTabCount += 1;
      button.classList.toggle("is-active", visible && tab === activeTab);
    });
    toolPanel.querySelector(".editor-tooldock-tabs")?.toggleAttribute("hidden", visibleTabCount <= 1);
    frameDocumentRef?.body?.classList.toggle("show-hero-to-sample", context === "hero-copy" && activeTab === "hero-to");
    // 받는 분 탭: 예시 이름이 시트에 가리지 않게 미리보기를 그 자리로 옮김
    if (context === "hero-copy" && activeTab === "hero-to") requestAnimationFrame(revealHeroTo);
    toolPanel.querySelectorAll("[data-tooldock-pane]").forEach((pane) => {
      pane.classList.toggle("is-active", pane.dataset.tooldockPane === activeTab);
    });
    toolPanel.querySelectorAll("[data-tool-context]").forEach((button) => {
      const contextMatches = button.dataset.toolContext === context;
      button.hidden = !contextMatches;
    });
    toolPanel.querySelector("[data-profile-media-tools]")?.toggleAttribute("hidden", context !== "profile");
    toolPanel.querySelector("[data-hero-media-tools]")?.toggleAttribute("hidden", context !== "hero");
    toolPanel.querySelectorAll("[data-tooldock-items]").forEach((item) => {
      item.hidden = item.dataset.tooldockItems !== context;
    });
    if (activeTab === "frame") requestAnimationFrame(() => syncFrameSettings());
    if (context === "information") autoResizeTextareas(noticeList);
    if (context === "location") autoResizeTextareas(transportList);
    updateFloatingSaveForToolDock();
  };
  const triggerFileInput = (selector) => {
    const inputElement = form.querySelector(selector);
    if (!inputElement) return alert("이 항목의 업로드 입력창을 찾지 못했습니다.");
    inputElement.click();
  };
  const triggerButton = (selector) => {
    const button = form.querySelector(selector);
    if (!button) return alert("먼저 사진을 업로드한 뒤 영역 맞추기를 사용할 수 있습니다.");
    button.click();
  };
  const gallerySettingsPanel = form.querySelector("#gallery-settings");
  const closeGalleryModal = () => {
    gallerySettingsPanel?.classList.remove("is-gallery-modal");
    gallerySettingsPanel?.querySelector("[data-gallery-modal-close]")?.setAttribute("hidden", "");
    updateFloatingSaveForToolDock();
  };
  const openGalleryModal = () => {
    if (!gallerySettingsPanel) return;
    gallerySettingsPanel.classList.add("is-gallery-modal");
    gallerySettingsPanel.querySelector("[data-gallery-modal-close]")?.removeAttribute("hidden");
    toolPanel?.classList.add("is-collapsed");
    updateFloatingSaveForToolDock();
  };
  gallerySettingsPanel?.querySelector("[data-gallery-modal-close]")?.addEventListener("click", closeGalleryModal);
  // 테마 고르기(선택칸·전체보기 공통): 레이아웃 대표색이면 테마 값은 그대로 두고 색만 레이아웃 기본으로
  const applyPresetChoice = (value) => {
    const presetHidden = form.elements["appearance.design.presetId"];
    const skinHidden = form.elements["appearance.design.skinColors"];
    if (value === LAYOUT_COLOR_PRESET) {
      if (skinHidden) skinHidden.value = "layout";
    } else {
      if (skinHidden) skinHidden.value = "theme";
      presetHidden.value = value;
    }
    if (form.elements.editorPresetId) form.elements.editorPresetId.value = value;
    copyEditor.querySelectorAll("[data-onboarding-preset]").forEach((item) => item.classList.toggle("is-selected", item.dataset.onboardingPreset === value));
    form.dispatchEvent(new Event("change", { bubbles: true }));
    refreshFrameAppearance();
  };
  const bindDesignControls = () => {
    const preset = form.elements.editorPresetId;
    const presetHidden = form.elements["appearance.design.presetId"];
    const textThemeHidden = form.elements["appearance.design.heroTextTheme"];
    preset?.addEventListener("change", () => {
      applyPresetChoice(preset.value);
    });
    copyEditor.querySelectorAll("[data-design-text-theme]").forEach((button) => button.addEventListener("click", () => {
      textThemeHidden.value = button.dataset.designTextTheme;
      copyEditor.querySelectorAll("[data-design-text-theme]").forEach((item) => item.classList.toggle("is-selected", item === button));
      setToolDock(HERO_COPY_TITLE, HERO_COPY_HELP, "text", "hero-copy");
      refreshFrameAppearance();
    }));
    copyEditor.querySelectorAll('input[name="appearance.design.heroDecoration"]').forEach((field) => {
      field.addEventListener("change", () => {
        copyEditor.querySelectorAll(".hero-decoration-option").forEach((option) => option.classList.toggle("is-selected", option.contains(field) && field.checked));
        refreshFrameAppearance();
        refreshEditHandles();
      });
    });
    copyEditor.querySelectorAll(".editor-tooldock .hero-decoration-option").forEach((option) => {
      option.addEventListener("click", (event) => {
        const field = option.querySelector('input[name="appearance.design.heroDecoration"]');
        if (!field) return;
        event.preventDefault();
        if (field.checked) return;
        field.checked = true;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        setToolDock("메인 사진", "사진 변경·보이는 영역·꾸밈을 바꿔요.", "frame", "hero");
        syncFrameSettings();
      });
    });
    copyEditor.querySelectorAll('.editor-tooldock input[type="range"]').forEach((field) => {
      field.addEventListener("input", () => {
        if (field.hasAttribute("data-preview-text-size") || field.hasAttribute("data-preview-text-y") || field.hasAttribute("data-preview-text-x")) {
          refreshSelectedTextStyle();
        } else {
          field.parentElement?.querySelector("output")?.replaceChildren(document.createTextNode(field.value));
          refreshFrameAppearance();
        }
      });
    });
    copyEditor.querySelectorAll("[data-frame-range-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const [name, amount] = button.dataset.frameRangeStep.split(":");
        const field = name ? form.elements[name] : null;
        if (!field) return;
        const step = Number(amount || field.step || 1);
        const next = Math.max(Number(field.min), Math.min(Number(field.max), Number(field.value || 0) + step));
        field.value = String(Number.isInteger(next) ? next : Number(next.toFixed(2)));
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    copyEditor.querySelectorAll("[data-preview-text-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const [type, amount] = button.dataset.previewTextStep.split(":");
        const field = type === "size" ? copyEditor.querySelector("[data-preview-text-size]") : type === "x" ? copyEditor.querySelector("[data-preview-text-x]") : copyEditor.querySelector("[data-preview-text-y]");
        if (!field) return;
        const next = Math.max(Number(field.min), Math.min(Number(field.max), Number(field.value || 0) + Number(amount || 0)));
        field.value = String(next);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    copyEditor.querySelector("[data-preview-text-reset]")?.addEventListener("click", resetSelectedTextStyle);
    copyEditor.querySelectorAll(".editor-tooldock select, .editor-tooldock input, .editor-tooldock textarea").forEach((field) => {
      if (field.type === "file" || field.type === "range") return;
      field.addEventListener("change", refreshFrameAppearance);
    });
    copyEditor.querySelectorAll("[data-tooldock-tab]").forEach((button) => {
      button.addEventListener("click", () => setToolDock(
        toolPanel.querySelector("[data-tooldock-title]").textContent || "편집 도구",
        toolPanel.querySelector("[data-tooldock-help]").textContent || "수정할 항목을 고르세요.",
        button.dataset.tooldockTab,
        toolPanel.dataset.context || "text"
      ));
    });
    copyEditor.querySelector("[data-tooldock-collapse]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toolPanel.classList.toggle("is-collapsed");
      updateFloatingSaveForToolDock();
    });
    toolPanel?.addEventListener("click", (event) => {
      if (toolPanel.classList.contains("is-collapsed") && event.target.closest(".editor-tooldock-head") && !event.target.closest("button")) {
        toolPanel.classList.remove("is-collapsed");
        updateFloatingSaveForToolDock();
      }
    });
    copyEditor.querySelectorAll("[data-tool-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.toolAction;
        if (action === "hero-image") {
          if (form.elements["hero.image"]?.value) {
            const actions = copyEditor.querySelector('[data-hero-media-actions="image"]');
            actions.hidden = !actions.hidden;
          } else triggerFileInput('[data-image-target="hero.image"]');
        }
        if (action === "hero-image-change") triggerFileInput('[data-image-target="hero.image"]');
        if (action === "hero-image-remove" && confirm("메인 사진을 삭제할까요?")) triggerButton('[data-image-remove="hero.image"]');
        if (action === "profile-photo" && activeProfileTarget) triggerFileInput(`[data-image-target="${activeProfileTarget}"]`);
        if (action === "profile-crop" && activeProfileTarget) {
          toolPanel.classList.add("is-collapsed");
          openProfileCropEditor(activeProfileTarget, null);
        }
        if (action === "profile-remove" && activeProfileTarget && confirm("사진을 삭제할까요?")) triggerButton(`[data-image-remove="${activeProfileTarget}"]`);
      });
    });
  };
  bindDesignControls();
  // ── 메인 문구 · 메인 사진 편집: 한 시트(문구/위치/크기/테마), 미리보기에서 끌어서 이동, 취소/완료 ──
  const HERO_COPY_TITLE = "메인 문구";
  const HERO_COPY_HELP = "글자·위치·크기를 바꿔요. 미리보기 문구를 끌어 옮길 수도 있어요.";
  const heroCopyFieldNames = ["hero.eyebrow", "hero.eyebrowMain", "hero.eyebrowScript", "couple.groom.name", "couple.bride.name", "wedding.displayDateCustom"];
  const heroCopyDefaults = {
    "hero.eyebrow": invitationData.hero?.eyebrow || "",
    "hero.eyebrowMain": invitationData.hero?.eyebrowMain || "Our Wedding",
    "hero.eyebrowScript": invitationData.hero?.eyebrowScript || "Day",
    "couple.groom.name": invitationData.couple?.groom?.name || "",
    "couple.bride.name": invitationData.couple?.bride?.name || "",
    "wedding.displayDateCustom": invitationData.wedding?.displayDateCustom || "",
  };
  function setFormValue(name, value) {
    const fields = [...form.querySelectorAll(`[name="${name}"]`)];
    if (!fields.length) {
      const field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
      fields.push(field);
    }
    fields.forEach((field) => { field.value = value; });
    // 기본 탭의 빠른 입력칸(이름 등)도 같은 값으로
    form.querySelectorAll(`[data-quick="${name}"]`).forEach((field) => { field.value = value; });
  }
  function formValue(name) {
    return form.querySelector(`[name="${name}"]`)?.value ?? "";
  }
  heroCopyFieldNames.forEach((name) => {
    if (!form.querySelector(`[name="${name}"]`)) setFormValue(name, heroCopyDefaults[name]);
  });
  function heroDisplayDate() {
    return formValue("wedding.displayDateCustom").trim() || weddingDisplayDate(formValue("wedding.date"), formValue("wedding.displayDateFormat") || "long_ko");
  }
  // 레이아웃이 영문을 두 줄(큰 영문 + 필기체)로 그리면 영문 입력도 두 칸으로
  function heroEyebrowIsSplit() {
    const system = invitationData.designSystem || {};
    return Boolean((system.layoutTemplates || []).find((item) => item.id === system.activeLayoutId)?.splitEyebrow);
  }
  function syncHeroCopyInputs() {
    const split = heroEyebrowIsSplit();
    copyEditor.querySelector("[data-eyebrow-plain]")?.toggleAttribute("hidden", split);
    copyEditor.querySelector("[data-eyebrow-split]")?.toggleAttribute("hidden", !split);
    copyEditor.querySelectorAll("[data-hero-copy]").forEach((input) => {
      const name = input.dataset.heroCopy;
      input.value = name === "wedding.displayDateCustom" ? heroDisplayDate() : formValue(name);
    });
  }
  function renderHeroCopyInFrame() {
    const content = frameDocumentRef?.querySelector(".hero-content");
    if (!content) return;
    const eyebrow = content.querySelector(".hero-eyebrow");
    if (eyebrow) {
      eyebrow.textContent = formValue("hero.eyebrow");
      eyebrow.dataset.main = formValue("hero.eyebrowMain");
      eyebrow.dataset.script = formValue("hero.eyebrowScript");
    }
    const names = content.querySelector(".hero-names");
    const separator = frameDocumentRef.defaultView?.heroNameSeparatorHtml?.(formValue("appearance.design.heroNameSeparator")) || "<span>·</span>";
    if (names) names.innerHTML = `${escapeAdminHtml(formValue("couple.groom.name"))} ${separator} ${escapeAdminHtml(formValue("couple.bride.name"))}`;
    const date = content.querySelector(".hero-date");
    if (date) date.textContent = heroDisplayDate();
  }
  function syncHeroControlsUi() {
    toolPanel?.querySelectorAll('input[type="range"]').forEach((range) => {
      const output = range.parentElement?.querySelector("output");
      if (output) output.textContent = range.value;
      setRangeFill(range);
    });
    const positioned = formValue("appearance.design.heroTextPositioned") === "true";
    const position = formValue("hero.contentPosition") || "bottom";
    copyEditor.querySelectorAll("[data-hero-position]").forEach((button) => button.classList.toggle("is-active", !positioned && button.dataset.heroPosition === position));
    const separator = formValue("appearance.design.heroNameSeparator") === "heart" ? "heart" : "dot";
    copyEditor.querySelectorAll("[data-hero-name-sep]").forEach((button) => button.classList.toggle("is-active", button.dataset.heroNameSep === separator));
    copyEditor.querySelector("[data-name-sep-preview]")?.replaceChildren(separator === "heart" ? "♥" : "·");
    copyEditor.querySelector("[data-hero-frame-open]")?.toggleAttribute("hidden", !formValue("hero.image"));
  }

  // 시트를 열 때 상태를 저장해 두고, 취소하면 그대로 되돌림
  // 시트를 열 때 폼 전체 값과 글자 크기 설정을 저장해 두고, 취소하면 되돌린 뒤 미리보기를 다시 그림
  function takeHeroSnapshot() {
    heroEditSnapshot = {
      fields: [...form.elements]
        .filter((field) => field.matches?.("input, select, textarea") && field.type !== "file")
        .map((field) => [field, field.type === "checkbox" || field.type === "radio" ? field.checked : field.value]),
      textStyles: JSON.stringify(invitationData.textStyles || {}),
    };
  }
  function restoreHeroSnapshot() {
    if (!heroEditSnapshot) return;
    heroEditSnapshot.fields.forEach(([field, value]) => {
      if (typeof value === "boolean") field.checked = value;
      else field.value = value;
    });
    invitationData.textStyles = JSON.parse(heroEditSnapshot.textStyles);
    heroEditSnapshot = null;
    const textTheme = formValue("appearance.design.heroTextTheme");
    copyEditor.querySelectorAll("[data-design-text-theme]").forEach((item) => item.classList.toggle("is-selected", item.dataset.designTextTheme === textTheme));
    copyEditor.querySelectorAll(".hero-decoration-option").forEach((option) => option.classList.toggle("is-selected", Boolean(option.querySelector("input:checked"))));
    syncParentNames();
    syncHeroCopyInputs();
    syncHeroControlsUi();
    updateHeroMediaControls();
    if (form.elements["gallery.0"]) updateGallery(galleryValues(), galleryThumbValues());
    renderPreviewNow();
  }
  function takeEditSnapshot() {
    takeHeroSnapshot();
  }

  // 미리보기를 실제 청첩장 렌더링(app.js)으로 다시 그림 — 저장될 값 그대로 보이게
  let previewRenderTimer = 0;
  function renderPreviewNow() {
    clearTimeout(previewRenderTimer);
    const frameWindow = copyEditor.querySelector("[data-copy-editor-frame]")?.contentWindow;
    if (!frameWindow?.renderCopyEditorPreview) {
      refreshFrameAppearance();
      return;
    }
    let draft;
    try {
      draft = editorData(form);
    } catch (error) {
      console.warn("[copy preview render]", error);
      return;
    }
    frameWindow.WEDDING_DESIGN?.normalize(draft);
    const scrollY = frameWindow.scrollY;
    frameWindow.renderCopyEditorPreview(draft);
    frameWindow.scrollTo(0, scrollY);
    refreshFrameAppearance();
    markEditingTarget();
  }
  function schedulePreviewRender() {
    clearTimeout(previewRenderTimer);
    previewRenderTimer = setTimeout(renderPreviewNow, 260);
  }

  // 지금 고치는 대상 표시(다시 그려도 찾을 수 있게 선택자+순번으로 기억)
  let editingTarget = null;
  function setEditingTarget(element, selector) {
    clearEditingTarget();
    if (!element || !frameDocumentRef) return;
    const index = selector ? [...frameDocumentRef.querySelectorAll(selector)].indexOf(element) : -1;
    editingTarget = { selector, index };
    element.classList.add("is-editing-target");
  }
  function markEditingTarget() {
    if (!editingTarget?.selector || !frameDocumentRef) return null;
    const element = [...frameDocumentRef.querySelectorAll(editingTarget.selector)][Math.max(0, editingTarget.index)];
    element?.classList.add("is-editing-target");
    return element || null;
  }
  function clearEditingTarget() {
    frameDocumentRef?.querySelectorAll(".is-editing-target").forEach((item) => item.classList.remove("is-editing-target"));
    editingTarget = null;
  }
  function openSectionSheet(title, help, tab, context, element, selector) {
    takeEditSnapshot();
    activeTextTarget = null;
    activeTextConfig = null;
    setToolDock(title, help, tab, context);
    setEditingTarget(element, selector);
    requestAnimationFrame(() => revealInPreview(element));
  }

  // 글자: 그 자리에서 바꾸지 않고 시트의 입력칸에서 고치면 미리보기에 바로 반영
  let activeTextConfig = null;
  const textInput = copyEditor.querySelector("[data-text-copy-input]");
  function textValueFor(target, config) {
    const stored = config.name ? formValue(config.name) : "";
    if (config.wholeParagraphs || (config.multiline && stored)) return stored;
    return [...target.childNodes]
      .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.matches("[data-copy-edit-handle]")))
      .map((node) => (node.nodeName === "BR" ? "\n" : node.textContent))
      .join("")
      .trim();
  }
  function applyTextToTarget(target, config, value) {
    if (!target?.isConnected || !frameDocumentRef) return;
    const handle = target.querySelector(":scope > [data-copy-edit-handle]");
    if (config.wholeParagraphs) {
      target.replaceChildren(...value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean).map((text) => {
        const paragraph = frameDocumentRef.createElement("p");
        paragraph.className = "invitation-copy";
        paragraph.innerHTML = adminEmphasisHtml(text);
        return paragraph;
      }));
    } else {
      target.textContent = value;
    }
    if (handle) target.appendChild(handle);
    frameDocumentRef.defaultView?.fitSingleLineText?.();
    // 한 줄 맞춤이 글자 크기를 지우므로, 직접 정한 크기는 다시 적용
    const savedSize = invitationData.textStyles?.[config.name]?.fontSize;
    if (savedSize) target.style.setProperty("font-size", `${savedSize}px`, "important");
  }
  function currentTextSize() {
    const saved = invitationData.textStyles?.[activeTextConfig?.name];
    if (saved?.fontSize) return Math.round(saved.fontSize);
    // 한 줄 맞춤으로 줄어든 크기가 아니라 디자인 기본 크기를 기준으로
    const element = activeTextTarget;
    const inline = element.style.getPropertyValue("font-size");
    const priority = element.style.getPropertyPriority("font-size");
    element.style.removeProperty("font-size");
    const size = Number.parseFloat(frameDocumentRef?.defaultView?.getComputedStyle(element).fontSize || "16");
    if (inline) element.style.setProperty("font-size", inline, priority);
    return Math.round(size || 16);
  }
  function updateTextSizeOutput() {
    copyEditor.querySelector("[data-text-size-output]")?.replaceChildren(String(activeTextTarget ? currentTextSize() : 16));
  }
  function openTextSheet(target, config) {
    openSectionSheet(target.dataset.editLabel || "문구", "고친 내용이 미리보기에 바로 보여요.", "style", "text-copy", target, null);
    activeTextTarget = target;
    activeTextConfig = config;
    if (textInput) {
      textInput.value = textValueFor(target, config);
      textInput.dataset.multiline = config.multiline ? "true" : "false";
      textInput.rows = config.multiline ? Math.min(6, Math.max(3, textInput.value.split("\n").length + 1)) : 1;
    }
    copyEditor.querySelector("[data-text-copy-hint]")?.toggleAttribute("hidden", !config.wholeParagraphs);
    updateTextSizeOutput();
    // 휴대폰 키보드가 올라온 뒤에도 고치는 글자가 보이게 한 번 더 맞춤
    setTimeout(() => revealInPreview(target), 420);
  }
  textInput?.addEventListener("input", () => {
    if (!activeTextTarget || !activeTextConfig) return;
    if (textInput.dataset.multiline !== "true" && /\n/.test(textInput.value)) textInput.value = textInput.value.replace(/\n+/g, " ");
    setFormValue(activeTextConfig.name, textInput.value);
    applyTextToTarget(activeTextTarget, activeTextConfig, textInput.value);
  });
  textInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && textInput.dataset.multiline !== "true") event.preventDefault();
  });
  copyEditor.querySelectorAll("[data-text-size-step]").forEach((button) => button.addEventListener("click", () => {
    if (!activeTextTarget || !activeTextConfig?.name) return;
    const size = Math.max(10, Math.min(48, currentTextSize() + Number(button.dataset.textSizeStep)));
    invitationData.textStyles ||= {};
    invitationData.textStyles[activeTextConfig.name] = { ...(invitationData.textStyles[activeTextConfig.name] || {}), fontSize: size };
    activeTextTarget.style.setProperty("font-size", `${size}px`, "important");
    updateTextSizeOutput();
  }));
  copyEditor.querySelector("[data-text-size-reset]")?.addEventListener("click", () => {
    if (!activeTextTarget || !activeTextConfig?.name) return;
    delete invitationData.textStyles?.[activeTextConfig.name];
    ["font-size", "transform", "position", "z-index"].forEach((property) => activeTextTarget.style.removeProperty(property));
    frameDocumentRef?.defaultView?.fitSingleLineText?.();
    updateTextSizeOutput();
  });

  // 대표이미지 카드: 사진 + 정보(이름·생일·부모님)
  function profileQuickKey(side, field) {
    return field === "name" || field === "birthday" ? `couple.${side}.${field}` : `${side}${field}`;
  }
  function openProfileSheet(side, card) {
    activeProfileTarget = side === "groom" ? "couple.groom.photo" : "couple.bride.photo";
    toolPanel.dataset.profileSide = side;
    copyEditor.querySelectorAll("[data-profile-field]").forEach((input) => {
      const key = profileQuickKey(side, input.dataset.profileField);
      input.dataset.syncQuick = key;
      input.value = form.querySelector(`[data-quick="${key}"]`)?.value ?? formValue(key);
    });
    openSectionSheet(side === "groom" ? "신랑" : "신부", "사진과 이름·생일·부모님 성함을 바꿔요.", "media", "profile", card, ".profile-card");
    activeProfileTarget = side === "groom" ? "couple.groom.photo" : "couple.bride.photo";
  }
  function openParentsSheet(target) {
    copyEditor.querySelectorAll('[data-tooldock-pane="parents"] [data-sync-quick]').forEach((input) => {
      input.value = form.querySelector(`[data-quick="${input.dataset.syncQuick}"]`)?.value || "";
    });
    copyEditor.querySelectorAll('[data-tooldock-pane="parents"] [data-sync-name]').forEach((input) => {
      input.value = formValue(input.dataset.syncName);
    });
    openSectionSheet("부모님 성함", "비워 두면 그 분은 표시되지 않아요.", "parents", "parents", target, "#invitation .parents");
  }
  function syncCalendarHeartChoice() {
    const current = formValue("appearance.design.calendarHeart") || "burgundy";
    copyEditor.querySelectorAll("[data-calendar-heart]").forEach((button) => button.classList.toggle("is-active", button.dataset.calendarHeart === current));
  }
  function openCalendarSheet(target) {
    syncCalendarHeartChoice();
    openSectionSheet("달력 하트 색", "하트 색을 고르면 미리보기에 바로 보여요.", "calendar", "calendar", target, "#wedding-day .calendar");
  }
  copyEditor.querySelectorAll("[data-calendar-heart]").forEach((button) => button.addEventListener("click", () => {
    setFormValue("appearance.design.calendarHeart", button.dataset.calendarHeart);
    syncCalendarHeartChoice();
    refreshFrameAppearance();
  }));
  // 꾸밈: 고른 꾸밈(레이아웃 기본이면 실제 적용된 꾸밈)에 해당하는 설정만 보여 줌
  function syncFrameSettings() {
    const pane = copyEditor.querySelector('[data-tooldock-pane="frame"]');
    if (!pane) return;
    const selected = pane.querySelector('input[name="appearance.design.heroDecoration"]:checked')?.value || "inherit";
    const effective = selected === "inherit" ? (frameDocumentRef?.body?.dataset.heroDecoration || "none") : selected;
    const isHeart = effective === "frame_heart";
    const show = { tint: isHeart, stroke: isHeart, y: isHeart, size: ["frame_heart", "frame_arch", "frame_inset"].includes(effective) };
    pane.querySelectorAll("[data-frame-setting]").forEach((item) => { item.hidden = !show[item.dataset.frameSetting]; });
    const empty = pane.querySelector("[data-frame-settings-empty]");
    if (empty) {
      empty.hidden = Object.values(show).some(Boolean);
      empty.textContent = effective === "text_marriage" ? "‘저희, 결혼합니다’ 문구는 따로 조절할 항목이 없어요." : "꾸밈 없이 사진만 보여요.";
    }
    const tint = (formValue("appearance.design.heroDecorationTint") || "#ffffff").toLowerCase();
    pane.querySelectorAll("[data-frame-tint]").forEach((button) => button.classList.toggle("is-active", button.dataset.frameTint === tint));
    pane.querySelector(".hero-frame-custom")?.classList.toggle("is-active", ![...pane.querySelectorAll("[data-frame-tint]")].some((button) => button.dataset.frameTint === tint));
  }
  copyEditor.querySelectorAll("[data-frame-tint]").forEach((button) => button.addEventListener("click", () => {
    const field = form.elements["appearance.design.heroDecorationTint"];
    if (!field) return;
    field.value = button.dataset.frameTint;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    syncFrameSettings();
  }));
  copyEditor.querySelector('[data-tooldock-pane="frame"]')?.addEventListener("change", () => requestAnimationFrame(() => syncFrameSettings()));
  // 중간 사진 보이는 영역 맞추기(메인 사진과 같은 방식, 기본 중심은 세로 70%)
  let interludeAdjusting = false;
  function frameValues(prefix, defaultY = 50) {
    return {
      enabled: formValue(`${prefix}.enabled`) === "true",
      x: numberOr(formValue(`${prefix}.x`), 50),
      y: numberOr(formValue(`${prefix}.y`), defaultY),
      zoom: numberOr(formValue(`${prefix}.zoom`), 100),
      ratio: numberOr(formValue(`${prefix}.ratio`), 0),
    };
  }
  function applyInterludeFramePreview(frame = frameValues("media.interludeFrame", 70)) {
    const element = frameDocumentRef?.querySelector(".photo-interlude-media");
    const apply = frameDocumentRef?.defaultView?.applyHeroImageFrame;
    return element && apply ? apply(element, frame) : null;
  }
  async function startInterludeFrameAdjust() {
    const image = formValue("media.interludePhoto");
    if (!image || !toolPanel) return;
    if (!(numberOr(formValue("media.interludeFrame.ratio"), 0) > 0)) {
      const ratio = await new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(probe.naturalWidth / probe.naturalHeight);
        probe.onerror = () => resolve(0);
        probe.src = adminMediaUrl(image);
      });
      if (ratio) setFormValue("media.interludeFrame.ratio", String(Number(ratio.toFixed(4))));
    }
    interludeAdjusting = true;
    copyEditor.querySelector("[data-interlude-frame-tools]")?.removeAttribute("hidden");
    copyEditor.querySelector("[data-interlude-frame-open]")?.setAttribute("hidden", "");
    copyEditor.querySelector("[data-interlude-photo-actions]")?.setAttribute("hidden", "");
    frameDocumentRef?.body.classList.add("interlude-frame-adjusting");
    syncHeroControlsUi();
    requestAnimationFrame(() => revealInPreview(frameDocumentRef?.querySelector("#photo-interlude")));
  }
  function stopInterludeFrameAdjust() {
    interludeAdjusting = false;
    copyEditor.querySelector("[data-interlude-frame-tools]")?.setAttribute("hidden", "");
    copyEditor.querySelector("[data-interlude-photo-actions]")?.removeAttribute("hidden");
    frameDocumentRef?.body.classList.remove("interlude-frame-adjusting");
    updateInterludeState();
  }
  copyEditor.querySelector("[data-interlude-frame-open]")?.addEventListener("click", startInterludeFrameAdjust);
  copyEditor.querySelector("[data-interlude-frame-close]")?.addEventListener("click", stopInterludeFrameAdjust);
  copyEditor.querySelector("[data-interlude-frame-reset]")?.addEventListener("click", () => {
    setFormValue("media.interludeFrame.enabled", "false");
    setFormValue("media.interludeFrame.x", "50");
    setFormValue("media.interludeFrame.y", "70");
    setFormValue("media.interludeFrame.zoom", "100");
    syncHeroControlsUi();
    applyInterludeFramePreview();
  });
  function updateInterludeState() {
    const has = Boolean(formValue("media.interludePhoto"));
    copyEditor.querySelector("[data-interlude-state]")?.replaceChildren(has ? "사진이 등록되어 있어요." : "아직 사진이 없어요. 세로 사진이 잘 어울려요.");
    const upload = copyEditor.querySelector('[data-interlude-action="upload"]');
    if (upload) upload.textContent = has ? "사진 바꾸기" : "사진 올리기";
    copyEditor.querySelector('[data-interlude-action="remove"]')?.toggleAttribute("hidden", !has);
    copyEditor.querySelector("[data-interlude-frame-open]")?.toggleAttribute("hidden", !has || interludeAdjusting);
  }
  function openInterludeSheet(target) {
    updateInterludeState();
    openSectionSheet("중간 사진", "달력과 오시는 길 사이에 크게 보이는 사진이에요.", "interlude", "interlude", target, "#photo-interlude");
  }
  copyEditor.querySelectorAll("[data-interlude-action]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.interludeAction === "upload") triggerFileInput('[data-image-target="media.interludePhoto"]');
    if (button.dataset.interludeAction === "remove" && confirm("중간 사진을 삭제할까요?")) triggerButton('[data-image-remove="media.interludePhoto"]');
  }));
  // 갤러리: 사진을 눌러 고르고 앞뒤 순서·바꾸기·삭제, 추가는 기존 업로드 흐름 그대로
  let gallerySelected = 0;
  function renderGallerySheet() {
    const grid = copyEditor.querySelector("[data-sheet-gallery-grid]");
    if (!grid || toolPanel?.dataset.context !== "gallery-sheet" || !form.elements["gallery.0"]) return;
    const images = galleryValues();
    const thumbs = galleryThumbValues();
    gallerySelected = Math.max(0, Math.min(gallerySelected, images.length - 1));
    grid.innerHTML = images.length
      ? images.map((image, index) => `<button type="button" class="sheet-gallery-thumb ${index === gallerySelected ? "is-selected" : ""}" data-sheet-gallery-index="${index}" style="background-image:url('${escapeAdminHtml(adminMediaUrl(thumbs[index] || image))}')" aria-label="${index + 1}번째 사진"><span>${index + 1}</span></button>`).join("")
      : '<p class="sheet-photo-state">아직 사진이 없어요. 사진 추가를 눌러 주세요.</p>';
    copyEditor.querySelector("[data-sheet-gallery-actions]")?.toggleAttribute("hidden", !images.length);
    const left = copyEditor.querySelector('[data-sheet-gallery="left"]');
    const right = copyEditor.querySelector('[data-sheet-gallery="right"]');
    if (left) left.disabled = gallerySelected <= 0;
    if (right) right.disabled = gallerySelected >= images.length - 1;
    const status = form.querySelector("[data-gallery-status]")?.textContent?.trim() || "";
    copyEditor.querySelector("[data-sheet-gallery-status]")?.replaceChildren(`${images.length}/${GALLERY_MAX}장 · ${status.startsWith("최대") ? "사진을 눌러 고른 뒤 순서를 바꾸거나 교체·삭제해요." : status}`);
    grid.querySelector(".is-selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function openGallerySheet(item) {
    const index = Number(item?.dataset.gallery);
    gallerySelected = Number.isFinite(index) && index >= 0 ? index : 0;
    const element = item || frameDocumentRef?.querySelector("#gallery");
    openSectionSheet("갤러리", "사진을 눌러 고르고 순서·교체·삭제를 해요.", "gallery", "gallery-sheet", element, item ? ".gallery-item" : "#gallery");
    renderGallerySheet();
  }
  copyEditor.querySelector('[data-tooldock-pane="gallery"]')?.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-sheet-gallery-index]");
    if (thumb) {
      gallerySelected = Number(thumb.dataset.sheetGalleryIndex);
      renderGallerySheet();
      return;
    }
    const action = event.target.closest("[data-sheet-gallery]")?.dataset.sheetGallery;
    if (!action) return;
    const images = galleryValues();
    const thumbs = galleryThumbValues();
    const index = gallerySelected;
    if (action === "add") form.querySelector("[data-gallery-upload]")?.click();
    if (action === "more") openGalleryModal();
    if (action === "replace") form.querySelector(`[data-gallery-replace="${index}"]`)?.click();
    if ((action === "left" || action === "right") && images[index]) {
      const next = action === "left" ? index - 1 : index + 1;
      if (next < 0 || next >= images.length) return;
      [images[index], images[next]] = [images[next], images[index]];
      [thumbs[index], thumbs[next]] = [thumbs[next], thumbs[index]];
      gallerySelected = next;
      updateGallery(images, thumbs);
    }
    if (action === "remove" && images[index] && confirm(`${index + 1}번째 사진을 삭제할까요?`)) {
      images.splice(index, 1);
      thumbs.splice(index, 1);
      updateGallery(images, thumbs);
    }
  });
  // 업로드 진행 문구도 시트에 보이게
  const galleryStatusElement = form.querySelector("[data-gallery-status]");
  if (galleryStatusElement && "MutationObserver" in window) {
    new MutationObserver(() => renderGallerySheet()).observe(galleryStatusElement, { childList: true, characterData: true, subtree: true });
  }

  // 계좌: 기본 탭의 계좌 편집기를 시트로 옮겨 그대로 사용하고, 닫으면 제자리로
  let accountSnapshot = null;
  let accountHome = null;
  function openAccountSheet(target) {
    const manager = form.querySelector("[data-account-manager]");
    if (!manager) return;
    accountSnapshot = { items: accountItems(), suppressed: [...(invitationData.accountSuppressedKeys || [])] };
    if (!accountHome) accountHome = { parent: manager.parentElement, next: manager.nextSibling };
    copyEditor.querySelector("[data-sheet-account-host]")?.appendChild(manager);
    openSectionSheet("계좌 안내", "계좌를 고치고, 필요 없는 계좌는 ×로 지워요.", "account", "account", target, "#account .account-groups");
  }
  function returnAccountManager() {
    const manager = form.querySelector("[data-account-manager]");
    if (!manager || !accountHome?.parent || manager.parentElement === accountHome.parent) return;
    const next = accountHome.next?.parentElement === accountHome.parent ? accountHome.next : null;
    accountHome.parent.insertBefore(manager, next);
  }
  ["input", "change", "click"].forEach((type) => toolPanel?.addEventListener(type, (event) => {
    if (event.target.closest?.("[data-sheet-account-host]")) schedulePreviewRender();
  }));

  // 시트 입력칸 → 기존 폼 필드(기본 탭과 같은 값)로 동기화
  toolPanel?.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset?.syncQuick) {
      const quick = form.querySelector(`[data-quick="${input.dataset.syncQuick}"]`);
      if (quick) {
        quick.value = input.value;
        quick.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        setFormValue(input.dataset.syncQuick, input.value);
      }
      schedulePreviewRender();
    }
    if (input.dataset?.syncName) {
      setFormValue(input.dataset.syncName, input.value);
      schedulePreviewRender();
    }
  });
  // 편집 중인 대상이 시트에 가리지 않게 관리자 화면(필요하면 미리보기 안쪽도)을 스크롤
  function scrollParentOf(element) {
    let node = element?.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node;
      node = node.parentElement;
    }
    return null;
  }
  function revealHeroInPreview() {
    revealInPreview(frameDocumentRef?.querySelector(toolPanel?.dataset.context === "hero" ? ".hero-media" : ".hero-content"));
  }
  // 받는 분 이름이 이미 보이면 그대로 두고, 미리보기 창 밖이나 시트 뒤에 있을 때만 revealInPreview
  function revealHeroTo() {
    const target = frameDocumentRef?.querySelector("[data-hero-to]");
    const frameElement = copyEditor.querySelector("[data-copy-editor-frame]");
    if (!target || !frameElement || !toolPanel || toolPanel.hidden) return;
    const rect = target.getBoundingClientRect();
    if (!rect.height) return;
    const frameRect = frameElement.getBoundingClientRect();
    const headerBottom = Math.max(0, document.querySelector(".general-admin-header")?.getBoundingClientRect().bottom || 0);
    const top = Math.max(frameRect.top, headerBottom);
    const bottom = Math.min(frameRect.bottom, toolPanel.getBoundingClientRect().top);
    if (frameRect.top + rect.top >= top && frameRect.top + rect.bottom <= bottom) return;
    revealInPreview(target);
  }

  function revealInPreview(target) {
    const frameElement = copyEditor.querySelector("[data-copy-editor-frame]");
    if (!frameElement || !target || !toolPanel || toolPanel.hidden) return;
    const headerBottom = Math.max(0, document.querySelector(".general-admin-header")?.getBoundingClientRect().bottom || 0);
    const sheetTop = toolPanel.getBoundingClientRect().top;
    const visibleTop = headerBottom > sheetTop - 120 ? 0 : headerBottom;
    const outer = scrollParentOf(frameElement);
    const scrollPage = (amount) => {
      if (Math.abs(amount) <= 4) return;
      if (outer) outer.scrollBy({ top: amount, behavior: "auto" });
      else window.scrollBy({ top: amount, behavior: "auto" });
    };
    const focusCenter = (top, bottom) => {
      const rect = target.getBoundingClientRect();
      const frameRect = frameElement.getBoundingClientRect();
      return frameRect.top + rect.top + Math.min(rect.height, bottom - top - 16) / 2;
    };
    const frameDocumentHeight = frameDocumentRef.documentElement.scrollHeight;
    if (frameDocumentHeight > frameElement.clientHeight + 4) {
      // 미리보기가 고정 높이 창이고 안에서 스크롤되는 경우: 창을 헤더 바로 아래로 올리고, 창 안에서 대상을 가운데로
      scrollPage(frameElement.getBoundingClientRect().top - (visibleTop + 8));
      const frameRect = frameElement.getBoundingClientRect();
      const top = Math.max(frameRect.top, visibleTop);
      const bottom = Math.min(frameRect.bottom, sheetTop);
      const amount = focusCenter(top, bottom) - (top + bottom) / 2;
      if (Math.abs(amount) > 4) frameElement.contentWindow?.scrollBy({ top: amount, behavior: "auto" });
      return;
    }
    // 미리보기가 문서 높이만큼 늘어난 경우: 관리자 화면을 스크롤
    scrollPage(focusCenter(visibleTop, sheetTop) - (visibleTop + sheetTop) / 2);
  }

  function openHeroSheet(context, tab, title, help) {
    const inHeroSheet = toolPanel && !toolPanel.hidden && ["hero", "hero-copy"].includes(toolPanel.dataset.context);
    if (!heroEditSnapshot || !inHeroSheet) takeHeroSnapshot();
    clearEditingTarget();
    activeTextTarget = null;
    activeTextConfig = null;
    setToolDock(title, help, tab, context);
    syncHeroCopyInputs();
    syncHeroControlsUi();
    requestAnimationFrame(revealHeroInPreview);
  }
  function finishHeroEditing(cancel) {
    stopInterludeFrameAdjust();
    if (cancel && accountSnapshot) {
      renderAccountItems(accountSnapshot.items);
      invitationData.accountSuppressedKeys = accountSnapshot.suppressed;
    }
    if (cancel) restoreHeroSnapshot();
    accountSnapshot = null;
    returnAccountManager();
    heroEditSnapshot = null;
    stopHeroFrameAdjust();
    clearEditingTarget();
    activeTextTarget = null;
    activeTextConfig = null;
    if (toolPanel) toolPanel.hidden = true;
    updateFloatingSaveForToolDock();
  }

  // 메인 사진 보이는 영역 맞추기
  function numberOr(value, fallback) {
    return value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
  }
  function currentHeroFrame() {
    return {
      enabled: formValue("hero.imageFrame.enabled") === "true",
      x: numberOr(formValue("hero.imageFrame.x"), 50),
      y: numberOr(formValue("hero.imageFrame.y"), 50),
      zoom: numberOr(formValue("hero.imageFrame.zoom"), 100),
      ratio: numberOr(formValue("hero.imageFrame.ratio"), 0),
    };
  }
  function applyHeroFramePreview(frame = currentHeroFrame()) {
    const media = frameDocumentRef?.querySelector(".hero-media");
    const apply = frameDocumentRef?.defaultView?.applyHeroImageFrame;
    return media && apply ? apply(media, frame) : null;
  }
  async function startHeroFrameAdjust() {
    const image = formValue("hero.image");
    if (!image || !toolPanel) return;
    if (!(numberOr(formValue("hero.imageFrame.ratio"), 0) > 0)) {
      const ratio = await new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(probe.naturalWidth / probe.naturalHeight);
        probe.onerror = () => resolve(0);
        probe.src = adminMediaUrl(image);
      });
      if (ratio) setFormValue("hero.imageFrame.ratio", String(Number(ratio.toFixed(4))));
    }
    heroFrameAdjusting = true;
    toolPanel.classList.add("is-frame-adjusting");
    copyEditor.querySelector("[data-hero-frame-tools]")?.removeAttribute("hidden");
    frameDocumentRef?.body.classList.add("hero-frame-adjusting");
    toolPanel.querySelector("[data-tooldock-title]").textContent = "보이는 영역 맞추기";
    toolPanel.querySelector("[data-tooldock-help]").textContent = "미리보기 사진을 끌어 옮기고, 확대로 크기를 맞춰요.";
    syncHeroControlsUi();
    requestAnimationFrame(revealHeroInPreview);
  }
  function stopHeroFrameAdjust() {
    heroFrameAdjusting = false;
    toolPanel?.classList.remove("is-frame-adjusting");
    copyEditor.querySelector("[data-hero-frame-tools]")?.setAttribute("hidden", "");
    frameDocumentRef?.body.classList.remove("hero-frame-adjusting");
    if (toolPanel?.dataset.context === "hero") {
      toolPanel.querySelector("[data-tooldock-title]").textContent = "메인 사진";
      toolPanel.querySelector("[data-tooldock-help]").textContent = "사진 변경·보이는 영역·꾸밈을 바꿔요.";
    }
  }
  function resetHeroFrame() {
    setFormValue("hero.imageFrame.enabled", "false");
    setFormValue("hero.imageFrame.x", "50");
    setFormValue("hero.imageFrame.y", "50");
    setFormValue("hero.imageFrame.zoom", "100");
    syncHeroControlsUi();
    applyHeroFramePreview();
  }

  // 미리보기에서 끌기: 문구 묶음은 위아래로, (영역 맞추기 중) 사진은 상하좌우로
  let heroGesture = null;
  let heroSuppressClick = false;
  function heroGestureConsumedClick() {
    if (!heroSuppressClick) return false;
    heroSuppressClick = false;
    return true;
  }
  function bindHeroPreviewGestures(frameDocument) {
    const body = frameDocument.body;
    frameDocument.addEventListener("pointerdown", (event) => {
      if (!copyEditor.classList.contains("is-frame-interaction-enabled") || event.button > 0) return;
      const hero = frameDocument.querySelector(".hero");
      const media = frameDocument.querySelector(".hero-media");
      if (!hero) return;
      if (interludeAdjusting && event.target.closest("#photo-interlude")) {
        const frame = { ...frameValues("media.interludeFrame", 70), enabled: true };
        const size = applyInterludeFramePreview(frame);
        const element = frameDocument.querySelector(".photo-interlude-media");
        if (!size || !element) return;
        heroGesture = { type: "photo", prefix: "media.interludeFrame", apply: applyInterludeFramePreview, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, frame, size, element };
      } else if (heroFrameAdjusting && event.target.closest(".hero")) {
        const frame = { ...currentHeroFrame(), enabled: true };
        const size = applyHeroFramePreview(frame);
        if (!size || !media) return;
        heroGesture = { type: "photo", prefix: "hero.imageFrame", apply: applyHeroFramePreview, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, frame, size, element: media };
      } else {
        const content = event.target.closest(".hero-content");
        if (!content || heroFrameAdjusting || event.target.closest("[data-copy-edit-handle]")) return;
        const heroRect = hero.getBoundingClientRect();
        const rect = content.getBoundingClientRect();
        const startPercent = ((rect.top + rect.height / 2 - heroRect.top) / heroRect.height) * 100;
        heroGesture = { type: "text", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, heroHeight: heroRect.height, startPercent, element: content };
      }
      try { heroGesture.element.setPointerCapture?.(event.pointerId); } catch {}
    });
    frameDocument.addEventListener("pointermove", (event) => {
      const gesture = heroGesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
      gesture.moved = true;
      event.preventDefault();
      if (gesture.type === "text") {
        const percent = Math.round(Math.max(8, Math.min(92, gesture.startPercent + (dy / gesture.heroHeight) * 100)));
        gesture.element.classList.add("is-dragging");
        body.classList.add("hero-text-user-positioned");
        body.style.setProperty("--custom-hero-y", `${percent}%`);
        const slider = form.elements["appearance.design.heroTextYPercent"];
        if (slider) slider.value = String(percent);
        setFormValue("appearance.design.heroTextPositioned", "true");
      } else {
        const { size, frame } = gesture;
        const spanX = size.boxWidth - size.imageWidth;
        const spanY = size.boxHeight - size.imageHeight;
        const next = {
          ...frame,
          x: spanX < -1 ? Math.round(Math.max(0, Math.min(100, frame.x + (dx / spanX) * 100))) : frame.x,
          y: spanY < -1 ? Math.round(Math.max(0, Math.min(100, frame.y + (dy / spanY) * 100))) : frame.y,
        };
        setFormValue(`${gesture.prefix}.enabled`, "true");
        setFormValue(`${gesture.prefix}.x`, String(next.x));
        setFormValue(`${gesture.prefix}.y`, String(next.y));
        gesture.apply(next);
      }
    }, { passive: false });
    const endGesture = (event) => {
      const gesture = heroGesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      heroGesture = null;
      gesture.element.classList.remove("is-dragging");
      if (!gesture.moved) return;
      heroSuppressClick = true;
      setTimeout(() => { heroSuppressClick = false; }, 450);
      if (gesture.type === "text") {
        if (toolPanel?.dataset.context !== "hero-copy" || toolPanel.hidden) openHeroSheet("hero-copy", "position", HERO_COPY_TITLE, HERO_COPY_HELP);
        else setToolDock(HERO_COPY_TITLE, HERO_COPY_HELP, "position", "hero-copy");
        refreshFrameAppearance();
      }
      syncHeroControlsUi();
    };
    frameDocument.addEventListener("pointerup", endGesture);
    frameDocument.addEventListener("pointercancel", endGesture);
  }

  // 시트 안의 컨트롤
  copyEditor.querySelectorAll("[data-hero-copy]").forEach((input) => input.addEventListener("input", () => {
    setFormValue(input.dataset.heroCopy, input.value);
    renderHeroCopyInFrame();
  }));
  copyEditor.querySelectorAll("[data-hero-name-sep]").forEach((button) => button.addEventListener("click", () => {
    setFormValue("appearance.design.heroNameSeparator", button.dataset.heroNameSep);
    syncHeroControlsUi();
    renderHeroCopyInFrame();
  }));
  copyEditor.querySelectorAll("[data-hero-position]").forEach((button) => button.addEventListener("click", () => {
    const position = button.dataset.heroPosition;
    setFormValue("hero.contentPosition", position);
    setFormValue("appearance.design.heroTextPositioned", "false");
    const slider = form.elements["appearance.design.heroTextYPercent"];
    if (slider) slider.value = String({ top: 22, middle: 50, bottom: 76 }[position] || 76);
    syncHeroControlsUi();
    refreshFrameAppearance();
  }));
  // 받는 분 위치 빠른 선택
  const syncHeroToQuick = () => {
    const y = Number(formValue("appearance.design.heroToYPercent"));
    const align = formValue("appearance.design.heroToAlign") || "center";
    copyEditor.querySelectorAll("[data-hero-to-y]").forEach((button) => button.classList.toggle("is-active", HERO_TO_Y[button.dataset.heroToY] === y));
    copyEditor.querySelectorAll("[data-hero-to-align]").forEach((button) => button.classList.toggle("is-active", button.dataset.heroToAlign === align));
  };
  const setHeroToRange = (name, value) => {
    const field = form.elements[name];
    if (!field) return;
    field.value = String(value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  copyEditor.querySelectorAll("[data-hero-to-y]").forEach((button) => button.addEventListener("click", () => {
    setHeroToRange("appearance.design.heroToYPercent", HERO_TO_Y[button.dataset.heroToY]);
    syncHeroToQuick();
  }));
  copyEditor.querySelectorAll("[data-hero-to-align]").forEach((button) => button.addEventListener("click", () => {
    setFormValue("appearance.design.heroToAlign", button.dataset.heroToAlign);
    setHeroToRange("appearance.design.heroToXPercent", HERO_TO_X[button.dataset.heroToAlign]);
    syncHeroToQuick();
  }));
  toolPanel?.addEventListener("input", (event) => {
    if (event.target?.name === "appearance.design.heroToYPercent") syncHeroToQuick();
  });
  // 슬라이더·버튼 조정은 미리보기 갱신(대상 input 리스너)보다 먼저 '직접 조정' 표시
  toolPanel?.addEventListener("input", (event) => {
    const name = event.target?.name;
    if (name === "appearance.design.heroTextYPercent") {
      setFormValue("appearance.design.heroTextPositioned", "true");
      copyEditor.querySelectorAll("[data-hero-position]").forEach((button) => button.classList.remove("is-active"));
    }
    if (name === "hero.imageFrame.zoom") setFormValue("hero.imageFrame.enabled", "true");
    // 위치·크기 조정으로 글자가 시트 뒤로 숨었을 때만 미리보기를 옮김(체크박스·색은 그대로)
    if (name?.startsWith("appearance.design.heroTo") && event.target.type === "range") setTimeout(revealHeroTo, 60);
    if (name === "media.interludeFrame.zoom") {
      setFormValue("media.interludeFrame.enabled", "true");
      requestAnimationFrame(() => applyInterludeFramePreview());
    }
  }, true);
  copyEditor.querySelector("[data-hero-size-reset]")?.addEventListener("click", () => {
    ["heroTextScale", "heroEyebrowScale", "heroNamesScale", "heroDateScale"].forEach((key) => {
      const field = form.elements[`appearance.design.${key}`];
      if (field) field.value = "100";
    });
    ["heroGapTop", "heroGapBottom"].forEach((key) => {
      const field = form.elements[`appearance.design.${key}`];
      if (field) field.value = "0";
    });
    syncHeroControlsUi();
    refreshFrameAppearance();
  });
  copyEditor.querySelector("[data-hero-frame-open]")?.addEventListener("click", startHeroFrameAdjust);
  copyEditor.querySelector("[data-hero-frame-close]")?.addEventListener("click", stopHeroFrameAdjust);
  copyEditor.querySelector("[data-hero-frame-reset]")?.addEventListener("click", resetHeroFrame);
  copyEditor.querySelector("[data-tooldock-cancel]")?.addEventListener("click", () => finishHeroEditing(true));
  copyEditor.querySelector("[data-tooldock-done]")?.addEventListener("click", () => finishHeroEditing(false));
  const onboarding = copyEditor.querySelector("[data-editor-onboarding]");
  const hideOnboarding = () => onboarding?.setAttribute("hidden", "");
  const closeOnboarding = () => {
    hideOnboarding();
    closeAdminOverlay(hideOnboarding);
  };
  copyEditor.querySelector("[data-editor-start-close]")?.addEventListener("click", closeOnboarding);
  copyEditor.querySelector("[data-editor-theme-open]")?.addEventListener("click", () => {
    if (!onboarding) return;
    onboarding.classList.add("is-browse");
    const apply = onboarding.querySelector("[data-editor-start-apply]");
    if (apply) apply.textContent = "완료";
    onboarding.removeAttribute("hidden");
    openAdminOverlay(hideOnboarding);
    onboarding.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
  });
  onboarding?.addEventListener("click", (event) => { if (event.target === onboarding) closeOnboarding(); });
    copyEditor.querySelector("[data-editor-start-apply]")?.addEventListener("click", () => {
      closeOnboarding();
    });
  copyEditor.querySelectorAll("[data-onboarding-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPresetChoice(button.dataset.onboardingPreset));
  });
  copyEditor.querySelectorAll("[data-onboarding-text-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      form.elements["appearance.design.heroTextTheme"].value = button.dataset.onboardingTextTheme;
      copyEditor.querySelectorAll("[data-onboarding-text-theme]").forEach((item) => item.classList.toggle("is-selected", item === button));
      copyEditor.querySelectorAll("[data-design-text-theme]").forEach((item) => item.classList.toggle("is-selected", item.dataset.designTextTheme === button.dataset.onboardingTextTheme));
      refreshFrameAppearance();
    });
  });
  // 선택된 레이아웃이 목록 가운데에 보이게(가로 목록이라 처음엔 화면 밖에 있을 수 있음)
  const centerActiveLayout = (smooth = false) => {
    const list = copyEditor.querySelector(".editor-layout-options");
    const active = list?.querySelector(".editor-layout-btn.is-active");
    if (!list || !active) return;
    list.scrollTo({ left: Math.max(0, active.offsetLeft - list.offsetLeft - (list.clientWidth - active.offsetWidth) / 2), behavior: smooth ? "smooth" : "auto" });
  };
  requestAnimationFrame(() => centerActiveLayout());
  // 레이아웃 변경 핸들러
  copyEditor.querySelectorAll("[data-editor-layout]").forEach((button) => {
    button.addEventListener("click", async () => {
      requestAnimationFrame(() => centerActiveLayout(true));
      const layoutId = button.dataset.editorLayout;
      const previousLayoutId = invitationData.designSystem.activeLayoutId || "classic";
      const previousActive = copyEditor.querySelector("[data-editor-layout].is-active");
      button.disabled = true;
      copyEditor.querySelectorAll("[data-editor-layout]").forEach((b) => b.classList.toggle("is-active", b === button));
      invitationData.designSystem.activeLayoutId = layoutId;
      const ownColors = LAYOUTS_WITH_OWN_COLORS[layoutId];
      const layoutGroup = form.querySelector("[data-layout-colors-group]");
      if (layoutGroup) { layoutGroup.hidden = !ownColors; layoutGroup.disabled = !ownColors; }
      copyEditor.querySelector(".editor-start-layout-colors")?.toggleAttribute("hidden", !ownColors);
      const presetSelect = form.elements.editorPresetId;
      if (presetSelect) {
        if (!ownColors && presetSelect.value === LAYOUT_COLOR_PRESET) presetSelect.value = form.elements["appearance.design.presetId"].value;
        if (ownColors && form.elements["appearance.design.skinColors"]?.value !== "theme") presetSelect.value = LAYOUT_COLOR_PRESET;
        presetSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      refreshFrameAppearance();
      try {
        await window.RSVP_STORAGE.saveInvitationData(invitationData);
      } catch (error) {
        invitationData.designSystem.activeLayoutId = previousLayoutId;
        copyEditor.querySelectorAll("[data-editor-layout]").forEach((b) => b.classList.toggle("is-active", b === previousActive));
        refreshFrameAppearance();
        notifySaveFailure(error, "레이아웃을 저장");
      } finally {
        button.disabled = false;
      }
    });
  });
  // 미리보기가 자기 데이터를 다 불러오면(ready) 지금 편집 중인 값으로 한 번 다시 그림 — 사진·테마·스티커가 처음부터 실제 화면대로 보이게
  const onPreviewReady = (event) => {
    if (!copyEditor.isConnected) { window.removeEventListener("message", onPreviewReady); return; }
    const frameWindow = copyEditor.querySelector("[data-copy-editor-frame]")?.contentWindow;
    if (event.source !== frameWindow || event.data?.source !== "wedding-sticker-editor" || event.data.type !== "ready") return;
    renderPreviewNow();
  };
  window.addEventListener("message", onPreviewReady);
  copyEditor.querySelector("[data-copy-editor-frame]")?.addEventListener("load", (event) => {
    const frameElement = event.currentTarget;
    const frameDocument = frameElement.contentDocument;
    if (!frameDocument) return;
    frameDocumentRef = frameDocument;
    frameElement.classList.add("is-editor-ready");
    // 미리보기 안 스크롤은 브라우저 기본 스크롤 그대로 씀. 예전에는 휠을 가로채 scrollBy로 직접 움직였는데,
    // 청첩장의 부드러운 스크롤(scroll-behavior: smooth) 때문에 휠마다 애니메이션이 새로 시작돼 매우 느렸음
    syncFrameScrollHeight = () => {
      const doc = frameElement.contentDocument;
      if (!doc?.documentElement || !doc.body) return;
      const appRoot = doc.querySelector("#app");
      const invitation = doc.querySelector(".invitation");
      const ending = doc.querySelector(".ending");
      const lastSection = [...doc.querySelectorAll(".section, .ending")].at(-1);
      const bottomOf = (element) => element ? Math.ceil(element.getBoundingClientRect().bottom + (frameElement.contentWindow?.scrollY || 0)) : 0;
      const height = Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight,
        doc.documentElement.offsetHeight,
        doc.body.offsetHeight,
        appRoot?.scrollHeight || 0,
        invitation?.scrollHeight || 0,
        bottomOf(ending),
        bottomOf(lastSection),
        2600
      );
      frameElement.style.setProperty("--copy-frame-document-height", `${height}px`);
      frameElement.style.height = `${height}px`;
    };
    frameElement._copyPreviewResizeObserver?.disconnect?.();
    try {
      frameElement._copyPreviewResizeObserver = new frameElement.contentWindow.ResizeObserver(syncFrameScrollHeight);
      frameElement._copyPreviewResizeObserver.observe(frameDocument.documentElement);
      frameElement._copyPreviewResizeObserver.observe(frameDocument.body);
      frameDocument.querySelectorAll("#app, .invitation, .section, .ending").forEach((item) => {
        frameElement._copyPreviewResizeObserver.observe(item);
      });
    } catch (error) {
      console.warn("[copy preview resize observer]", error);
    }
    syncFrameScrollHeight();
    frameElement.contentWindow?.requestAnimationFrame?.(syncFrameScrollHeight);
    setTimeout(syncFrameScrollHeight, 250);
    setTimeout(syncFrameScrollHeight, 900);
    setTimeout(syncFrameScrollHeight, 1800);
    const logFrameSetupError = (error) => console.error("copy editor preview setup failed", error);
    try {
      refreshFrameAppearance();
    } catch (error) {
      logFrameSetupError(error);
    }
    const syncField = (name, value) => {
      const fields = [...form.querySelectorAll(`[name="${name}"]`)];
      if (!fields.length) {
        const field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        form.appendChild(field);
        fields.push(field);
      }
      fields.forEach((field) => { field.value = value; });
    };
    const editableSelector = ".hero-media, .profile-card, .profile-photo, .hero-content, #invitation .parents, #photo-interlude, #account .account-groups, body[data-layout-skin='valentine_choco'] #wedding-day .calendar, .section-label, .section-title, .location-venue, .location-hall, .location-address, .transport, .transport div, #gallery, .gallery-item, .information-tabs, .information-panel, #attendance .subtle, #account .subtle, #guestbook .subtle, .invitation-copy-group, .ending-content .preserve";
    let isMarkingEditableAreas = false;
    const clearEditableAreas = () => {
      frameDocument.querySelectorAll("[data-copy-edit-handle]").forEach((item) => item.remove());
      frameDocument.querySelectorAll(".copy-editable-target").forEach((item) => {
        item.classList.remove("copy-editable-target");
        item.removeAttribute("data-edit-label");
        delete item.dataset.editTargetIndex;
      });
    };
    const markEditableAreas = () => {
      isMarkingEditableAreas = true;
      clearEditableAreas();
      if (!copyEditor.classList.contains("is-frame-interaction-enabled")) {
        isMarkingEditableAreas = false;
        requestAnimationFrame(syncFrameScrollHeight);
        return;
      }
      const invitationSection = frameDocument.querySelector("#invitation");
      if (invitationSection && !invitationSection.querySelector(".invitation-copy-group")) {
        const paragraphs = [...invitationSection.querySelectorAll(":scope > .invitation-copy")];
        if (paragraphs.length) {
          const group = frameDocument.createElement("div");
          group.className = "invitation-copy-group";
          invitationSection.insertBefore(group, paragraphs[0]);
          paragraphs.forEach((paragraph) => group.appendChild(paragraph));
        }
      }
      frameDocument.querySelectorAll(".hero-media, .profile-card, .hero-content, #invitation .parents, #photo-interlude, #account .account-groups, body[data-layout-skin='valentine_choco'] #wedding-day .calendar, .section-label, .section-title, .location-venue, .location-hall, .location-address, .transport, #gallery, .information-tabs, #attendance .subtle, #account .subtle, #guestbook .subtle, .invitation-copy-group, .ending-content .preserve").forEach((item) => {
        item.classList.add("copy-editable-target");
      });
      window.WEDDING_DESIGN?.applyTextStyles?.(invitationData, frameDocument);
      frameDocument.querySelector(".hero-media")?.setAttribute("data-edit-label", "메인 사진");
      frameDocument.querySelector(".hero-content")?.setAttribute("data-edit-label", "메인 문구 · 눌러서 수정, 끌어서 이동");
      frameDocument.querySelectorAll(".section-label").forEach((item) => item.setAttribute("data-edit-label", "영문 타이틀"));
      frameDocument.querySelectorAll(".section-title").forEach((item) => item.setAttribute("data-edit-label", "국문 타이틀"));
      frameDocument.querySelector(".invitation-copy-group")?.setAttribute("data-edit-label", "초대글");
      frameDocument.querySelector("#invitation .parents")?.setAttribute("data-edit-label", "부모님 성함");
      frameDocument.querySelector("#photo-interlude")?.setAttribute("data-edit-label", "중간 사진");
      frameDocument.querySelector("#account .account-groups")?.setAttribute("data-edit-label", "계좌 목록");
      frameDocument.querySelector("body[data-layout-skin='valentine_choco'] #wedding-day .calendar")?.setAttribute("data-edit-label", "달력 하트 색");
      frameDocument.querySelector(".location-venue")?.setAttribute("data-edit-label", "식장명");
      frameDocument.querySelector(".location-hall")?.setAttribute("data-edit-label", "홀 정보");
      frameDocument.querySelector(".location-address")?.setAttribute("data-edit-label", "주소");
      frameDocument.querySelector(".transport")?.setAttribute("data-edit-label", "교통 안내 항목");
      frameDocument.querySelector("#gallery")?.setAttribute("data-edit-label", "갤러리 사진");
      frameDocument.querySelector(".information-tabs")?.setAttribute("data-edit-label", "식장 안내 항목");
      frameDocument.querySelector("#attendance .subtle")?.setAttribute("data-edit-label", "참석 안내 문구");
      frameDocument.querySelector("#account .subtle")?.setAttribute("data-edit-label", "계좌 안내 문구");
      frameDocument.querySelector("#guestbook .subtle")?.setAttribute("data-edit-label", "방명록 안내 문구");
      frameDocument.querySelector(".ending-content .preserve")?.setAttribute("data-edit-label", "마지막 문구");
      frameDocument.querySelectorAll(".profile-card").forEach((card, index) => card.setAttribute("data-edit-label", index === 0 ? "신랑 대표이미지" : "신부 대표이미지"));
      frameDocument.querySelectorAll(".copy-editable-target").forEach((target, index) => {
        target.dataset.editTargetIndex = String(index);
        const handle = frameDocument.createElement("button");
        handle.type = "button";
        handle.className = "copy-edit-handle";
        handle.dataset.copyEditHandle = String(index);
        handle.setAttribute("aria-label", `${target.dataset.editLabel || "선택 영역"} 편집`);
        handle.textContent = "✎";
        target.appendChild(handle);
      });
      setTimeout(() => { isMarkingEditableAreas = false; }, 0);
      requestAnimationFrame(syncFrameScrollHeight);
    };
    const safeMarkEditableAreas = () => {
      try {
        markEditableAreas();
      } catch (error) {
        isMarkingEditableAreas = false;
        logFrameSetupError(error);
      }
    };
    refreshEditHandles = safeMarkEditableAreas;
    safeMarkEditableAreas();
    frameElement.contentWindow?.requestAnimationFrame?.(safeMarkEditableAreas);
    setTimeout(safeMarkEditableAreas, 180);
    setTimeout(safeMarkEditableAreas, 650);
    if ("MutationObserver" in window) {
      let editableMarkTimer = 0;
      // 카운트다운(1초마다 바뀜)처럼 편집 대상과 무관한 변화로는 수정 영역 표시를 다시 그리지 않음 — 매초 다시 그리면 스크롤이 버벅임
      const ignoredMutation = (record) => {
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        return Boolean(element?.closest?.(".countdown, #countdown-message, .day-strip"));
      };
      const editableObserver = new MutationObserver((records) => {
        if (isMarkingEditableAreas) return;
        if (records.every(ignoredMutation)) return;
        clearTimeout(editableMarkTimer);
        editableMarkTimer = setTimeout(safeMarkEditableAreas, 120);
      });
      editableObserver.observe(frameDocument.querySelector("#app") || frameDocument.body, { childList: true, subtree: true });
    }
    const mediaTarget = (target) => {
      const profile = target.closest(".profile-card");
      if (profile) return [...frameDocument.querySelectorAll(".profile-card")].indexOf(profile) === 0 ? "groom" : "bride";
      if (target.closest(".hero-media")) return "hero";
      return "";
    };
    frameDocument.addEventListener("click", (clickEvent) => {
      if (!copyEditor.classList.contains("is-frame-interaction-enabled")) {
        if (clickEvent.target.closest("a, button, input, select, textarea, label")) {
          clickEvent.preventDefault();
          clickEvent.stopImmediatePropagation();
        }
        return;
      }
      if (heroGestureConsumedClick()) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        return;
      }
      const detailButton = clickEvent.target.closest("[data-preview-detail-edit]");
      if (detailButton) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = null;
        setToolDock(
          detailButton.dataset.previewDetailEdit === "rsvp" ? "RSVP 세부내용" : "게스트앨범 세부내용",
          "모달 안에서 보이는 안내 문구를 수정합니다.",
          "items",
          detailButton.dataset.previewDetailEdit === "rsvp" ? "rsvp-detail" : "wedding-snap-detail"
        );
        return;
      }
      const handle = clickEvent.target.closest("[data-copy-edit-handle]");
      const target = handle ? handle.closest(editableSelector) : clickEvent.target.closest(editableSelector);
      if (!target) {
        if (!target && toolPanel && !toolPanel.hidden) {
          toolPanel.classList.add("is-collapsed");
          updateFloatingSaveForToolDock();
        }
        if (clickEvent.target.closest("a, button, input, select, textarea, label")) {
          clickEvent.preventDefault();
          clickEvent.stopImmediatePropagation();
        }
        return;
      }
      const media = mediaTarget(target);
      if (media) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        if (media === "hero") {
          activeProfileTarget = "";
          activeTextTarget = null;
          if (!heroFrameAdjusting) openHeroSheet("hero", "media", "메인 사진", "사진 변경·보이는 영역·꾸밈을 바꿔요.");
        } else {
          openProfileSheet(media, target.closest(".profile-card") || target);
        }
        return;
      }
      if (target.closest(".hero-content")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = null;
        if (toolPanel?.dataset.context !== "hero-copy" || toolPanel.hidden) openHeroSheet("hero-copy", "copy", HERO_COPY_TITLE, HERO_COPY_HELP);
        return;
      }
      if (target.matches("#wedding-day .calendar")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        openCalendarSheet(target);
        return;
      }
      if (target.matches("#account .account-groups")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        openAccountSheet(target);
        return;
      }
      if (target.matches(".parents")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        openParentsSheet(target);
        return;
      }
      if (target.matches("#photo-interlude, .photo-interlude-media")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        if (!interludeAdjusting) openInterludeSheet(target.closest("#photo-interlude") || target);
        return;
      }
      const config = inlineTarget(target);
      if (config) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        openTextSheet(target, config);
        return;
      }
      if (target.closest("#gallery")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        openGallerySheet(clickEvent.target.closest(".gallery-item"));
        return;
      }
      if (target.closest("#information")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = null;
        setToolDock("식장 안내", "항목을 추가, 삭제하거나 내용을 수정합니다.", "items", "information");
        return;
      }
      if (target.closest("#location") && target.closest(".transport")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeTextTarget = null;
        setToolDock("교통 안내", "오시는 길의 교통 항목을 추가, 삭제하거나 수정합니다.", "items", "location");
      }
    }, true);
    bindHeroPreviewGestures(frameDocument);
  });
  document.querySelectorAll("[data-editor-jump]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.editorJump}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const syncParentNames = () => {
    form.elements["couple.groom.parents"].value = joinParentNames(form.querySelector('[data-quick="groomFather"]').value, form.querySelector('[data-quick="groomMother"]').value);
    form.elements["couple.bride.parents"].value = joinParentNames(form.querySelector('[data-quick="brideFather"]').value, form.querySelector('[data-quick="brideMother"]').value);
    invitationData.couple.groom.parents = form.elements["couple.groom.parents"].value;
    invitationData.couple.bride.parents = form.elements["couple.bride.parents"].value;
  };
  const accountItems = () => [...form.querySelectorAll("[data-account-editor]")].map((editor) => {
    const text = (field) => editor.querySelector(`input[name*=".${field}"]`)?.value.trim() || "";
    const relationSelect = editor.querySelector('select[name*=".relation"]')?.value || "";
    const bankSelect = editor.querySelector('select[name*=".bankSelect"]')?.value || "";
    return {
      side: text("side") || "신랑측",
      personName: text("personName"),
      name: text("name"),
      bank: bankSelect === "직접 입력" ? text("bank") : bankSelect,
      number: text("number"),
      relation: relationSelect === "직접입력" ? text("relationCustom") : relationSelect,
    };
  });
  const renderAccountItems = (items, options = {}) => {
    const normalizedItems = ensureAccountRows(items, invitationData, { appendMissing: options.appendMissing === true });
    invitationData.accounts = normalizedItems;
    const current = form.querySelector("[data-account-manager]");
    current.outerHTML = accountManager(normalizedItems, { appendMissing: false });
    bindAccountManager();
  };
  const syncAccountParentNames = () => {
    invitationData.couple.groom.name = form.elements["couple.groom.name"]?.value || invitationData.couple.groom.name;
    invitationData.couple.bride.name = form.elements["couple.bride.name"]?.value || invitationData.couple.bride.name;
    invitationData.couple.groom.parents = form.elements["couple.groom.parents"]?.value || "";
    invitationData.couple.bride.parents = form.elements["couple.bride.parents"]?.value || "";
    const map = {
      "신랑측:신랑": form.elements["couple.groom.name"]?.value || "",
      "신부측:신부": form.elements["couple.bride.name"]?.value || "",
      "신랑측:아버님": form.querySelector('[data-quick="groomFather"]')?.value || "",
      "신랑측:어머님": form.querySelector('[data-quick="groomMother"]')?.value || "",
      "신부측:아버님": form.querySelector('[data-quick="brideFather"]')?.value || "",
      "신부측:어머님": form.querySelector('[data-quick="brideMother"]')?.value || "",
    };
    let changed = false;
    const synced = accountItems().map((item) => {
      const key = `${item.side}:${item.relation}`;
      if (!Object.prototype.hasOwnProperty.call(map, key)) return item;
      if (map[key] === "" && !["신랑", "신부"].includes(item.relation)) {
        changed = true;
        return null;
      }
      changed = changed || item.personName !== map[key] || item.name !== map[key];
      return { ...item, personName: map[key], name: map[key] };
    }).filter(Boolean);
    Object.entries(map).forEach(([key, value]) => {
      const [, relation] = key.split(":");
      if (value && ["아버님", "어머님"].includes(relation) && !synced.some((item) => `${item.side}:${item.relation}` === key)) {
        changed = true;
      }
    });
    if (changed) renderAccountItems(synced, { appendMissing: true });
  };
  const refreshAutoSummaries = () => {
    const setText = (selector, value) => {
      const target = form.querySelector(selector);
      if (target) target.textContent = value || "미입력";
    };
    setText('[data-auto-value="groom.name"]', form.elements["couple.groom.name"]?.value.trim());
    setText('[data-auto-value="groom.parents"]', displayParentNames(form.elements["couple.groom.parents"]?.value || ""));
    setText('[data-auto-value="groom.birthday"]', form.elements["couple.groom.birthday"]?.value.trim());
    setText('[data-auto-value="bride.name"]', form.elements["couple.bride.name"]?.value.trim());
    setText('[data-auto-value="bride.parents"]', displayParentNames(form.elements["couple.bride.parents"]?.value || ""));
    setText('[data-auto-value="bride.birthday"]', form.elements["couple.bride.birthday"]?.value.trim());
    const venue = form.elements["wedding.venue"]?.value.trim();
    const hall = form.elements["wedding.hall"]?.value.trim() || "홀 정보 없음";
    const displayDate = form.elements["wedding.displayDateCustom"]?.value.trim() || weddingDisplayDate(form.elements["wedding.date"]?.value, form.elements["wedding.displayDateFormat"]?.value || "long_ko");
    setText('[data-auto-value="wedding.venue"]', venue);
    setText('[data-auto-value="wedding.hallDate"]', `${hall} · ${displayDate || "예식 일시 없음"}`);
  };
  form.querySelectorAll("[data-quick]").forEach((quickField) => {
    quickField.addEventListener("input", () => {
      if (["groomFather", "groomMother", "brideFather", "brideMother"].includes(quickField.dataset.quick)) {
        syncParentNames();
        syncAccountParentNames();
        refreshAutoSummaries();
        return;
      }
      const target = form.elements[quickField.dataset.quick];
      if (!target) return;
      target.value = quickField.value;
      target.dispatchEvent(new Event("change", { bubbles: true }));
      if (["couple.groom.name", "couple.bride.name"].includes(quickField.dataset.quick)) syncAccountParentNames();
      refreshAutoSummaries();
    });
  });
  form.querySelectorAll("[data-visibility-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const hiddenValue = toggle.closest(".visibility-switch")?.querySelector('input[type="hidden"]');
      if (!hiddenValue) return;
      hiddenValue.value = toggle.checked ? "true" : "false";
      hiddenValue.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  form.querySelector("[data-quick-apply]")?.addEventListener("click", () => {
    syncParentNames();
    form.querySelectorAll("[data-quick]").forEach((quickField) => {
      const target = form.elements[quickField.dataset.quick];
      if (target) {
        target.value = quickField.value;
        target.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    syncAccountParentNames();
    refreshAutoSummaries();
    form.dispatchEvent(new Event("change", { bubbles: true }));
    alert("1번 기본정보를 아래 항목에 반영했습니다. 최종 저장은 변경사항 저장 버튼을 눌러 주세요.");
  });
  form.querySelectorAll("[data-recommendation-editor]").forEach((editor) => {
    const target = editor.querySelector("input, textarea");
    editor.addEventListener("click", (event) => {
      const recommendation = event.target.closest("[data-recommendation]");
      if (recommendation) {
        target.value = recommendation.dataset.recommendation;
        editor.querySelector(".recommendation-modal")?.setAttribute("hidden", "");
      }
      if (event.target.closest("[data-recommendation-more]")) editor.classList.toggle("show-extra");
      if (event.target.closest("[data-recommendation-open]")) editor.querySelector(".recommendation-modal")?.removeAttribute("hidden");
      if (event.target.closest("[data-recommendation-close]")) editor.querySelector(".recommendation-modal")?.setAttribute("hidden", "");
    });
  });
  const bindAccountManager = () => {
    const manager = form.querySelector("[data-account-manager]");
    const syncConditionalFields = () => {
      manager?.querySelectorAll("[data-account-editor]").forEach((editor) => {
        const relationSelect = editor.querySelector('select[name*=".relation"]');
        const relationCustom = editor.querySelector("[data-account-relation-custom]");
        if (relationCustom) relationCustom.hidden = relationSelect?.value !== "직접입력";
        const bankSelect = editor.querySelector('select[name*=".bankSelect"]');
        const bankCustom = editor.querySelector("[data-account-bank-custom]");
        if (bankCustom) bankCustom.hidden = bankSelect?.value !== "직접 입력";
      });
    };
    manager?.addEventListener("click", (event) => {
      const add = event.target.closest("[data-account-add]");
      if (add) {
        renderAccountItems([...accountItems(), { side: add.dataset.accountAdd, relation: "직접입력", personName: "", name: "", bank: "", number: "" }]);
        return;
      }
      const remove = event.target.closest("[data-account-remove]");
      if (!remove) return;
      const items = accountItems();
      const index = [...form.querySelectorAll("[data-account-editor]")].indexOf(remove.closest("[data-account-editor]"));
      const removed = items[index];
      if (removed && ["신랑", "신부", "아버님", "어머님"].includes(removed.relation)) {
        invitationData.accountSuppressedKeys = [...new Set([...(invitationData.accountSuppressedKeys || []), autoAccountKey(removed)])];
      }
      items.splice(index, 1);
      renderAccountItems(items);
    });
    manager?.addEventListener("change", (event) => {
      if (event.target.matches('select[name*=".relation"]')) {
        syncConditionalFields();
        return;
      }
      const bankSelect = event.target.closest('select[name*=".bankSelect"]');
      if (!bankSelect) return;
      const bankInput = bankSelect.closest("[data-account-editor]")?.querySelector('input[name*=".bank"]');
      if (bankInput && bankSelect.value !== "직접 입력") bankInput.value = "";
      syncConditionalFields();
      if (bankSelect.value === "직접 입력") bankInput?.focus();
    });
    manager?.addEventListener("input", (event) => {
      const personName = event.target.closest('input[name*=".personName"]');
      if (personName) {
        const holder = personName.closest("[data-account-editor]")?.querySelector('input[name*=".name"]');
        if (holder && !holder.dataset.touched) holder.value = personName.value;
      }
      const accountNumber = event.target.closest('input[name*=".number"]');
      if (accountNumber) accountNumber.dataset.rawDigits = accountNumber.value.replace(/\D/g, "");
    });
    manager?.addEventListener("focusout", (event) => {
      const accountNumber = event.target.closest('input[name*=".number"]');
      if (accountNumber) accountNumber.value = formatAccountNumber(accountNumber.value);
    });
    manager?.querySelectorAll('input[name*=".name"]').forEach((field) => {
      field.addEventListener("input", () => { field.dataset.touched = "1"; });
    });
    syncConditionalFields();
  };
  bindAccountManager();
  const noticeManagerElement = form.querySelector("[data-notice-manager]");
  const noticeList = noticeManagerElement?.querySelector("[data-notice-list]");
  const noticeAdd = noticeManagerElement?.querySelector("[data-notice-add]");
  const noticeItems = () => noticeList ? [...noticeList.querySelectorAll("[data-notice-editor]")].map((editor) => ({
    title: editor.querySelector('input[name*=".title"]').value,
    text: editor.querySelector('textarea[name*=".text"]').value,
    hidden: editor.querySelector('input[name*=".hidden"]').checked,
  })) : [];
  const renderNoticeItems = (items) => {
    if (!noticeList || !noticeAdd) return;
    noticeList.innerHTML = items.slice(0, 3).map(noticeEditor).join("");
    noticeAdd.disabled = items.length >= 3;
    autoResizeTextareas(noticeList);
    refreshFrameLists();
  };
  if (noticeManagerElement) {
    noticeManagerElement.addEventListener("click", (event) => {
      const aiButton = event.target.closest("[data-ai-venue-guide]");
      if (aiButton) {
        generateVenueGuide(aiButton);
        return;
      }
      if (event.target.closest("[data-notice-add]")) {
        const items = noticeItems();
        if (items.length < 3) renderNoticeItems([...items, { title: "", text: "" }]);
      }
      const removeButton = event.target.closest("[data-notice-remove]");
      if (!removeButton) return;
      const items = noticeItems();
      const index = [...noticeList.querySelectorAll("[data-notice-editor]")].indexOf(removeButton.closest("[data-notice-editor]"));
      items.splice(index, 1);
      renderNoticeItems(items);
    });
    noticeManagerElement.addEventListener("input", (event) => {
      if (event.target.tagName === "TEXTAREA") autoResizeTextarea(event.target);
      const titleField = event.target.closest('input[name*=".title"]');
      if (titleField) {
        const textField = titleField.closest("[data-notice-editor]")?.querySelector('textarea[name*=".text"]');
        if (textField && !textField.value.trim()) textField.placeholder = noticeContentPlaceholders[titleField.value.trim()] || "";
      }
    });
    noticeManagerElement.addEventListener("focusin", (event) => {
      const field = event.target.closest('textarea[name*=".text"]');
      if (!field || field.value.trim()) return;
      field.dataset.placeholderText = field.placeholder;
      field.placeholder = "";
    });
    noticeManagerElement.addEventListener("focusout", (event) => {
      const field = event.target.closest('textarea[name*=".text"]');
      if (!field || field.value.trim()) return;
      field.placeholder = field.dataset.placeholderText || noticeContentPlaceholders[field.closest("[data-notice-editor]")?.querySelector('input[name*=".title"]')?.value] || "";
    });
    noticeManagerElement.addEventListener("input", refreshFrameLists);
    noticeManagerElement.addEventListener("change", refreshFrameLists);
    noticeManagerElement.addEventListener("change", (event) => {
      const preset = event.target.closest('select[name^="noticePreset."]');
      if (!preset) return;
      const selected = noticePresetValues[preset.value];
      if (!selected) return;
      const editor = preset.closest("[data-notice-editor]");
      editor.querySelector('input[name*=".title"]').value = selected.title;
      editor.querySelector('textarea[name*=".text"]').value = selected.text;
      editor.querySelector('textarea[name*=".text"]').placeholder = noticeContentPlaceholders[selected.title] || "";
      refreshFrameLists();
    });
    renderNoticeItems(noticeItems());
  }
  const transportManagerElement = form.querySelector("[data-transport-manager]");
  const transportList = transportManagerElement?.querySelector("[data-transport-list]");
  const transportItems = () => transportList ? [...transportList.querySelectorAll("[data-transport-editor]")].map((editor) => ({
    title: editor.querySelector('[name*=".title"]').value,
    lines: [...editor.querySelectorAll("[data-transport-line]")].map((line) => ({
      icon: line.querySelector('input').value,
      text: line.querySelector('textarea').value,
    })),
    hidden: editor.querySelector('input[name*=".hidden"]').checked,
  })) : [];
  const renderTransportItems = (items) => {
    if (!transportList) return;
    transportList.innerHTML = items.map(transportEditor).join("");
    autoResizeTextareas(transportList);
    refreshFrameLists();
  };
  // "또는", "가능합니다", "예상" 등 정상 안내 문구까지 숨기던 항목은 제외하고,
  // 실제로 불확실하거나 출처/URL 같은 군더더기일 때만 자동 숨김 처리합니다.
  const uncertainTransportPattern = /확인\s*필요|확인\s*후|참고|문의|공식\s*홈페이지|홈페이지|블로그|blog|naver\.com|https?:\/\/|추정|불확실|미확인|정확하지|전화/i;
  const hasUncertainTransportInfo = (item = {}) => {
    const lines = Array.isArray(item.lines) ? item.lines : adminUtils.normalizeTransportLines({ title: item.title, text: item.text });
    const texts = lines.map((line) => String(line?.text || "").trim()).filter(Boolean);
    if (!texts.length) return true;
    return texts.some((text) => uncertainTransportPattern.test(text));
  };
  autoResizeTextareas(transportList);
  const aiGuideContext = () => ({
    venue: form.elements["wedding.venue"]?.value?.trim() || invitationData.wedding?.venue || "",
    hall: form.elements["wedding.hall"]?.value?.trim() || invitationData.wedding?.hall || "",
    address: form.elements["wedding.address"]?.value?.trim() || invitationData.wedding?.address || "",
    officialUrl: form.elements["wedding.officialUrl"]?.value?.trim() || invitationData.wedding?.officialUrl || "",
    date: form.elements["wedding.date"]?.value || invitationData.wedding?.date || "",
    notices: noticeItems(),
  });
  const generateVenueGuide = () => {
    renderNoticeItems(venueGuideTemplate.map((item) => ({ ...item, hidden: false })));
    alert("주차 안내 / 연회장 이용 안내 / 2부 예식안내 항목을 불러왔습니다.\n각 항목에 내용을 입력해 주세요. 입력하지 않으면 청첩장에서 숨겨집니다.");
  };
  const generateTransportGuide = async (button) => {
    if (!window.AI_DESIGN_SERVICE?.generateTransportGuide) return alert("AI 서비스 스크립트를 불러오지 못했습니다.");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "AI 생성 중...";
    try {
      const result = await window.AI_DESIGN_SERVICE.generateTransportGuide(aiGuideContext());
      const items = (result.items || []).map((item) => {
        const normalized = { title: item.title || "", lines: adminUtils.normalizeTransportLines({ title: item.title, text: item.text }), hidden: Boolean(item.hidden) };
        return { ...normalized, hidden: normalized.hidden || hasUncertainTransportInfo(normalized) };
      });
      if (!items.length) throw new Error("생성된 교통 안내가 없습니다.");
      renderTransportItems(items);
      alert([result.fallbackReason || "", result.caution || "", "교통 안내 초안을 생성했습니다. 확인 후 저장해 주세요."].filter(Boolean).join("\n"));
    } catch (error) {
      alert(`교통 안내를 생성하지 못했습니다.\n${error.message || "AI 설정을 확인해 주세요."}`);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  };
  transportManagerElement?.addEventListener("click", (event) => {
    const aiButton = event.target.closest("[data-ai-transport-guide]");
    if (aiButton) {
      generateTransportGuide(aiButton);
      return;
    }
    const editors = [...transportList.querySelectorAll("[data-transport-editor]")];
    if (event.target.closest("[data-transport-add]")) {
      const defaultType = adminUtils.TRANSPORT_TYPES?.find((type) => type.label === adminUtils.normalizeTransportTitle("")) || adminUtils.TRANSPORT_TYPES?.[0];
      const defaultLines = (defaultType?.lines || ["", ""]).map((icon) => ({ icon, text: "" }));
      renderTransportItems([...transportItems(), { title: "", lines: defaultLines, hidden: false }]);
      return;
    }
    const lineAddButton = event.target.closest("[data-transport-line-add]");
    if (lineAddButton) {
      const items = transportItems();
      const itemIndex = editors.indexOf(lineAddButton.closest("[data-transport-editor]"));
      items[itemIndex].lines.push({ icon: "", text: "" });
      renderTransportItems(items);
      return;
    }
    const lineRemoveButton = event.target.closest("[data-transport-line-remove]");
    if (lineRemoveButton) {
      const editor = lineRemoveButton.closest("[data-transport-editor]");
      const itemIndex = editors.indexOf(editor);
      const lineIndex = [...editor.querySelectorAll("[data-transport-line]")].indexOf(lineRemoveButton.closest("[data-transport-line]"));
      const items = transportItems();
      items[itemIndex].lines.splice(lineIndex, 1);
      renderTransportItems(items);
      return;
    }
    const removeButton = event.target.closest("[data-transport-remove]");
    if (!removeButton) return;
    const items = transportItems();
    items.splice(editors.indexOf(removeButton.closest("[data-transport-editor]")), 1);
    renderTransportItems(items);
  });
  transportManagerElement?.addEventListener("input", (event) => {
    if (event.target.tagName === "TEXTAREA") autoResizeTextarea(event.target);
  });
  transportManagerElement?.addEventListener("input", refreshFrameLists);
  transportManagerElement?.addEventListener("change", refreshFrameLists);
  const updateDisplayDate = (force = false) => {
    const format = form.elements["wedding.displayDateFormat"].value;
    if (format === "custom") return;
    if (!force && form.elements["wedding.displayDateCustom"].value.trim()) return;
    form.elements["wedding.displayDateCustom"].value = weddingDisplayDate(form.elements["wedding.date"].value, format);
    form.elements["wedding.displayDateCustom"].dispatchEvent(new Event("input", { bubbles: true }));
    refreshAutoSummaries();
    updateIntroDesignPreview();
  };
  const syncEditorPublicPeriod = (forceCloseToWedding = false) => syncPublicPeriodFields({
    weddingField: form.elements["wedding.date"],
    openField: form.elements["publicPeriod.openDate"],
    closeField: form.elements["publicPeriod.closeDate"],
    forceCloseToWedding,
  });
  form.elements["wedding.date"].addEventListener("change", () => {
    updateDisplayDate(true);
    syncEditorPublicPeriod(true);
  });
  form.elements["publicPeriod.openDate"]?.addEventListener("change", () => syncEditorPublicPeriod(false));
  form.elements["wedding.displayDateFormat"].addEventListener("change", () => {
    updateDisplayDate(true);
    form.dispatchEvent(new Event("change", { bubbles: true }));
  });
  updateDisplayDate();
  syncEditorPublicPeriod();

  const venueInput = form.elements["wedding.venue"];
  const addressInput = form.elements["wedding.address"];
  const venueStatus = form.querySelector("[data-venue-status]");
  addressInput.readOnly = true;
  addressInput.classList.add("address-field-trigger");
  const launchAddressSearch = (venueHint) => {
    openAddressSearchModal({
      venue: venueHint ?? venueInput.value,
      address: addressInput.value,
      onSelect: ({ venue, address }) => {
        if (venue) venueInput.value = venue;
        if (address) addressInput.value = address;
        const preset = findVenuePreset(venue || venueInput.value);
        if (preset) renderTransportItems(preset.transport);
        venueStatus.textContent = "선택한 주소를 반영했습니다.";
        addressInput.dispatchEvent(new Event("input", { bubbles: true }));
        venueInput.dispatchEvent(new Event("input", { bubbles: true }));
      },
    });
  };
  venueInput.addEventListener("change", () => {
    const preset = findVenuePreset(venueInput.value);
    if (preset) {
      addressInput.value = preset.address;
      renderTransportItems(preset.transport);
      venueStatus.textContent = "등록된 식장을 찾았습니다. 주소가 자동으로 입력되었습니다.";
      addressInput.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (venueInput.value.trim()) {
      venueStatus.textContent = "주소 검색 버튼을 눌러 네이버 지도 또는 직접입력으로 정확한 주소를 반영해 주세요.";
    } else {
      venueStatus.textContent = "";
    }
  });
  addressInput.addEventListener("click", () => launchAddressSearch());
  form.querySelector("[data-address-search]")?.addEventListener("click", () => launchAddressSearch());

  form.querySelectorAll("[data-section-order]").forEach((editor) => {
    const updateSectionOrder = () => {
      editor.querySelector('input[type="hidden"]').value = [...editor.querySelectorAll(".section-order-item")]
        .filter((item) => item.querySelector('input[type="checkbox"]').checked)
        .map((item) => item.dataset.sectionId)
        .join("\n");
    };
    const list = editor.querySelector(".section-order-list");
    let draggedItem = null;
    let activePointerId = null;
    const itemAfterPointer = (y) => [...list.querySelectorAll(".section-order-item:not(.is-dragging)")].reduce((closest, item) => {
      const box = item.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      return offset < 0 && offset > closest.offset ? { offset, item } : closest;
    }, { offset: Number.NEGATIVE_INFINITY, item: null }).item;
    const endDrag = (event) => {
      if (!draggedItem || (event && event.pointerId !== activePointerId)) return;
      draggedItem.classList.remove("is-dragging");
      draggedItem = null;
      activePointerId = null;
      updateSectionOrder();
    };
    list?.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".section-drag-handle");
      if (!handle) return;
      event.preventDefault();
      draggedItem = handle.closest(".section-order-item");
      if (!draggedItem) return;
      activePointerId = event.pointerId;
      handle.setPointerCapture?.(activePointerId);
      draggedItem.classList.add("is-dragging");
    });
    list?.addEventListener("pointermove", (event) => {
      if (!draggedItem || event.pointerId !== activePointerId) return;
      event.preventDefault();
      const after = itemAfterPointer(event.clientY);
      if (after) list.insertBefore(draggedItem, after);
      else list.appendChild(draggedItem);
    });
    list?.addEventListener("pointerup", endDrag);
    list?.addEventListener("pointercancel", endDrag);
    editor.addEventListener("change", updateSectionOrder);
    editor.addEventListener("click", (event) => {
      const reset = event.target.closest("[data-section-reset]");
      if (reset) {
        const defaults = defaultSectionSettings[reset.dataset.sectionReset] || validSectionIds;
        const list = editor.querySelector(".section-order-list");
        const items = new Map([...editor.querySelectorAll(".section-order-item")].map((item) => [item.dataset.sectionId, item]));
        [...defaults, ...defaultSectionOrder.filter((id) => !defaults.includes(id))].forEach((id) => {
          const item = items.get(id);
          if (!item) return;
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.checked = defaults.includes(id);
          list.appendChild(item);
        });
        updateSectionOrder();
        return;
      }
      const copyFrom = event.target.closest("[data-section-copy-from]");
      if (copyFrom) {
        const source = form.querySelector(`[data-section-order-mode="${copyFrom.dataset.sectionCopyFrom}"]`);
        if (!source) return;
        const list = editor.querySelector(".section-order-list");
        const items = new Map([...editor.querySelectorAll(".section-order-item")].map((item) => [item.dataset.sectionId, item]));
        source.querySelectorAll(".section-order-item").forEach((sourceItem) => {
          const item = items.get(sourceItem.dataset.sectionId);
          if (!item) return;
          item.querySelector('input[type="checkbox"]').checked = sourceItem.querySelector('input[type="checkbox"]').checked;
          list.appendChild(item);
        });
        updateSectionOrder();
        return;
      }
      const button = event.target.closest("[data-section-move]");
      if (!button) return;
      const item = button.closest(".section-order-item");
      const sibling = Number(button.dataset.sectionMove) < 0 ? item.previousElementSibling : item.nextElementSibling;
      if (!sibling) return;
      if (Number(button.dataset.sectionMove) < 0) sibling.before(item);
      else sibling.after(item);
      updateSectionOrder();
    });
    updateSectionOrder();
  });
  form.querySelectorAll("[data-image-target]").forEach((fileInput) => {
    fileInput.addEventListener("change", async () => {
      let file = fileInput.files[0];
      if (!file) return;
      let originalUrl = "";
      if (["couple.groom.photo", "couple.bride.photo"].includes(fileInput.dataset.imageTarget)) {
        try {
          originalUrl = await window.RSVP_STORAGE.uploadInvitationImage(file, `${fileInput.dataset.imageTarget.replace(/\./g, "-")}-original`);
          const cropResult = await cropProfileImage(file);
          if (!cropResult) return;
          file = cropResult.file;
          if (form.elements[`${fileInput.dataset.imageTarget}Crop`]) {
            form.elements[`${fileInput.dataset.imageTarget}Crop`].value = JSON.stringify(cropResult.settings);
          }
        } catch (error) {
          alert(`대표사진 자르기 화면을 열지 못했습니다.\n${error.message || "다른 이미지 파일로 다시 시도해 주세요."}`);
          return;
        }
      }
      const label = fileInput.closest(".image-upload");
      label.firstChild.textContent = "업로드 중...";
      try {
        const url = await window.RSVP_STORAGE.uploadInvitationImage(file, fileInput.dataset.imageTarget.replace(/\./g, "-"));
        form.elements[fileInput.dataset.imageTarget].value = url;
        if (originalUrl && form.elements[`${fileInput.dataset.imageTarget}Original`]) {
          form.elements[`${fileInput.dataset.imageTarget}Original`].value = originalUrl;
        }
        const preview = form.querySelector(`[data-image-preview="${fileInput.dataset.imageTarget}"]`);
        preview.innerHTML = `<img src="${escapeAdminHtml(adminMediaUrl(url))}" alt="업로드한 사진 미리보기">`;
        refreshFrameMedia(fileInput.dataset.imageTarget, adminMediaUrl(url));
        label.firstChild.textContent = "업로드 완료";
      } catch (error) {
        label.firstChild.textContent = "업로드 실패";
        alert(`사진을 업로드하지 못했습니다.\n${error.message || "파일 크기와 Storage 정책을 확인해 주세요."}`);
      }
    });
  });
  form.querySelectorAll('.image-field-profile [data-image-preview]').forEach((preview) => {
    preview.addEventListener("click", () => {
      const target = preview.dataset.imagePreview;
      if (!form.elements[target]?.value) return;
      const cropButton = form.querySelector(`[data-image-crop-edit="${target}"]`);
      if (cropButton) cropButton.click();
      else openProfileCropEditor(target, preview);
    });
  });
  form.querySelectorAll("[data-image-crop-edit]").forEach((button) => {
    button.addEventListener("click", () => openProfileCropEditor(button.dataset.imageCropEdit, button));
  });
  const openProfileCropEditor = async (target, trigger) => {
      const originalUrl = form.elements[`${target}Original`]?.value || "";
      const currentUrl = adminMediaUrl(originalUrl || form.elements[target].value);
      if (!currentUrl) return;
      if (trigger?.tagName === "BUTTON") {
        trigger.disabled = true;
        trigger.textContent = "불러오는 중...";
      }
      try {
        const response = await fetch(currentUrl);
        if (!response.ok) throw new Error("등록된 사진을 불러오지 못했습니다.");
        const original = await response.blob();
        const savedSettings = parseCropSettings(form.elements[`${target}Crop`]?.value || "");
        const cropResult = await cropProfileImage(new File([original], "profile-image", { type: original.type || "image/jpeg" }), {
          initialZoom: savedSettings.zoom,
          initialX: savedSettings.x,
          initialY: savedSettings.y,
        });
        if (!cropResult) return;
        const file = cropResult.file;
        if (trigger?.tagName === "BUTTON") trigger.textContent = "업로드 중...";
        const url = await window.RSVP_STORAGE.uploadInvitationImage(file, target.replace(/\./g, "-"));
        form.elements[target].value = url;
        if (!originalUrl && form.elements[`${target}Original`]) form.elements[`${target}Original`].value = currentUrl;
        if (form.elements[`${target}Crop`]) form.elements[`${target}Crop`].value = JSON.stringify(cropResult.settings);
        form.querySelector(`[data-image-preview="${target}"]`).innerHTML = `<img src="${escapeAdminHtml(adminMediaUrl(url))}" alt="업로드한 사진 미리보기">`;
        refreshFrameMedia(target, adminMediaUrl(url));
      } catch (error) {
        alert(`대표사진 영역을 적용하지 못했습니다.\n${error.message || "잠시 후 다시 시도해 주세요."}`);
      } finally {
        if (trigger?.tagName === "BUTTON") {
          trigger.disabled = false;
          trigger.textContent = "영역 맞추기";
        }
      }
  };
  form.querySelectorAll("[data-image-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.imageRemove;
      form.elements[target].value = "";
      if (form.elements[`${target}Original`]) form.elements[`${target}Original`].value = "";
      if (form.elements[`${target}Crop`]) form.elements[`${target}Crop`].value = "";
      form.querySelector(`[data-image-preview="${target}"]`).innerHTML = "<span>등록된 사진이 없습니다.</span>";
      refreshFrameMedia(target, "");
    });
  });
  const hasGalleryFields = Boolean(form.elements["gallery.0"]);
  const galleryPairs = () => hasGalleryFields ? Array.from({ length: GALLERY_MAX }, (_, index) => ({
    image: form.elements[`gallery.${index}`].value,
    thumb: form.elements[`galleryThumb.${index}`]?.value || "",
  })).filter((pair) => pair.image) : [];
  const galleryValues = () => galleryPairs().map((pair) => pair.image);
  const galleryThumbValues = () => galleryPairs().map((pair) => pair.thumb);
  const updateGallery = (images, thumbs = []) => {
    const slots = Array.from({ length: GALLERY_MAX }, (_, index) => images[index] || "");
    const thumbSlots = Array.from({ length: GALLERY_MAX }, (_, index) => thumbs[index] || "");
    invitationData.gallery = slots;
    invitationData.galleryThumbs = thumbSlots;
    slots.forEach((image, index) => {
      form.elements[`gallery.${index}`].value = image;
      form.elements[`galleryThumb.${index}`].value = thumbSlots[index];
    });
    form.querySelector("[data-gallery-editor-preview]").innerHTML = galleryManagerPreview(slots, thumbSlots);
    refreshFrameGallery();
  };
  const galleryStatus = form.querySelector("[data-gallery-status]");
  const galleryUpload = form.querySelector("[data-gallery-upload]");
  const galleryClear = form.querySelector("[data-gallery-clear]");
  const galleryPreview = form.querySelector("[data-gallery-editor-preview]");
  galleryUpload?.addEventListener("change", async (event) => {
    const files = [...event.currentTarget.files];
    if (!files.length) return;
    if (files.length > GALLERY_MAX) {
      alert(`갤러리 사진은 최대 ${GALLERY_MAX}장까지 선택할 수 있습니다.`);
      event.currentTarget.value = "";
      return;
    }
    const currentImages = galleryValues();
    const currentThumbs = galleryThumbValues();
    const freeSlots = Math.max(0, GALLERY_MAX - currentImages.length);
    if (currentImages.length && !freeSlots) {
      alert(`갤러리 사진이 이미 ${GALLERY_MAX}장입니다. 사진별 변경 버튼을 이용하거나 일부 사진을 삭제해 주세요.`);
      event.currentTarget.value = "";
      return;
    }
    const uploadFiles = currentImages.length ? files.slice(0, freeSlots) : files;
    if (currentImages.length && uploadFiles.length < files.length) alert(`남은 ${freeSlots}칸에 맞춰 ${uploadFiles.length}장만 추가합니다.`);
    galleryStatus.textContent = `${uploadFiles.length}장의 사진을 업로드하고 있습니다. 창을 닫지 말아 주세요.`;
    try {
      const uploaded = [];
      for (let index = 0; index < uploadFiles.length; index += 1) {
        galleryStatus.textContent = `${uploadFiles.length}장 중 ${index + 1}장을 업로드하고 있습니다.`;
        uploaded.push(await window.RSVP_STORAGE.uploadInvitationImage(uploadFiles[index], `gallery-${currentImages.length + index + 1}`));
      }
      updateGallery([...currentImages, ...uploaded.map((item) => item.path)], [...currentThumbs, ...uploaded.map((item) => item.thumbPath)]);
      galleryStatus.textContent = `${uploaded.length}장의 사진을 추가했습니다. 아래 저장 버튼을 눌러 완료해 주세요.`;
    } catch (error) {
      galleryStatus.textContent = "갤러리 업로드를 완료하지 못했습니다.";
      alert(`사진을 업로드하지 못했습니다.\n${error.message || "파일 크기와 Storage 정책을 확인해 주세요."}`);
    }
    event.currentTarget.value = "";
  });
  galleryClear?.addEventListener("click", () => {
    if (galleryValues().length && !confirm("갤러리 사진을 모두 비울까요?")) return;
    updateGallery([]);
    galleryStatus.textContent = "갤러리를 비웠습니다. 아래 저장 버튼을 눌러 완료해 주세요.";
  });
  galleryPreview?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gallery-remove]");
    if (!button) return;
    const images = galleryValues();
    const thumbs = galleryThumbValues();
    images.splice(Number(button.dataset.galleryRemove), 1);
    thumbs.splice(Number(button.dataset.galleryRemove), 1);
    updateGallery(images, thumbs);
    galleryStatus.textContent = "사진을 삭제했습니다. 아래 저장 버튼을 눌러 완료해 주세요.";
  });
  galleryPreview?.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-gallery-replace]");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    const index = Number(input.dataset.galleryReplace);
    galleryStatus.textContent = `${index + 1}번째 사진을 변경하고 있습니다.`;
    try {
      const result = await window.RSVP_STORAGE.uploadInvitationImage(file, `gallery-${index + 1}`);
      const images = galleryValues();
      const thumbs = galleryThumbValues();
      images[index] = result.path;
      thumbs[index] = result.thumbPath;
      updateGallery(images, thumbs);
      galleryStatus.textContent = `${index + 1}번째 사진을 변경했습니다. 아래 저장 버튼을 눌러 완료해 주세요.`;
    } catch (error) {
      galleryStatus.textContent = "사진 변경을 완료하지 못했습니다.";
      alert(`사진을 변경하지 못했습니다.\n${error.message || "파일 크기와 Storage 정책을 확인해 주세요."}`);
    }
    input.value = "";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const buttons = [...document.querySelectorAll('#editor-save, [form="invitation-editor"]')];
    buttons.forEach((button) => {
      button.dataset.defaultLabel = button.textContent;
      button.disabled = true;
      button.textContent = "저장 중...";
    });
    try {
      const editorView = document.querySelector(".admin-editor-view");
      const keepFocus = ["copy", "share", "gallery", "sections"].find((name) => editorView?.classList.contains(`view-${name}`)) || "";
      syncEditorPublicPeriod();
      invitationData = editorData(form);
      applyAppearance(invitationData.appearance);
      await window.RSVP_STORAGE.saveInvitationData(invitationData);
      editorBaseline = null;
      const previewWindow = copyEditor.querySelector("[data-copy-editor-frame]")?.contentWindow;
      const pageY = window.scrollY;
      pendingPreviewScroll = previewWindow ? { y: previewWindow.scrollY } : null;
      renderEditor("저장했습니다. 현재 편집 화면에 계속 머무릅니다.", keepFocus);
      requestAnimationFrame(() => window.scrollTo({ top: pageY, behavior: "instant" }));
    } catch (error) {
      buttons.forEach((button) => {
        button.disabled = false;
        button.textContent = button.dataset.defaultLabel;
      });
      notifySaveFailure(error, "저장");
    }
  });
  const floatingSave = document.querySelector('.admin-floating-save[form="invitation-editor"]');
  const bottomSave = document.querySelector("#editor-save");
  if (floatingSave && bottomSave && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      floatingSave.classList.toggle("is-hidden", entry.isIntersecting);
    }, { threshold: 0.2 }).observe(bottomSave);
  }
}

function showAdminWelcomeOverlay(force = false) {
  const slug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || "local";
  const key = `admin-welcome-shown:${slug}`;
  if (!force && sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  const settings = { ...defaultWelcomeOverlay, ...(invitationData.adminDefaults?.welcomeOverlay || {}) };
  const palette = themeWelcomePalette(invitationData);
  const overlay = document.createElement("div");
  overlay.className = "admin-welcome-intro";
  overlay.innerHTML = `
    <div class="admin-welcome-card">
      <span class="section-label">${escapeAdminHtml(settings.eyebrow || defaultWelcomeOverlay.eyebrow)}</span>
      <p data-admin-welcome-text></p>
    </div>`;
  const opacity = Math.max(0, Math.min(1, Number(settings.overlayOpacity ?? defaultWelcomeOverlay.overlayOpacity) / 100));
  const shadowOpacity = Math.max(0, Math.min(0.7, Number(settings.shadowOpacity ?? defaultWelcomeOverlay.shadowOpacity) / 100));
  const shadowEnabled = settings.shadowEnabled !== false;
  const shadowColor = palette.shadowColor;
  const shadowLayer = shadowEnabled
    ? `radial-gradient(circle at 50% 25%, ${hexToRgba(shadowColor, shadowOpacity)}, transparent 42%)`
    : "linear-gradient(transparent, transparent)";
  overlay.style.background = `${shadowLayer}, ${hexToRgba(palette.backgroundColor, opacity)}`;
  overlay.style.setProperty("--admin-welcome-card-bg", hexToRgba(palette.cardColor, Math.max(0, Math.min(1, Number(settings.cardOpacity ?? defaultWelcomeOverlay.cardOpacity) / 100))));
  overlay.style.setProperty("--admin-welcome-text", palette.textColor);
  overlay.style.setProperty("--admin-welcome-size", `${Number(settings.textSize) || 30}px`);
  overlay.style.setProperty("--admin-welcome-border", `${Number(settings.borderWidth ?? defaultWelcomeOverlay.borderWidth) || 0}px solid ${palette.borderColor}`);
  overlay.style.setProperty("--admin-welcome-radius", `${Number(settings.borderRadius ?? defaultWelcomeOverlay.borderRadius) || 0}px`);
  overlay.style.setProperty("--admin-welcome-shadow", shadowEnabled
    ? `0 28px 80px ${hexToRgba(shadowColor, shadowOpacity)}`
    : "none");
  document.body.classList.add("admin-welcome-locked");
  document.body.append(overlay);
  const target = overlay.querySelector("[data-admin-welcome-text]");
  const text = settings.text || defaultWelcomeOverlay.text;
  let index = 0;
  let isClosing = false;
  const closeOverlay = () => {
    if (isClosing) return;
    isClosing = true;
    overlay.classList.add("is-leaving");
    window.setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("admin-welcome-locked");
    }, 420);
  };
  overlay.addEventListener("click", closeOverlay, { once: true });
  overlay.addEventListener("touchend", closeOverlay, { once: true, passive: true });
  window.setTimeout(closeOverlay, 5200);
  const typeNext = () => {
    if (isClosing) return;
    target.textContent = text.slice(0, index);
    index += 1;
    if (index <= text.length) {
      window.setTimeout(typeNext, text[index - 2] === "\n" ? 170 : 52);
      return;
    }
    window.setTimeout(closeOverlay, 900);
  };
  window.setTimeout(typeNext, 240);
}

function hexToRgba(color = "#eff7fa", alpha = 0.94) {
  const value = String(color || "").trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) return value;
  const number = Number.parseInt(match[1], 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

async function login(event) {
  event.preventDefault();
  let client = getAdminSupabaseClient();
  if (!client && window.ADMIN_SUPABASE_READY) {
    await window.ADMIN_SUPABASE_READY;
    client = getAdminSupabaseClient();
  }
  if (!client) return renderLogin("로그인 서버 연결이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  const form = new FormData(event.currentTarget);
  const loginId = String(form.get("loginId") || "").trim();
  const email = loginInputToAuthEmail(loginId);
  if (!email) return renderLogin("로그인 ID를 입력해 주세요.");
  if (form.get("rememberEmail") === "on") localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, email);
  else localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
  let { error } = await client.auth.signInWithPassword({
    email,
    password: form.get("password"),
  });
  // 가입 때 아이디 칸에 이메일을 넣으면 '@'가 빠진 아이디로 저장됨(예: name@gmail.com → namegmail.com@admin.local)
  const idFromEmail = loginIdToAuthEmail(loginId);
  if (error && email.includes("@") && idFromEmail && idFromEmail !== email) {
    ({ error } = await client.auth.signInWithPassword({ email: idFromEmail, password: form.get("password") }));
  }
  if (error) {
    const reason = String(error.code || error.message || "").toLowerCase();
    if (/rate|too many|429/.test(reason) || error.status === 429) return renderLogin("로그인 시도가 너무 많습니다. 몇 분 뒤에 다시 시도해 주세요.");
    if (/not.?confirmed/.test(reason)) return renderLogin("이메일 인증이 완료되지 않은 계정입니다. 사이트 관리자에게 문의해 주세요.");
    if (/fetch|network/.test(reason)) return renderLogin("네트워크 연결이 불안정합니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    return renderLogin("가입되지 않은 ID이거나 ID/비밀번호가 일치하지 않습니다. 비밀번호는 대·소문자를 구분합니다. 처음 이용하신다면 회원가입을 진행해 주세요.");
  }
  try {
    currentInvitationSite = await window.RSVP_STORAGE.getCurrentInvitationSite();
    if (!currentInvitationSite?.slug) return renderLogin("가입이 완료되지 않은 계정입니다. 회원가입으로 다시 진행해 주세요.");
    if (currentInvitationSite.disabled) return renderLogin("비활성화된 일반관리자입니다. 사이트 관리자에게 문의해 주세요.");
  } catch (siteError) {
    return renderLogin(`계정 전용 청첩장을 준비하지 못했습니다. ${siteError.message || "Supabase 설정을 확인해 주세요."}`);
  }
  await loadInvitationData();
  renderAdminView(localStorage.getItem(GENERAL_ADMIN_VIEW_KEY) || "editor");
  showAdminWelcomeOverlay();
}

function bindPasswordRecoveryListener(client) {
  if (!client || passwordRecoveryListenerBound) return;
  passwordRecoveryListenerBound = true;
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") renderPasswordReset();
  });
}

async function signup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const status = event.currentTarget.querySelector("[data-signup-status]") || document.createElement("p");
  if (!status.dataset.signupStatus) {
    status.dataset.signupStatus = "1";
    status.className = "admin-message signup-status";
    event.currentTarget.append(status);
  }
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  const defaultLabel = submitButton?.textContent || "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "만드는 중...";
  }
  status.textContent = "계정을 만들고 전용 청첩장을 준비하고 있습니다.";
  try {
    const loginId = normalizeLoginId(form.get("loginId"));
    const email = loginIdToAuthEmail(loginId);
    if (!email) throw new Error("로그인 ID를 입력해 주세요.");
    const result = await window.RSVP_STORAGE.signUpInvitationAdmin({
      email,
      loginId,
      password: form.get("password"),
      agreeTerms: form.get("agreeTerms") === "on",
      agreePrivacy: form.get("agreePrivacy") === "on",
      agreeMarketing: form.get("agreeMarketing") === "on",
    });
    if (result.needsConfirmation) {
      const message = "현재 Supabase 이메일 인증이 켜져 있어 ID 가입 방식으로 자동 로그인할 수 없습니다. Supabase Auth 설정에서 이메일 인증을 꺼 주세요.";
      alert(message);
      renderLogin(message);
      return;
    }
    localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, email);
    renderBasicInfoOnboarding("회원가입이 완료되었습니다. 기본정보를 입력하면 전용 청첩장과 일반관리자 페이지가 생성됩니다.");
  } catch (error) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = defaultLabel;
    }
    const message = `가입을 완료하지 못했습니다. ${error.message || "입력값과 Supabase Auth 설정을 확인해 주세요."}`;
    status.textContent = message;
    alert(message);
  }
}

async function loadInvitationData() {
  if (getAdminSupabaseClient()) {
    currentInvitationSite = await window.RSVP_STORAGE.getCurrentInvitationSite();
  }
  invitationData = await window.RSVP_STORAGE.loadInvitationData(window.INVITATION_DATA);
  applyAppearance(invitationData.appearance);
}

async function renderResponses() {
  rememberAdminView("responses");
  const client = getAdminSupabaseClient();
  if (!client) {
    adminApp.innerHTML = `${adminHeader("responses")}${contentBackBar("참석 현황")}${responsesView(window.RSVP_STORAGE.readLocalResponses(), true)}`;
    bindAdminNavigation();
    return;
  }
  let query = client
    .from("attendance_responses")
    .select("*")
    .order("created_at", { ascending: false });
  query = query.eq("invitation_id", window.RSVP_STORAGE.getActiveInvitationSlug());
  const { data, error } = await query;
  if (error) return renderLogin("응답을 불러오지 못했습니다. 관리자 권한 설정을 확인해 주세요.");
  adminApp.innerHTML = `${adminHeader("responses")}${contentBackBar("참석 현황")}${responsesView(data)}`;
  bindAdminNavigation();
}

async function fetchMusicLibrary() {
  try {
    const response = await fetch("/api/music-list", { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.files) ? payload.files : [];
  } catch {
    return [];
  }
}

// 배경음악: 편집 탭의 하위 화면. 칸들은 편집 폼 안에 있어 오른쪽 아래 저장으로 다른 편집과 함께 저장됨
function musicPanelMarkup() {
  const music = invitationData.music || {};
  const enabled = music.enabled !== false;
  const currentSrc = String(music.src || "").trim();
  const volume = Number.isFinite(Number(music.volume)) ? Number(music.volume) : 0.25;
  return `<section class="copy-editor-section copy-editor-music" data-music-panel>
      <input type="hidden" name="music.enabled" value="false">
      <label class="music-switch-row">
        <span>배경음악 사용</span>
        <input type="checkbox" name="music.enabled" value="true" ${enabled ? "checked" : ""}>
        <i aria-hidden="true"></i>
      </label>
      <div class="field">
        <span>음악</span>
        <div class="music-choice-row">
          <select data-music-choice aria-label="음악 선택"><option value="${escapeAdminHtml(currentSrc)}">목록을 불러오는 중…</option></select>
          <button class="music-preview-btn" type="button" data-music-preview aria-label="미리듣기" title="미리듣기">▶</button>
        </div>
      </div>
      <p class="admin-message micro-help" data-music-empty hidden>음악 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
      <input type="hidden" name="music.src" value="${escapeAdminHtml(currentSrc)}" data-music-src-value>
      <label class="field">
        <span>기본 음량 (<output data-music-volume-output>${volume.toFixed(2)}</output>)</span>
        <input type="range" name="music.volume" data-music-volume min="0" max="1" step="0.05" value="${volume}">
      </label>
      <audio data-music-audio preload="none"></audio>
      <p class="admin-message micro-help" data-music-status></p>
    </section>`;
}

function bindMusicPanel() {
  const panel = adminApp.querySelector("[data-music-panel]");
  if (!panel) return;
  const form = panel.closest("form");
  const choice = panel.querySelector("[data-music-choice]");
  const srcValue = panel.querySelector("[data-music-src-value]");
  const volumeInput = panel.querySelector("[data-music-volume]");
  const volumeOutput = panel.querySelector("[data-music-volume-output]");
  const audio = panel.querySelector("[data-music-audio]");
  const previewButton = panel.querySelector("[data-music-preview]");
  const status = panel.querySelector("[data-music-status]");
  const currentSrc = srcValue.value.trim();

  const resolveSrc = () => choice.value;
  const syncSrc = () => { srcValue.value = resolveSrc(); };
  fetchMusicLibrary().then((files) => {
    if (!panel.isConnected) return;
    const inLibrary = files.some((file) => file.src === currentSrc);
    // 목록에 없는 곡이 저장돼 있으면 그 곡도 보여 줘서 저장할 때 사라지지 않게 함
    const savedOnly = currentSrc && !inLibrary ? [`<option value="${escapeAdminHtml(currentSrc)}" selected>${escapeAdminHtml(currentSrc.split("/").pop())}</option>`] : [];
    choice.innerHTML = [
      `<option value="">사용 안 함 (선택 없음)</option>`,
      ...files.map((file) => `<option value="${escapeAdminHtml(file.src)}" ${file.src === currentSrc ? "selected" : ""}>${escapeAdminHtml(file.name)}</option>`),
      ...savedOnly,
    ].join("");
    panel.querySelector("[data-music-empty]").hidden = files.length > 0;
  });

  const playPreview = (src) => {
    audio.src = adminMediaUrl(src);
    audio.dataset.src = src;
    audio.volume = Math.max(0, Math.min(1, Number(volumeInput.value) || 0));
    audio.play()
      .then(() => { previewButton.textContent = "❚❚"; previewButton.setAttribute("aria-label", "미리듣기 멈춤"); status.textContent = ""; })
      .catch((error) => { status.textContent = `미리듣기를 재생하지 못했습니다. (${error?.message || "파일 경로 확인"})`; });
  };
  // 미리듣기 중에 곡을 바꾸면 바로 새 곡으로 이어서 들려줌
  const switchPreviewIfPlaying = () => {
    if (audio.paused) return;
    const src = resolveSrc();
    if (!src) {
      audio.pause();
      return;
    }
    if (audio.dataset.src !== src) playPreview(src);
  };
  choice.addEventListener("change", () => {
    syncSrc();
    switchPreviewIfPlaying();
  });
  volumeInput.addEventListener("input", () => {
    volumeOutput.textContent = Number(volumeInput.value).toFixed(2);
    audio.volume = Math.max(0, Math.min(1, Number(volumeInput.value) || 0));
  });
  previewButton.addEventListener("click", () => {
    const src = resolveSrc();
    if (!src) {
      status.textContent = "재생할 음악을 골라 주세요.";
      return;
    }
    if (!audio.paused && audio.dataset.src === src) {
      audio.pause();
      return;
    }
    playPreview(src);
  });
  const resetPreviewButton = () => { previewButton.textContent = "▶"; previewButton.setAttribute("aria-label", "미리듣기"); };
  audio.addEventListener("ended", resetPreviewButton);
  audio.addEventListener("pause", resetPreviewButton);
  // 저장하거나 다른 하위 탭으로 가면 미리듣기는 멈춤
  form?.addEventListener("submit", () => audio.pause());
  panel.addEventListener("editor-mode", () => { if (copyEditorMode !== "music") audio.pause(); });
}

function stickerSectionLabel(id) {
  if (id === "ending") return "마지막 인사";
  return window.WEDDING_SECTIONS?.labels?.[id] || id;
}

function stickerControlsMarkup(item) {
  const stickers = window.WEDDING_STICKERS;
  if (!item) return '<p class="sticker-empty">붙인 스티커를 누르면 색상·크기·기울기를 바꿀 수 있어요.</p>';
  const sticker = stickers.list.find((entry) => entry.id === item.sticker);
  const isCustomColor = item.color && !stickers.colors.some((entry) => entry.id === item.color);
  return `<div class="sticker-controls-head">
      <span class="sticker-row-preview" style="color:${escapeAdminHtml(item.color || "var(--accent-dark)")};transform:rotate(${item.rotate}deg)">${sticker?.svg || ""}</span>
      <div><strong>${escapeAdminHtml(sticker?.name || "")}</strong><small>${escapeAdminHtml(stickerSectionLabel(item.section))} 섹션</small></div>
      <button class="btn sticker-row-remove" type="button" data-sticker-remove>삭제</button>
    </div>
    <div class="sticker-color-field"><span>색상</span><div class="sticker-swatches">
      ${stickers.colors.map((entry) => `<button type="button" class="sticker-swatch ${entry.id === item.color ? "is-active" : ""}" data-sticker-color="${entry.id}" style="--swatch:${entry.id || "var(--accent-dark)"}" title="${escapeAdminHtml(entry.label)}" aria-label="${escapeAdminHtml(entry.label)}">${entry.id ? "" : "<small>테마</small>"}</button>`).join("")}
      <label class="sticker-swatch sticker-swatch-custom ${isCustomColor ? "is-active" : ""}" style="--swatch:${escapeAdminHtml(item.color || "transparent")}" title="직접 고르기"><input type="color" data-sticker-field="color" value="${escapeAdminHtml(item.color || "#7b1f24")}" aria-label="색상 직접 고르기"></label>
    </div></div>
    <div class="sticker-row-fields">
      <label class="field"><span>크기 (<output>${item.size}px</output>)</span><input type="range" data-sticker-field="size" min="28" max="240" step="4" value="${item.size}"></label>
      <label class="field"><span>기울기 (<output>${item.rotate}°</output>)</span><input type="range" data-sticker-field="rotate" min="-180" max="180" step="1" value="${item.rotate}"></label>
    </div>`;
}

function stickerSheetMarkup() {
  const stickers = window.WEDDING_STICKERS;
  return `<section class="sticker-sheet" aria-label="스티커 편집 도구" data-sticker-sheet>
      <div class="sticker-sheet-head">
        <strong>손그림 스티커</strong>
        <p class="sticker-status" data-sticker-status></p>
        <button class="btn btn-primary sticker-save" type="submit" form="invitation-editor">저장</button>
      </div>
      <div class="sticker-palette">
        ${stickers.list.map((entry) => `<button type="button" data-sticker-add="${entry.id}" title="${escapeAdminHtml(entry.name)}" aria-label="${escapeAdminHtml(entry.name)} 붙이기"><span>${entry.svg}</span></button>`).join("")}
      </div>
      <div class="sticker-placed">
        <span class="sticker-placed-label">붙인 스티커</span>
        <div class="sticker-chips" data-sticker-chips></div>
      </div>
      <div class="sticker-controls" data-sticker-controls></div>
    </section>`;
}

// 스티커는 '청첩장 화면'과 같은 미리보기 위에서 편집함.
// 바꾼 내용은 invitationData.stickers 에 바로 담기고, 다른 편집과 같은 저장 버튼(같은 폼)으로 함께 저장됨
function bindStickerTools() {
  const sheet = adminApp.querySelector("[data-sticker-sheet]");
  const frame = adminApp.querySelector("[data-copy-editor-frame]");
  if (!sheet || !frame) return;
  const stickers = window.WEDDING_STICKERS;
  invitationData.stickers = (Array.isArray(invitationData.stickers) ? invitationData.stickers : []).map(stickers.normalize);
  const draft = invitationData.stickers;
  let selectedId = "";
  const chips = sheet.querySelector("[data-sticker-chips]");
  const controls = sheet.querySelector("[data-sticker-controls]");
  const status = sheet.querySelector("[data-sticker-status]");
  const selected = () => draft.find((item) => item.id === selectedId);
  const markDirty = () => { status.textContent = "저장을 눌러야 청첩장에 반영돼요."; };
  const postFrame = (message) => frame.contentWindow?.postMessage({ source: "wedding-sticker-admin", ...message }, location.origin);
  const syncFrame = () => postFrame({ type: "set", stickers: draft, selectedId });
  const syncMode = () => {
    const active = copyEditorMode === "stickers";
    postFrame({ type: "mode", active });
    if (!active) {
      selectedId = "";
      sheet.querySelectorAll("[data-sticker-add].is-armed").forEach((button) => button.classList.remove("is-armed"));
      paintChips();
      paintControls();
    }
  };
  const paintChips = () => {
    chips.closest(".sticker-placed").hidden = !draft.length;
    chips.innerHTML = `<button type="button" class="sticker-chip sticker-chip-add" data-sticker-select="" aria-label="스티커 더 붙이기">＋</button>` + draft.map((item) => {
      const sticker = stickers.list.find((entry) => entry.id === item.sticker);
      return `<button type="button" class="sticker-chip ${item.id === selectedId ? "is-active" : ""}" data-sticker-select="${item.id}" style="color:${escapeAdminHtml(item.color || "var(--accent-dark)")}">${sticker?.svg || ""}<small>${escapeAdminHtml(stickerSectionLabel(item.section))}</small></button>`;
    }).join("");
  };
  const paintControls = () => {
    controls.innerHTML = stickerControlsMarkup(selected());
    // 스티커를 고르면 손그림 목록 대신 그 스티커의 색·크기·기울기를 보여 줌(＋로 다시 목록)
    sheet.classList.toggle("has-selection", Boolean(selected()));
  };
  const select = (id, { focus = false } = {}) => {
    selectedId = id;
    paintChips();
    paintControls();
    syncFrame();
    if (focus && id) postFrame({ type: "focus", id });
  };
  const updateSelected = (patch, { repaint = true } = {}) => {
    const index = draft.findIndex((item) => item.id === selectedId);
    if (index < 0) return;
    draft[index] = stickers.normalize({ ...draft[index], ...patch });
    markDirty();
    syncFrame();
    if (repaint) { paintChips(); paintControls(); }
    return draft[index];
  };
  paintChips();
  paintControls();

  const onMessage = (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.source !== "wedding-sticker-editor") return;
    const message = event.data;
    if (message.type === "ready") {
      syncFrame();
      syncMode();
      // mode(스티커 탭이면 맨 위로) 다음에 보내야 저장 전 위치로 돌아감
      if (pendingPreviewScroll) {
        postFrame({ type: "scroll", y: pendingPreviewScroll.y });
        pendingPreviewScroll = null;
      }
    } else if (message.type === "select") select(message.id);
    else if (message.type === "moved") {
      selectedId = message.id;
      updateSelected({ section: message.section, x: message.x, y: message.y, top: message.top });
    } else if (message.type === "transformed") {
      selectedId = message.id;
      updateSelected({ size: message.size, rotate: message.rotate });
    } else if (message.type === "placed") {
      sheet.querySelectorAll("[data-sticker-add].is-armed").forEach((button) => button.classList.remove("is-armed"));
      const item = stickers.normalize(message.item);
      draft.push(item);
      markDirty();
      select(item.id);
    }
  };
  window.addEventListener("message", onMessage);
  // Drop the listener once this page is replaced by another admin view.
  const observer = new MutationObserver(() => {
    if (adminApp.contains(sheet)) return;
    window.removeEventListener("message", onMessage);
    observer.disconnect();
  });
  observer.observe(adminApp, { childList: true });
  sheet.addEventListener("editor-mode", syncMode);

  sheet.querySelectorAll("[data-sticker-add]").forEach((button) => button.addEventListener("click", () => {
    sheet.querySelectorAll("[data-sticker-add]").forEach((other) => other.classList.toggle("is-armed", other === button));
    postFrame({ type: "arm", item: stickers.normalize({ sticker: button.dataset.stickerAdd }) });
    status.textContent = "미리보기에서 놓을 곳을 눌러 주세요.";
  }));
  chips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-sticker-select]");
    if (chip) select(chip.dataset.stickerSelect, { focus: true });
  });
  controls.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-sticker-color]");
    if (swatch) updateSelected({ color: swatch.dataset.stickerColor });
    if (event.target.closest("[data-sticker-remove]")) {
      draft.splice(draft.findIndex((item) => item.id === selectedId), 1);
      markDirty();
      select("");
    }
  });
  controls.addEventListener("input", (event) => {
    const field = event.target.dataset.stickerField;
    if (!field) return;
    const item = updateSelected({ [field]: event.target.value }, { repaint: false });
    if (!item) return;
    const preview = controls.querySelector(".sticker-row-preview");
    if (field === "color") preview.style.color = item.color;
    if (field === "rotate") preview.style.transform = `rotate(${item.rotate}deg)`;
    const output = event.target.closest(".field")?.querySelector("output");
    if (output) output.textContent = field === "size" ? `${item.size}px` : `${item.rotate}°`;
  });
  controls.addEventListener("change", (event) => {
    if (event.target.type === "color") { paintChips(); paintControls(); }
  });
}

async function renderGuestbookEntries() {
  rememberAdminView("guestbook");
  adminApp.innerHTML = `${adminHeader("guestbook")}${contentBackBar("방명록")}<section class="admin-card"><h2>방명록</h2><p class="admin-message">방명록을 불러오고 있습니다.</p></section>`;
  bindAdminNavigation();
  try {
    const entries = await window.RSVP_STORAGE.loadAdminGuestbookEntries();
    adminApp.innerHTML = `${adminHeader("guestbook")}${contentBackBar("방명록")}<section class="admin-card">
      <div class="admin-toolbar"><h2>방명록</h2><span class="badge">${entries.length}개</span></div>
      <p class="admin-message micro-help">부적절한 메시지는 숨길 수 있습니다. 숨긴 메시지는 공개 청첩장에서 보이지 않습니다.</p>
      <div class="response-list">${entries.length ? entries.map((entry) => `
        <article class="response-card ${entry.hidden ? "is-muted" : ""}">
          <h3>${escapeAdminHtml(entry.guest_name)} ${entry.hidden ? '<span class="badge">숨김</span>' : ""}</h3>
          <div class="response-message-row">
            <p>${escapeAdminHtml(entry.message)}</p>
            <button class="btn" type="button" data-toggle-guestbook="${escapeAdminHtml(entry.id)}" data-hidden="${entry.hidden ? "true" : "false"}">${entry.hidden ? "다시 보이기" : "숨기기"}</button>
          </div>
          <p class="response-meta">${escapeAdminHtml(formatDate(entry.created_at))}</p>
        </article>`).join("") : '<p class="admin-message">등록된 방명록이 없습니다.</p>'}</div>
    </section>`;
    bindAdminNavigation();
    document.querySelectorAll("[data-toggle-guestbook]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await window.RSVP_STORAGE.setGuestbookEntryHidden(button.dataset.toggleGuestbook, button.dataset.hidden !== "true");
        await renderGuestbookEntries();
      } catch (error) {
        button.disabled = false;
        alert(error.message || "방명록 상태를 변경하지 못했습니다.");
      }
    }));
  } catch (error) {
    const expired = error?.code === "AUTH_EXPIRED";
    const noGrant = error?.code === "42501";
    const reason = expired
      ? "로그인이 만료됐어요. 다시 로그인하면 방명록을 볼 수 있어요."
      : noGrant
        ? "방명록을 볼 권한이 데이터베이스에 설정돼 있지 않아요. Supabase SQL Editor에서 방명록 권한 설정을 다시 실행해 주세요."
        : "방명록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    adminApp.innerHTML = `${adminHeader("guestbook")}${contentBackBar("방명록")}<section class="admin-card"><p class="admin-message">${escapeAdminHtml(reason)}</p>${expired ? '<button class="btn btn-primary" type="button" data-guestbook-relogin>다시 로그인</button>' : `<p class="admin-message micro-help">${escapeAdminHtml(error?.message || "")}</p>`}</section>`;
    bindAdminNavigation();
    adminApp.querySelector("[data-guestbook-relogin]")?.addEventListener("click", () => renderLogin());
  }
}

// 실제 청첩장 테마가 적용될 때까지 admin.html이 화면을 가려 두므로, 끝나면 보여 주고
// 다음 접속 때 첫 배경을 이 테마 색으로 칠할 수 있게 기억해 둡니다.
function revealAdminPage({ rememberTheme = false } = {}) {
  document.documentElement.classList.add("theme-ready");
  if (!rememberTheme) return;
  try { localStorage.setItem("wedding-theme-bg", getComputedStyle(document.body).getPropertyValue("--body-bg").trim()); } catch {}
}

async function start() {
  if (!window.INVITATION_DATA) return renderDependencyNotice("기본 청첩장 데이터 스크립트를 불러오지 못했습니다.");
  if (!window.RSVP_STORAGE?.loadInvitationData) return renderDependencyNotice("저장소 스크립트를 불러오지 못했습니다.");
  // 로그인 전 화면들은 기본 테마로 보여 줌 (로그인 후에는 기본 테마를 거치지 않고 바로 실제 테마 적용)
  const showWithDefaultTheme = (render) => { applyAppearance(invitationData.appearance); render(); revealAdminPage(); };
  const client = getAdminSupabaseClient();
  if (!client) return showWithDefaultTheme(() => renderLogin("로그인 서버 연결을 준비하고 있습니다. 화면이 열렸다면 잠시 후 로그인해 주세요."));
  bindPasswordRecoveryListener(client);
  const { data } = await client.auth.getSession();
  if (hasPasswordRecoveryContext()) return showWithDefaultTheme(renderPasswordReset);
  if (!data.session) return showWithDefaultTheme(renderLogin);
  currentInvitationSite = await window.RSVP_STORAGE.getCurrentInvitationSite();
  if (!currentInvitationSite?.slug) return showWithDefaultTheme(renderBasicInfoOnboarding);
  if (currentInvitationSite.disabled) return showWithDefaultTheme(() => renderLogin("비활성화된 일반관리자입니다. 사이트 관리자에게 문의해 주세요."));
  await loadInvitationData();
  renderAdminView(localStorage.getItem(GENERAL_ADMIN_VIEW_KEY) || "editor");
  revealAdminPage({ rememberTheme: true });
}

start().catch((error) => {
  console.error("[admin start]", error);
  revealAdminPage();
  if (adminApp) {
    adminApp.innerHTML = `
      <section class="admin-card admin-login">
        <p class="section-label">Admin Error</p>
        <h2>관리자페이지를 열지 못했습니다</h2>
        <p class="admin-message">페이지를 새로고침해도 반복되면 아래 오류 내용을 알려주세요.</p>
        <p class="admin-message micro-help">${escapeAdminHtml(error.message || String(error))}</p>
      </section>`;
  }
});
