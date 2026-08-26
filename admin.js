const adminApp = document.querySelector("#admin-app");
const adminUtils = window.WEDDING_UTILS || {};
const adminNoticeRowsHtml = adminUtils.noticeRowsHtml || (() => "");
const sectionRegistry = window.WEDDING_SECTIONS || {};
const escapeAdminHtml = adminUtils.escapeHtml || ((value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]));
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
const movieConcepts = ["none", "about_time", "la_la_land", "spirited_away", "you_are_the_apple"];
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

function formatDate(value) {
  return adminUtils.formatDate ? adminUtils.formatDate(value) : value ? new Date(value).toLocaleString("ko-KR") : "";
}

function formatDateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatBytes(bytes = 0) {
  if (adminUtils.formatBytes) return adminUtils.formatBytes(bytes);
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function dateInputToday() {
  if (adminUtils.dateInputToday) return adminUtils.dateInputToday();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function dateOnly(value = "") {
  if (adminUtils.dateOnly) return adminUtils.dateOnly(value);
  return String(value || "").slice(0, 10);
}

function addDays(dateValue = "", days = 0) {
  if (adminUtils.addDays) return adminUtils.addDays(dateValue, days);
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
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

function decorateRangeDefaults(root = document) {
  root.querySelectorAll('input[type="range"]').forEach((range) => {
    if (!range.dataset.defaultValue) range.dataset.defaultValue = range.defaultValue || range.getAttribute("value") || range.value;
    const min = Number(range.min || 0);
    const max = Number(range.max || 100);
    const defaultValue = Number(range.dataset.defaultValue);
    const position = max === min ? 0 : ((defaultValue - min) / (max - min)) * 100;
    range.style.setProperty("--range-default-pos", `${Math.max(0, Math.min(100, position))}%`);
    range.title = `기본값 ${range.dataset.defaultValue}`;
    const output = range.parentElement?.querySelector("output");
    if (output) output.textContent = range.value;
    setRangeFill(range);
  });
}

function setRangeFill(range) {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const value = Number(range.value || 0);
  const position = max === min ? 0 : ((value - min) / (max - min)) * 100;
  range.style.setProperty("--range-current-pos", `${Math.max(0, Math.min(100, position))}%`);
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
  const cardUrl = cardSlug && cardSlug !== "main" ? `./index.html?card=${encodeURIComponent(cardSlug)}` : "./index.html";
  const generalMenu = `<nav class="admin-bottom-tabs" role="tablist">
    <button class="admin-tab-item ${active === "editor" ? "is-active" : ""}" data-admin-view="editor" role="tab">
      ${ico("M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", '<path d="M9 22V12h6v10"/>')}
      <span>기본</span>
    </button>
    <button class="admin-tab-item ${active === "copy" ? "is-active" : ""}" data-admin-view="copy-editor" role="tab">
      ${ico("M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z")}
      <span>편집</span>
    </button>
    <button class="admin-tab-item ${["content", "responses", "photos", "guestbook"].includes(active) ? "is-active" : ""}" data-admin-view="content" role="tab">
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
    ${generalMenu}
    ${active === "editor" ? '<button class="admin-floating-save" type="submit" form="invitation-editor"><span>✓</span> 저장</button>' : ""}
    ${active === "copy" ? '<button class="admin-floating-save" type="submit" form="invitation-editor"><span>✓</span> 저장</button>' : ""}`;
}

function bindAdminNavigation() {
  document.querySelector("#admin-logout")?.addEventListener("click", async () => {
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

function rememberAdminView(view) {
  localStorage.setItem(GENERAL_ADMIN_VIEW_KEY, view);
}

function renderAdminView(view = "") {
  const generalViews = new Set(["editor", "copy-editor", "sections", "share-settings", "content", "gallery", "responses", "photos", "guestbook", "music"]);
  rememberAdminView(generalViews.has(view) ? view : "editor");
  if (view === "editor") renderEditor();
  else if (view === "design") renderEditor("", "copy");
  else if (view === "copy-editor") renderEditor("", "copy");
  else if (view === "sections") renderEditor("", "sections");
  else if (view === "share-settings") renderEditor("", "share");
  else if (view === "content") renderContentHub();
  else if (view === "gallery") renderEditor("", "gallery");
  else if (view === "responses") renderResponses();
  else if (view === "photos") renderGuestPhotos();
  else if (view === "guestbook") renderGuestbookEntries();
  else if (view === "music") renderMusicSettings();
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
        <button type="button" data-content-open="photos"><strong>하객 사진·영상</strong><span>하객이 공유한 원본 파일을 저장하고 정리합니다.</span></button>
        <button type="button" data-content-open="guestbook"><strong>방명록</strong><span>축하 메시지를 확인하고 숨김 처리합니다.</span></button>
        <button type="button" data-content-open="music"><strong>배경음악</strong><span>진입 화면 이후 재생할 배경음악을 설정합니다.</span></button>
      </div>
    </section>`;
  bindAdminNavigation();
  document.querySelectorAll("[data-content-open]").forEach((button) => button.addEventListener("click", () => {
    renderAdminView(button.dataset.contentOpen);
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
        <label class="field"><span>로그인 ID</span><input name="loginId" type="text" required autocomplete="username" value="${escapeAdminHtml(rememberedLoginId)}"></label>
        <label class="field"><span>비밀번호</span><input name="password" type="password" required autocomplete="current-password"></label>
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
  const syncSignupPublicPeriod = (forceCloseToWedding = false) => {
    syncPublicPeriodFields({ weddingField: signupForm?.elements.weddingDate, openField: signupForm?.elements.publicOpenDate, closeField: signupForm?.elements.publicCloseDate, forceCloseToWedding });
  };
  signupForm?.elements.weddingDate?.addEventListener("change", () => syncSignupPublicPeriod(true));
  signupForm?.elements.publicOpenDate?.addEventListener("change", () => syncSignupPublicPeriod(false));
  syncSignupPublicPeriod();
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
    { id: "editorial_red", name: "스칼렛 데이", desc: "딥레드 + 흑백 사진. 잡지형 큰 타이포·폴라로이드 프로필 구도.",     bg: "#f8f3ec", accent: "#c41230", heroShape: "full" },
    { id: "garden_doodle", name: "러브 두들",  desc: "초록 낙서 프레임 + 하트 사진. 손그림 감성의 사랑스러운 결혼식.",   bg: "#eef2eb", accent: "#c23b2a", heroShape: "heart" },
    { id: "navy_arch",     name: "달빛 서약",  desc: "파란 배경 + 아치 사진. 단정하고 품격 있는 커플의 웨딩.",          bg: "#f5f7fa", accent: "#1a2456", heroShape: "arch" },
    { id: "cream_organic", name: "봄날 연가",  desc: "크림 + 라벤더 아치 패널. 둥글고 부드러운 봄 웨딩 무드.",          bg: "#faf8f4", accent: "#7c6d9a", heroShape: "full" },
    { id: "crimson_silk",  name: "벨벳 나이트", desc: "진홍 다크 히어로 + 크림 본문. 연인의 열정을 담은 스플릿 구조.",   bg: "#f8f2ec", accent: "#8b1a2f", heroShape: "inset" },
  ];
  const heroShapeStyle = (shape, accent) => {
    if (shape === "arch")  return `position:absolute;left:50%;transform:translateX(-50%);bottom:0;width:58%;height:68%;border-radius:100px 100px 0 0;overflow:hidden;background:${accent};opacity:0.72;`;
    if (shape === "inset") return `position:absolute;inset:28% 10% 8%;border-radius:10px;background:${accent};opacity:0.55;`;
    if (shape === "heart") return `position:absolute;left:50%;transform:translateX(-50%);top:28%;width:56%;height:52%;clip-path:path('M50 80Q10 58 10 34C10 17 22 10 35 10Q43 10 50 18Q57 10 65 10C78 10 90 17 90 34Q90 58 50 80Z');background:${accent};opacity:0.62;`;
    return `position:absolute;inset:0;background:${accent};opacity:0.35;`;
  };
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
  const syncPublicPeriod = (forceCloseToWedding = false) => {
    syncPublicPeriodFields({ weddingField: form.elements.weddingDate, openField: form.elements.publicOpenDate, closeField: form.elements.publicCloseDate, forceCloseToWedding });
  };
  form.elements.weddingDate.addEventListener("change", () => syncPublicPeriod(true));
  form.elements.publicOpenDate.addEventListener("change", () => syncPublicPeriod(false));
  syncPublicPeriod();
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

async function renderSetupNotice() {
  if (!window.RSVP_STORAGE?.loadInvitationData) {
    renderDependencyNotice("저장소 스크립트가 아직 준비되지 않았습니다. 모바일 Safari에서 새로고침해 주세요.");
    return;
  }
  await loadInvitationData();
  renderEditor("현재는 Supabase 연결 전 미리보기 모드입니다. 변경 내용은 이 브라우저에 저장되며 공개 청첩장을 새로고침하면 반영됩니다.");
}

function renderDependencyNotice(message = "") {
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

function textarea(name, label, value = "", rows = 3) {
  return `<label class="field"><span>${label}</span><textarea name="${name}" rows="${rows}">${escapeAdminHtml(value)}</textarea></label>`;
}

function rangeInput(name, label, value, min, max, step = 1) {
  return `<label class="field range-field"><span>${label}</span><input name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${escapeAdminHtml(value)}"><output>${escapeAdminHtml(value)}</output></label>`;
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

function introDesignEditor(groom, bride) {
  const design = invitationData.hero.introDesign || {};
  const defaultNames = `${groom.name} · ${bride.name}`;
  const introName = invitationData.hero.introName || defaultNames;
  const introNameValue = introName;
  return `
    <div class="copy-editor-intro-preview" data-intro-design-preview>
      <small data-intro-preview-eyebrow>${escapeAdminHtml(invitationData.hero.introEyebrow || invitationData.hero.eyebrow || "our wedding day")}</small>
      <strong data-intro-preview-name>${escapeAdminHtml(introName)}</strong>
      <span data-intro-preview-date>${escapeAdminHtml(invitationData.hero.introDate || invitationData.wedding.displayDate)}</span>
    </div>
    <p class="admin-message micro-help">기본값은 신랑·신부 이름 조합입니다. 필요하면 진입화면 전용 문구로 직접 바꿀 수 있습니다.</p>
    ${input("hero.introEyebrow", "진입 화면 영문 문구", invitationData.hero.introEyebrow || invitationData.hero.eyebrow || "")}
    ${input("hero.introName", "진입 화면 메인 문구", introNameValue)}
    ${input("hero.introDate", "진입 화면 날짜 문구 · 비우면 예식 일시 사용", invitationData.hero.introDate || "")}
    <p class="admin-message micro-help">배경음악은 <strong>콘텐츠 관리 → 배경음악</strong>에서 설정할 수 있습니다.</p>
    ${select("hero.introDesign.align", "문구 정렬", design.align || "center", [["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]])}
    <div class="text-layout-editor">
      ${introRange("eyebrowSize", "영문 문구 크기", design.eyebrowSize ?? 11, 8, 24)}
      ${introRange("nameSize", "이름 크기", design.nameSize ?? 30, 20, 54)}
      ${introRange("dateSize", "날짜 크기", design.dateSize ?? 11, 8, 20)}
      ${introRange("eyebrowNameGap", "영문 ↔ 이름 간격", design.eyebrowNameGap ?? 10, 0, 40)}
      ${introRange("nameDateGap", "이름 ↔ 날짜 간격", design.nameDateGap ?? 10, -24, 40)}
      ${introRange("offsetY", "전체 위아래 위치", design.offsetY ?? 0, -160, 160)}
    </div>`;
}

function appearancePresetValue(appearance = {}) {
  return appearance.movieConcept && appearance.movieConcept !== "none"
    ? `movie:${appearance.movieConcept}`
    : `theme:${appearance.theme || "sky"}`;
}

function appearancePresetField(appearance = {}) {
  const value = appearancePresetValue(appearance);
  const option = ([optionValue, text]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${text}</option>`;
  return `
    <label class="field concept-preset"><span>전체 디자인 프리셋</span>
      <select name="appearance.preset">
        <optgroup label="기본 컬러 테마">
          ${[["theme:beige", "베이지"], ["theme:sky", "하늘색"], ["theme:pink", "핑크"], ["theme:gray", "연한 회색"], ["theme:black", "블랙"], ["theme:white", "화이트"], ["theme:green", "그린"]].map(option).join("")}
        </optgroup>
        <optgroup label="영화 컨셉">
          ${[["movie:about_time", "어바웃타임"], ["movie:la_la_land", "라라랜드"], ["movie:spirited_away", "지브리 센과 치히로 무드"], ["movie:you_are_the_apple", "그 시절, 우리가 좋아했던 소녀 무드"]].map(option).join("")}
        </optgroup>
      </select>
      <input name="appearance.theme" type="hidden" value="${escapeAdminHtml(appearance.theme || "sky")}">
      <input name="appearance.movieConcept" type="hidden" value="${escapeAdminHtml(appearance.movieConcept || "none")}">
    </label>`;
}

function normalizedHeroDecoration(value = "none") {
  const legacyDecorations = { line_frame: "doodle_hearts", heart_frame: "organic_heart" };
  const selected = legacyDecorations[value] || value;
  return heroDecorations.includes(selected) ? selected : "none";
}

function heroDecorationField(value = "none") {
  const selected = normalizedHeroDecoration(value);
  const decorations = [
    ["none", "꾸밈 없음", "사진을 화면에 가득 채워 깔끔하게 보여줍니다."],
    ["doodle_hearts", "손그림 하트 낙서", "하트와 꽃, 반짝임을 사진 위에 가볍게 흩뿌립니다."],
    ["organic_heart", "유기적 하트 프레임", "손으로 그린 듯한 큰 하트 라인이 사진을 감쌉니다."],
    ["wedding_rings", "웨딩 링 리본", "반지와 리본, 작은 하트로 청첩장다운 테두리를 만듭니다."],
    ["poster_card", "포스터 카드", "여백과 둥근 사진 틀을 사용해 에디토리얼 포스터처럼 표현합니다."],
  ];
  return `
    <fieldset class="hero-decoration-field">
      <legend>메인 이미지 꾸밈</legend>
      <p class="admin-message">사진 위에 더할 웨딩 그래픽을 선택해 주세요. 선택한 꾸밈만 표시됩니다.</p>
      <div class="hero-decoration-list">
        ${decorations.map(([optionValue, label, description]) => `
          <label class="hero-decoration-option">
            <input type="radio" name="appearance.heroDecoration" value="${optionValue}" ${selected === optionValue ? "checked" : ""}>
            <span class="hero-decoration-preview" data-decoration-preview="${optionValue}"><i></i></span>
            <span class="hero-decoration-copy"><strong>${label}</strong><small>${description}</small></span>
          </label>`).join("")}
      </div>
    </fieldset>`;
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

function videoField(name, label, value = "") {
  return `
    <div class="image-field">
      <input name="${name}" type="hidden" value="${escapeAdminHtml(value)}">
      <div class="image-preview" data-video-preview="${name}">
        ${value ? `<video src="${escapeAdminHtml(adminMediaUrl(value))}" muted controls playsinline></video>` : '<span>등록된 영상이 없습니다.</span>'}
      </div>
      <div class="image-field-controls">
        <strong>${label}</strong>
        <span class="micro-help">MP4, WebM 또는 MOV 영상을 선택해 주세요. 영상 로드가 어려운 기기에서는 메인 사진이 대신 표시됩니다.</span>
        <div class="image-actions">
          <label class="btn image-upload">＋ 영상 선택<input type="file" accept="video/mp4,video/webm,video/quicktime" data-video-target="${name}"></label>
          <button class="btn" type="button" data-video-remove="${name}">× 제거</button>
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

function heroActiveMediaField(hero = {}) {
  const active = hero.activeMedia === "video" && hero.video ? "video" : "image";
  const hasBoth = Boolean(hero.image && hero.video);
  return `
    <div class="hero-active-media ${hasBoth ? "" : "is-hidden"}" data-hero-active-media>
      <strong>첫 화면 활성 미디어</strong>
      <div class="segmented-control">
        <label><input type="radio" name="hero.activeMedia" value="image" ${active !== "video" ? "checked" : ""}> <span>이미지</span></label>
        <label><input type="radio" name="hero.activeMedia" value="video" ${active === "video" ? "checked" : ""}> <span>영상</span></label>
      </div>
      <p class="admin-message micro-help">이미지와 영상이 모두 등록된 경우, 공개 첫 화면에 어떤 미디어를 먼저 보여줄지 선택합니다.</p>
    </div>`;
}

function heroMediaDock(hero = {}) {
  const active = hero.activeMedia === "video" && hero.video ? "video" : "image";
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
      <button class="editor-media-card ${hero.video ? "has-media" : ""}" type="button" data-tool-action="hero-video" data-tool-context="hero">
        <span class="editor-media-thumb is-video" data-hero-video-thumb>${hero.video ? "VIDEO" : "＋"}</span>
        <strong>${hero.video ? "영상 등록됨" : "영상 업로드"}</strong>
      </button>
      <div class="editor-media-actions" data-hero-media-actions="video" hidden>
        <button type="button" data-tool-action="hero-video-change">변경</button>
        <button type="button" data-tool-action="hero-video-remove">삭제</button>
      </div>
      <div class="editor-media-active-toggle ${hero.image && hero.video ? "" : "is-hidden"}" data-hero-dock-active>
        <button type="button" class="${active !== "video" ? "is-active" : ""}" data-hero-active="image">이미지 활성</button>
        <button type="button" class="${active === "video" ? "is-active" : ""}" data-hero-active="video">영상 활성</button>
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

function editorPresetSelect(name, label, themes, selected) {
  const group = (type, groupLabel) => `<optgroup label="${groupLabel}">${editorDesignOptions(themes.filter((theme) => theme.type === type), selected)}</optgroup>`;
  return `<label class="field"><span>${label}</span><select name="${name}">${group("color", "컬러테마")}${group("movie", "영화테마")}</select></label>`;
}

function editorDesignFramePicker(frames, selected) {
  const option = (frame) => `<label class="hero-decoration-option">
    <input type="radio" name="appearance.design.heroDecoration" value="${escapeAdminHtml(frame.id)}" ${selected === frame.id ? "checked" : ""}>
    <span class="hero-decoration-copy"><strong>${escapeAdminHtml(frame.name)}</strong></span>
  </label>`;
  return `<fieldset class="hero-decoration-field"><legend>메인 이미지 꾸밈</legend><div class="hero-decoration-list">${option({ id: "inherit", name: "프리셋 기본값 사용" })}${frames.map(option).join("")}</div></fieldset>`;
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
        <button class="editor-start-close" type="button" data-editor-start-close aria-label="편집 시작 창 닫기">×</button>
        <div class="editor-start-title">
          <p class="section-label">Start Edit</p>
          <h2>원하는 테마로<br>청첩장 편집을 시작해보세요</h2>
        </div>
        <div class="editor-start-section">
          <h3>컬러 · 영화테마</h3>
          <div class="editor-start-grid">${system.themes.filter((theme) => theme.enabled !== false).map(themeCard).join("")}</div>
        </div>
        <div class="editor-start-section">
          <h3>메인 문구 테마</h3>
          <div class="editor-start-grid">${system.assets.textThemes.filter((theme) => theme.enabled !== false).map(textCard).join("")}</div>
        </div>
        <button class="editor-start-apply" type="button" data-editor-start-apply>선택하고 편집하기</button>
      </div>
    </section>`;
}

function editorDesignPanel() {
  window.WEDDING_DESIGN?.normalize(invitationData);
  const system = invitationData.designSystem;
  const design = invitationData.appearance.design || {};
  const selectedPreset = editorPresetValue(invitationData.appearance || {});
  const selectedTextTheme = design.heroTextTheme || "auto";
  const hasPreset = Boolean(invitationData.appearance?.design?.presetId || invitationData.appearance?.theme || invitationData.appearance?.movieConcept);
  const onboarding = editorOnboardingPicker(system, selectedPreset, selectedTextTheme)
    .replace('<section class="editor-start-backdrop"', `<section class="editor-start-backdrop"${hasPreset ? " hidden" : ""}`);
  const activeLayoutId = system.activeLayoutId || "classic";
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
      ${editorPresetSelect("editorPresetId", "컬러테마 · 영화테마", system.themes, selectedPreset)}
      <button class="editor-theme-open" type="button" data-editor-theme-open>전체보기</button>
    </section>
    ${onboarding}
    <div class="editor-design-hidden-fields">
      <input type="hidden" name="appearance.design.presetId" value="${escapeAdminHtml(selectedPreset)}">
      <input type="hidden" name="appearance.design.heroTextTheme" value="${escapeAdminHtml(selectedTextTheme)}">
    </div>
    <section class="editor-tooldock" data-editor-tool-panel hidden>
      <div class="editor-tooldock-head">
        <button class="editor-tooldock-close" type="button" data-tooldock-collapse aria-label="편집 도구 아래로 숨기기"><span aria-hidden="true"></span></button>
        <div><strong data-tooldock-title>편집 도구</strong><span data-tooldock-help>수정할 영역을 누르면 도구가 바뀝니다.</span></div>
      </div>
      <nav class="editor-tooldock-tabs" aria-label="편집 도구 탭">
        <button type="button" data-tooldock-tab="media">미디어</button>
        <button type="button" data-tooldock-tab="frame">꾸밈</button>
        <button type="button" data-tooldock-tab="text">문구테마</button>
        <button type="button" data-tooldock-tab="position">메인 문구위치</button>
        <button type="button" data-tooldock-tab="style">글자/위치</button>
        <button type="button" data-tooldock-tab="items">항목관리</button>
      </nav>
      <div class="editor-tooldock-pane" data-tooldock-pane="media">
        <div class="editor-tool-buttons" data-profile-media-tools>
          <button class="editor-tool-button is-primary" type="button" data-tool-action="profile-photo" data-tool-context="profile"><span>＋</span>업로드</button>
          <button class="editor-tool-button" type="button" data-tool-action="profile-crop" data-tool-context="profile"><span>↔</span>영역맞추기</button>
          <button class="editor-tool-button" type="button" data-tool-action="profile-remove" data-tool-context="profile"><span>−</span>삭제</button>
        </div>
        <div data-hero-media-tools>${heroMediaDock(invitationData.hero)}</div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="frame">
        ${editorDesignFramePicker(system.assets.frames, design.heroDecoration || "inherit")}
        <div class="editor-frame-compact">
          <div class="editor-color-strip">${input("appearance.design.heroDecorationTint", "꾸밈 색상", design.heroDecorationTint || "#ffffff", "color")}</div>
          ${frameStepControl("appearance.design.heroDecorationSize", "크기", Number(design.heroDecorationSize) || 100, 70, 130, 5)}
          ${frameStepControl("appearance.design.heroDecorationStrokeWidth", "선 두께", Number(design.heroDecorationStrokeWidth) || 3, 1, 8, 0.5)}
          ${frameStepControl("appearance.design.heroDecorationYPercent", "위치", Number(design.heroDecorationYPercent) || 0, -80, 80, 2)}
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="text">
        ${editorDesignTextThemePicker(system.assets.textThemes, selectedTextTheme)}
        <div class="hero-copy-toggle-grid">
          <label class="consent"><input type="checkbox" name="appearance.design.heroEyebrowEnabled" ${design.heroEyebrowEnabled !== false ? "checked" : ""}> <span>영문</span></label>
          <label class="consent"><input type="checkbox" name="appearance.design.heroNamesEnabled" ${design.heroNamesEnabled !== false ? "checked" : ""}> <span>이름</span></label>
          <label class="consent"><input type="checkbox" name="appearance.design.heroDateEnabled" ${design.heroDateEnabled !== false ? "checked" : ""}> <span>날짜</span></label>
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="position">
        ${select("hero.contentPosition", "메인 사진 문구 위치", invitationData.hero.contentPosition || "bottom", [["top", "상단"], ["middle", "중간"], ["bottom", "하단"]])}
        <div class="text-layout-editor">
          <label class="text-layout-control"><span>좌우 위치</span><input name="appearance.design.heroTextXPercent" type="range" min="10" max="90" value="${escapeAdminHtml(design.heroTextXPercent ?? 50)}"><output>${escapeAdminHtml(design.heroTextXPercent ?? 50)}</output></label>
          <label class="text-layout-control"><span>위아래 위치</span><input name="appearance.design.heroTextYPercent" type="range" min="10" max="90" value="${escapeAdminHtml(design.heroTextYPercent ?? 76)}"><output>${escapeAdminHtml(design.heroTextYPercent ?? 76)}</output></label>
        </div>
      </div>
      <div class="editor-tooldock-pane" data-tooldock-pane="style">
        <div class="text-layout-editor text-style-compact">
          <label class="text-layout-control text-step-control">
            <span>크기</span>
            <input type="range" min="10" max="44" value="16" data-preview-text-size>
            <div class="text-stepper"><button type="button" data-preview-text-step="size:-1">−</button><output data-preview-text-size-output>16</output><button type="button" data-preview-text-step="size:1">＋</button></div>
          </label>
          <label class="text-layout-control text-step-control">
            <span>위아래</span>
            <input type="range" min="-40" max="40" value="0" data-preview-text-y>
            <div class="text-stepper"><button type="button" data-preview-text-step="y:-2">−</button><output data-preview-text-y-output>0</output><button type="button" data-preview-text-step="y:2">＋</button></div>
          </label>
          <label class="text-layout-control text-step-control">
            <span>좌우</span>
            <input type="range" min="-40" max="40" value="0" data-preview-text-x>
            <div class="text-stepper"><button type="button" data-preview-text-step="x:-2">−</button><output data-preview-text-x-output>0</output><button type="button" data-preview-text-step="x:2">＋</button></div>
          </label>
        </div>
        <button class="editor-tool-button editor-tool-reset" type="button" data-preview-text-reset><span>↺</span>원래값</button>
      </div>
      <div class="editor-tooldock-pane editor-tooldock-manager" data-tooldock-pane="items">
        <div data-tooldock-items="information">${noticeManager(invitationData.notices)}</div>
        <div data-tooldock-items="location">${transportManager(invitationData.transport)}</div>
        <div class="editor-detail-fields" data-tooldock-items="wedding-snap-detail">
          ${textarea("guestPhotos.modalGuideTitle", "게스트앨범 모달 제목", invitationData.guestPhotos?.modalGuideTitle || "여러분의 사진첩이 우리 앨범이 됩니다.")}
          ${textarea("guestPhotos.modalGuideText", "게스트앨범 모달 설명", invitationData.guestPhotos?.modalGuideText || "1. 두 사람의 설렘 가득한 스냅\n2. 멋진 입장 & 환한 행진\n3. 가족·친구와의 찰칵 한 컷\n4. 당신의 시선으로 포착한 장면들", 5)}
          ${textarea("guestPhotos.modalGuideFootnote", "게스트앨범 모달 하단 문구", invitationData.guestPhotos?.modalGuideFootnote || "작은 한 컷이 우리에게 큰 선물이 돼요.")}
          ${textarea("guestPhotos.manageDescription", "내가 보낸 파일 안내 문구", invitationData.guestPhotos?.manageDescription || "이 휴대폰에서 보낸 사진과 영상을 확인하거나 삭제할 수 있습니다.")}
        </div>
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

function copyEditorVisual(key) {
  if (key === "invitation") return `<div class="copy-editor-notice">${invitationData.invitation.paragraphs.map((text) => `<p>${escapeAdminHtml(text)}</p>`).join("")}</div>`;
  if (key === "aboutUs") return `<div class="copy-editor-profile-grid">${[invitationData.couple.groom, invitationData.couple.bride].map((person) => `<img src="${escapeAdminHtml(adminMediaUrl(person.photo))}" alt="">`).join("")}</div>`;
  if (key === "gallery") return `<div class="copy-editor-gallery">${invitationData.gallery.map((photo, index) => ({ photo, thumb: invitationData.galleryThumbs?.[index] || photo })).filter((item) => item.photo).slice(0, 4).map((item) => `<img src="${escapeAdminHtml(adminMediaUrl(item.thumb))}" alt="">`).join("")}</div>`;
  if (key === "location") return `<div class="copy-editor-location"><strong>${escapeAdminHtml(invitationData.wedding.venue)}</strong><span>${escapeAdminHtml(invitationData.wedding.hall || "")}</span><small>${escapeAdminHtml(invitationData.wedding.address)}</small></div>`;
  if (key === "weddingDay") return `<p class="copy-editor-date">${escapeAdminHtml(invitationData.wedding.displayDate)}</p>`;
  if (key === "information") return `<div class="copy-editor-notice">${invitationData.notices.filter((notice) => !notice.hidden && notice.text?.trim()).slice(0, 1).map((notice) => `<strong>${escapeAdminHtml(notice.title)}</strong><p>${escapeAdminHtml(notice.text)}</p>`).join("")}</div>`;
  if (key === "weddingSnap") return '<div class="copy-editor-notice"><strong>Guest Album</strong><p>예식 당일 함께한 사진과 영상을 공유해 주세요.</p></div>';
  if (key === "attendance") return '<div class="copy-editor-notice"><p>신랑, 신부에게 참석 의사를 미리 전달할 수 있어요.</p></div>';
  if (key === "account") return `<div class="copy-editor-notice">${invitationData.accounts.slice(0, 2).map((account) => `<p><strong>${escapeAdminHtml(account.side)}</strong> ${escapeAdminHtml(account.bank)} ${escapeAdminHtml(account.number)}</p>`).join("")}</div>`;
  if (key === "guestbook") return '<div class="copy-editor-notice"><p>따뜻한 축하 메시지를 남겨 주세요.</p></div>';
  return "";
}

function listText(items, fields) {
  return items.map((item) => fields.map((field) => item[field] || "").join(" | ")).join("\n");
}

function parseList(value, fields) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const values = line.split("|").map((part) => part.trim());
    return Object.fromEntries(fields.map((field, index) => [field, values[index] || ""]));
  });
}

const validSectionIds = sectionRegistry.ids || ["invitation", "about-us", "wedding-day", "photo-interlude", "location", "information", "gallery", "wedding-snap", "attendance", "account", "guestbook"];
const defaultSectionOrder = sectionRegistry.defaultOrder || ["invitation", "about-us", "wedding-day", "photo-interlude", "location", "information", "gallery", "wedding-snap", "attendance", "account", "guestbook"];
const defaultSectionSettings = sectionRegistry.defaultSettings || {
  preWedding: [...defaultSectionOrder],
  weddingDay: [...defaultSectionOrder],
};
const sectionLabels = sectionRegistry.labels || {
  invitation: "초대글",
  "about-us": "두 사람 소개",
  "wedding-day": "예식일",
  "photo-interlude": "포토 섹션",
  location: "오시는 길",
  gallery: "갤러리",
  "wedding-snap": "하객 사진·영상 업로드",
  information: "식장 안내",
  attendance: "참석 여부",
  account: "마음 전하기",
  guestbook: "방명록",
};
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
  if (sectionRegistry.parseOrder) return sectionRegistry.parseOrder(value);
  return normalizeSectionOrder(value.split("\n")
    .map((item) => item.trim())
    .filter((item, index, items) => validSectionIds.includes(item) && items.indexOf(item) === index));
}

function normalizeSectionOrder(items = [], appendMissing = false) {
  if (sectionRegistry.normalizeOrder) return sectionRegistry.normalizeOrder(items, { appendMissing });
  const selected = items.filter((item, index) => validSectionIds.includes(item) && items.indexOf(item) === index);
  const withMissing = appendMissing ? [...selected, ...defaultSectionOrder.filter((id) => !selected.includes(id))] : [...selected];
  const photoIndex = withMissing.indexOf("photo-interlude");
  const locationIndex = withMissing.indexOf("location");
  const weddingIndex = withMissing.indexOf("wedding-day");
  const looksLikeLegacyDefault = photoIndex > locationIndex && weddingIndex !== -1 && locationIndex !== -1;
  if (!looksLikeLegacyDefault) return withMissing;
  const moved = withMissing.filter((id) => id !== "photo-interlude");
  moved.splice(moved.indexOf("wedding-day") + 1, 0, "photo-interlude");
  return moved;
}

function sectionOrderEditor(name, label, selected = [], previewMode = "") {
  const normalizedSelected = normalizeSectionOrder(selected);
  const ordered = normalizeSectionOrder(normalizedSelected, true);
  const resetKey = name.split(".").pop();
  const previewLabel = previewMode === "preWedding" ? "결혼식 전까지 미리보기" : "결혼식당일 이후 미리보기";
  return `
    <div class="section-order-editor" data-section-order>
      <div class="section-order-head">
        <strong>${label}</strong>
        <div class="section-order-actions">
          <a class="btn section-icon-action" href="./index.html?previewSectionMode=${escapeAdminHtml(previewMode)}" target="_blank" rel="noopener" aria-label="${escapeAdminHtml(previewLabel)}" title="${escapeAdminHtml(previewLabel)}">${tabIcon("M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z", '<circle cx="12" cy="12" r="3"/>')}</a>
          <button class="btn btn-secondary section-icon-action" type="button" data-section-reset="${escapeAdminHtml(resetKey)}" aria-label="기본값으로 초기화" title="기본값으로 초기화">${tabIcon("M3 12a9 9 0 1 0 3-6.7 M3 3v6h6")}</button>
        </div>
      </div>
      <input type="hidden" name="${name}" value="${escapeAdminHtml(sectionOrderText(normalizedSelected))}">
      <div class="section-order-list">
        ${ordered.map((id) => `
          <div class="section-order-item" data-section-id="${id}">
            <label><input type="checkbox" ${normalizedSelected.includes(id) ? "checked" : ""}> <span>${sectionLabels[id]}</span></label>
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

function venueMapSearchUrl(value) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(value)}`;
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
        onSelect({ venue: data.buildingName || queryInput.value.trim() || venue, address: roadAddr });
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
  const transportTypes = adminUtils.TRANSPORT_TYPES || [];
  const normalizeTransportTitle = adminUtils.normalizeTransportTitle || ((title = "") => title);
  const normalizeTransportLines = adminUtils.normalizeTransportLines || (() => []);
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
          <div class="account-side-head"><strong>${side}</strong><span>${side === "신랑측" ? "신랑 가족 계좌" : "신부 가족 계좌"}</span></div>
          <div class="account-side-list">
            ${normalizedAccounts.map((account, index) => ({ account, index })).filter(({ account }) => account.side === side).map(({ account, index }) => accountEditor(account, index)).join("")}
          </div>
          <button class="btn account-add" type="button" data-account-add="${side}">＋ ${side} 계좌 추가</button>
        </section>`).join("")}
    </div></section>`;
}

function renderEditor(message = "", focus = "") {
  const viewByFocus = { copy: "copy-editor", share: "share-settings", gallery: "gallery", sections: "sections" };
  rememberAdminView(viewByFocus[focus] || "editor");
  const isCopyFocus = focus === "copy";
  const isGalleryFocus = focus === "gallery" || focus === "copy";
  window.WEDDING_DESIGN?.normalize(invitationData);
  if (focus !== "copy") document.documentElement.style.removeProperty("--floating-save-bottom");
  if (!Array.isArray(invitationData.accounts)) {
    invitationData.accounts = ensureAccountRows([]);
  }
  const { groom, bride } = invitationData.couple;
  const [groomFather = "", groomMother = ""] = parentNames(groom.parents);
  const [brideFather = "", brideMother = ""] = parentNames(bride.parents);
  const recommendations = recommendationSets(groom, bride);
  const gallery = Array.from({ length: GALLERY_MAX }, (_, index) => invitationData.gallery[index] || "");
  const galleryThumbs = Array.from({ length: GALLERY_MAX }, (_, index) => invitationData.galleryThumbs?.[index] || "");
  const editorTitle = focus === "share" ? "공유 설정" : focus === "gallery" ? "갤러리 설정" : focus === "copy" ? "편집 기능" : focus === "sections" ? "섹션 설정" : "청첩장 기본 설정";
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
    <section class="admin-card admin-editor-view view-${escapeAdminHtml(focus || "basic")}">
      <div class="admin-editor-intro">
        <div><p class="section-label">Wedding Workspace</p><h2>${editorTitle}</h2></div>
        <span class="admin-mode-badge">모바일 편집</span>
      </div>
      <p class="admin-message">${escapeAdminHtml(message || "수정 후 맨 아래 저장 버튼을 눌러 주세요. 사진은 선택하면 즉시 업로드됩니다.")}</p>
      <nav class="admin-quick-actions basic-pane guided-progress" aria-label="입력 단계">
        <button type="button" data-editor-jump="couple-settings">${tabIcon("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", '<circle cx="12" cy="7" r="4"/>')}<span>핵심정보</span></button>
        <button type="button" data-editor-jump="main-media-settings">${tabIcon("M21 15l-5-5L5 21", '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>')}<span>첫화면</span></button>
        <button type="button" data-editor-jump="people-detail-settings">${tabIcon("M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z")}<span>두사람</span></button>
        <button type="button" data-editor-jump="wedding-detail-settings">${tabIcon("M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z", '<circle cx="12" cy="10" r="3"/>')}<span>장소안내</span></button>
      </nav>
      <form class="editor-form" id="invitation-editor">
        <fieldset class="basic-pane guided-step" id="couple-settings" data-guided-step="core"><legend>1. 가장 먼저 입력해 주세요</legend>
          <p class="admin-message">여기에서 입력한 이름, 부모님 성함, 식장과 예식 일시는 아래 세부 설정에 자동으로 반영됩니다.</p>
          <div class="quick-couple-cards">
            <section class="quick-side-card">
              <h3>신랑측 정보</h3>
              <div class="quick-field-row">
                ${quickInput("couple.groom.name", "신랑 이름", groom.name)}
                ${quickInput("couple.groom.birthday", "신랑 생일", birthdayInputValue(groom.birthday), "date")}
              </div>
              <div class="quick-field-row">
                ${quickInput("groomFather", "신랑 아버지", groomFather)}
                ${quickInput("groomMother", "신랑 어머니", groomMother)}
              </div>
            </section>
            <section class="quick-side-card">
              <h3>신부측 정보</h3>
              <div class="quick-field-row">
                ${quickInput("couple.bride.name", "신부 이름", bride.name)}
                ${quickInput("couple.bride.birthday", "신부 생일", birthdayInputValue(bride.birthday), "date")}
              </div>
              <div class="quick-field-row">
                ${quickInput("brideFather", "신부 아버지", brideFather)}
                ${quickInput("brideMother", "신부 어머니", brideMother)}
              </div>
            </section>
          </div>
          <div class="quick-input-grid">
            ${quickInput("wedding.venue", "식장 이름", invitationData.wedding.venue)}
            ${quickInput("wedding.hall", "홀 정보", invitationData.wedding.hall || "")}
            ${quickInput("wedding.date", "예식 일시", weddingDateInputValue(invitationData.wedding.date), "datetime-local")}
          </div>
          <div class="visibility-switch-grid">
            ${visibilitySelect("displaySettings.showInvitationParents", "초대글 부모님 성함", invitationData.displaySettings?.showInvitationParents)}
            ${visibilitySelect("displaySettings.showProfileParents", "두 사람 소개 부모님 성함", invitationData.displaySettings?.showProfileParents)}
            ${visibilitySelect("displaySettings.showProfileBirthdays", "두 사람 소개 생일", invitationData.displaySettings?.showProfileBirthdays)}
          </div>
          <p class="admin-message micro-help">비공개로 바꿔도 계좌 항목 자동 생성에는 부모님 성함을 그대로 사용합니다.</p>
          <button class="btn quick-apply" type="button" data-quick-apply><span>권장</span> 1번 입력값을 아래 항목에 반영하기</button>
          <p class="admin-message micro-help">이 버튼으로 관련 항목을 먼저 맞춘 뒤, 우측 하단의 변경사항 저장 버튼으로 최종 저장합니다.</p>
        </fieldset>
        <fieldset class="basic-pane guided-step" id="main-media-settings" data-guided-step="media" data-step-requires="core"><legend>2. 첫 화면</legend>
          ${heroActiveMediaField(invitationData.hero)}
          ${imageField("hero.image", "메인 사진", invitationData.hero.image)}
          ${videoField("hero.video", "메인 영상 (선택)", invitationData.hero.video || "")}
        </fieldset>
        <fieldset class="share-pane" id="share-settings"><legend>카카오톡 공유와 SEO</legend>
          ${imageField("meta.shareImage", "카카오톡 공유 대표 이미지 (선택 · 세로 3:4 권장)", invitationData.meta.shareImage || "")}
          <p class="admin-message micro-help">공유 대표 이미지를 등록하지 않으면 메인 사진이 자동으로 동일하게 적용됩니다. 카카오톡 카드에 별도 세로 사진을 사용하려면 600 x 800px 또는 같은 3:4 비율 이미지를 등록해 주세요.</p>
          ${recommendationEditor("meta.title", "공유 카드·검색 페이지 제목", invitationData.meta.title, recommendations.title)}
          ${textarea("meta.description", "공유 설명", invitationData.meta.description)}
          <p class="admin-message micro-help">카카오톡으로 링크를 보낼 때 대표 이미지 아래에 함께 표시되는 소개 문구입니다. 청첩장 본문에는 표시되지 않습니다.</p>
        </fieldset>
        <div class="couple-editor-grid basic-pane guided-step" id="people-detail-settings" data-guided-step="people" data-step-requires="core">
        <fieldset class="couple-editor-card"><legend>신랑 정보</legend>
          <input type="hidden" name="couple.groom.name" value="${escapeAdminHtml(groom.name)}">
          <input type="hidden" name="couple.groom.parents" value="${escapeAdminHtml(groom.parents)}">
          <input type="hidden" name="couple.groom.birthday" value="${escapeAdminHtml(birthdayInputValue(groom.birthday))}">
          <div class="auto-filled-fields" data-auto-summary="groom"><strong data-auto-value="groom.name">${escapeAdminHtml(groom.name)}</strong><span><b>부모님</b><i data-auto-value="groom.parents">${escapeAdminHtml(displayParentNames(groom.parents) || "미입력")}</i></span><span><b>생일</b><i data-auto-value="groom.birthday">${escapeAdminHtml(groom.birthday || "미입력")}</i></span></div>
          ${input("couple.groom.relation", "부모님 성함 뒤 관계 문구 · 직접 수정", groom.relation)}
          ${input("couple.groom.phone", "연락처", groom.phone)}
          ${input("couple.groom.mbti", "별칭·MBTI 등", groom.mbti)}
          ${tagFields("couple.groom.tags", "성격태그", groom.tags)}
          ${imageField("couple.groom.photo", "신랑 사진", groom.photo)}
        </fieldset>
        <fieldset class="couple-editor-card"><legend>신부 정보</legend>
          <input type="hidden" name="couple.bride.name" value="${escapeAdminHtml(bride.name)}">
          <input type="hidden" name="couple.bride.parents" value="${escapeAdminHtml(bride.parents)}">
          <input type="hidden" name="couple.bride.birthday" value="${escapeAdminHtml(birthdayInputValue(bride.birthday))}">
          <div class="auto-filled-fields" data-auto-summary="bride"><strong data-auto-value="bride.name">${escapeAdminHtml(bride.name)}</strong><span><b>부모님</b><i data-auto-value="bride.parents">${escapeAdminHtml(displayParentNames(bride.parents) || "미입력")}</i></span><span><b>생일</b><i data-auto-value="bride.birthday">${escapeAdminHtml(bride.birthday || "미입력")}</i></span></div>
          ${input("couple.bride.relation", "부모님 성함 뒤 관계 문구 · 직접 수정", bride.relation)}
          ${input("couple.bride.phone", "연락처", bride.phone)}
          ${input("couple.bride.mbti", "별칭·MBTI 등", bride.mbti)}
          ${tagFields("couple.bride.tags", "성격태그", bride.tags)}
          ${imageField("couple.bride.photo", "신부 사진", bride.photo)}
        </fieldset>
        </div>
        <fieldset class="basic-pane guided-step" id="wedding-detail-settings" data-guided-step="wedding" data-step-requires="core"><legend>4. 예식 장소와 표시 정보</legend>
          <input type="hidden" name="wedding.date" value="${escapeAdminHtml(weddingDateInputValue(invitationData.wedding.date))}">
          <input type="hidden" name="wedding.venue" value="${escapeAdminHtml(invitationData.wedding.venue)}">
          <input type="hidden" name="wedding.hall" value="${escapeAdminHtml(invitationData.wedding.hall || "")}">
          <div class="auto-filled-fields" data-auto-summary="wedding"><strong data-auto-value="wedding.venue">${escapeAdminHtml(invitationData.wedding.venue)}</strong><span><i data-auto-value="wedding.hallDate">${escapeAdminHtml(invitationData.wedding.hall || "홀 정보 없음")} · ${escapeAdminHtml(invitationData.wedding.displayDate)}</i></span></div>
          ${select("wedding.displayDateFormat", "화면 표시 일시 형식", invitationData.wedding.displayDateFormat || "long_ko", [["long_ko", "2026. 10. 04. 일요일 오후 12시 20분"], ["short_ko", "26-10-04 (일) 12시 20분"], ["dot_numeric", "2026.10.04 (일) 12:20"], ["english", "2026. 10. 04. 일요일 · 12:20"], ["custom", "직접 입력"]])}
          ${input("wedding.displayDateCustom", "화면 표시 일시 · 선택 후 수정 가능", invitationData.wedding.displayDateCustom || invitationData.wedding.displayDate)}
          ${input("wedding.address", "주소", invitationData.wedding.address)}
          ${input("wedding.officialUrl", "식장 공식홈페이지 URL", invitationData.wedding.officialUrl || "", "url")}
          <div class="venue-actions">
            <button class="btn btn-primary" type="button" data-address-search>주소 검색</button>
          </div>
          <p class="admin-message" data-venue-status>등록된 식장은 이름을 입력하면 주소가 자동으로 채워집니다. 다른 식장은 주소 검색에서 지도 확인 또는 직접입력을 사용할 수 있습니다.</p>
          <div class="interlude-upload-admin">
            <strong>업로드 관리</strong>
            ${imageField("media.interludePhoto", "달력과 오시는 길 사이 사진", invitationData.media?.interludePhoto || "")}
          </div>
        </fieldset>
        <details class="editor-details basic-pane guided-step" open data-guided-step="accounts" data-step-requires="wedding"><summary>4. 계좌 안내</summary><div class="editor-details-body">
          ${textarea("sectionDescriptions.account", "계좌 안내 문구", invitationData.sectionDescriptions?.account || "참석이 어려우신 분들을 위해\n계좌번호를 안내해 드립니다.")}
          ${accountManager(invitationData.accounts)}
        </div></details>
        <details class="editor-details basic-pane guided-step" open data-guided-step="guestPhotos" data-step-requires="wedding"><summary>5. 공개기간과 하객앨범</summary><div class="editor-details-body">
          <div class="quick-input-grid">
            <label class="field"><span>청첩장 공개 시작일</span><input name="publicPeriod.openDate" type="date" value="${escapeAdminHtml(publicOpenValue)}" min="${escapeAdminHtml(publicToday)}" max="${escapeAdminHtml(publicOpenMax)}"></label>
            <label class="field"><span>청첩장 공개 종료일</span><input name="publicPeriod.closeDate" type="date" value="${escapeAdminHtml(publicCloseValue)}" min="${escapeAdminHtml(publicOpenValue)}" max="${escapeAdminHtml(publicCloseMax)}"></label>
            ${input("guestPhotos.eventDate", "하객 업로드 오픈 날짜", invitationData.guestPhotos?.eventDate || dateOnly(invitationData.wedding.date) || "", "date")}
            ${select("guestPhotos.previewVisible", "하객앨범 미리보기", String(invitationData.guestPhotos?.previewVisible ?? true), [["true", "표시"], ["false", "숨김"]])}
          </div>
          <p class="admin-message micro-help">공개 종료일은 예식일 기준 이후 3일까지만 설정할 수 있습니다. 이 값들은 각 일반관리자 계정의 청첩장에만 적용됩니다.</p>
        </div></details>
        ${isCopyFocus ? `<section class="copy-pane" data-copy-editor-panel>
          <div class="copy-editor-page">
            <div class="copy-editor-toolbar"><div><strong>편집 기능</strong><small>점선 영역을 누르면 아래 도구가 해당 영역에 맞게 바뀝니다.</small></div></div>
            ${editorDesignPanel()}
            <p class="admin-message copy-editor-guide">공개 청첩장에서 수정 가능한 영역만 점선으로 표시됩니다.</p>
            <button class="copy-frame-interaction-toggle" type="button" aria-pressed="false" data-copy-frame-toggle>
              <span class="copy-frame-toggle-label">수정모드</span>
              <span class="copy-frame-toggle-switch" aria-hidden="true"></span>
              <span class="copy-frame-toggle-state" data-copy-frame-toggle-state>OFF</span>
            </button>
            <div class="copy-editor-frame-scroll" data-copy-frame-scroll>
              <iframe class="copy-editor-public-frame" src="./index.html?copyEditorPreview=1&v=20260614-scroll3" title="공개 청첩장 문구 수정 미리보기" scrolling="yes" data-copy-editor-frame></iframe>
            </div>
            <aside class="copy-editor-drawer" data-copy-editor-drawer>
            <section class="copy-editor-section copy-editor-intro-settings">
              <p class="section-label">Intro Overlay</p><h2>진입 화면</h2>
              <p class="admin-message micro-help">링크 접속 직후 반투명 배경 위에서 이름이 타이핑되는 화면입니다.</p>
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
              ${textarea("invitation.paragraphs", "초대 문구", invitationData.invitation.paragraphs.join("\n\n"))}` : ""}`).join("")}
          ${textarea("sectionDescriptions.attendance", "참석 의사 안내 문구", invitationData.sectionDescriptions?.attendance || "신랑, 신부에게 참석의사를\n미리 전달할 수 있어요.")}
          ${textarea("sectionDescriptions.guestbook", "방명록 안내 문구", invitationData.sectionDescriptions?.guestbook || "따뜻한 마음을 짧게 남겨 주세요.")}
          ${textarea("sectionDescriptions.weddingSnap", "게스트앨범 안내 문구", invitationData.sectionDescriptions?.weddingSnap || "오늘의 추억은 여러분의 한 장에서 완성돼요.\n예식 당일, 아래 버튼으로 가볍게 공유해주세요!")}
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
          <p class="admin-message">표시할 섹션을 체크하고 화살표 버튼으로 순서를 정해 주세요.</p>
          <div class="section-order-columns">
            ${sectionOrderEditor("sectionSettings.preWedding", "결혼식 전까지", invitationData.sectionSettings?.preWedding, "preWedding")}
            ${sectionOrderEditor("sectionSettings.weddingDay", "결혼식당일 이후", invitationData.sectionSettings?.weddingDay, "weddingDay")}
          </div>
          <p class="admin-message micro-help">변경한 순서를 저장한 다음 미리보기 버튼을 눌러 주세요.</p>
        </div></details>
        <button class="btn btn-primary editor-save" id="editor-save">청첩장 저장</button>
      </form>
    </section>`;
  bindAdminNavigation();
  bindEditor();
  if (focus === "share") document.querySelector("#share-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (fields.get("appearance.design.heroDecoration")) next.appearance.design.heroDecoration = fields.get("appearance.design.heroDecoration");
    if (fields.get("appearance.design.heroDecorationTint")) next.appearance.design.heroDecorationTint = fields.get("appearance.design.heroDecorationTint");
    next.appearance.design.heroDecorationSize = Number(fields.get("appearance.design.heroDecorationSize") || next.appearance.design.heroDecorationSize || 100);
    next.appearance.design.heroDecorationStrokeWidth = Number(fields.get("appearance.design.heroDecorationStrokeWidth") || next.appearance.design.heroDecorationStrokeWidth || 3);
    next.appearance.design.heroDecorationYPercent = Number(fields.get("appearance.design.heroDecorationYPercent") || next.appearance.design.heroDecorationYPercent || 0);
  }
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
      media: ["hero.image", "hero.video"],
      people: ["couple.groom.phone", "couple.bride.phone", "couple.groom.photo", "couple.bride.photo"],
      wedding: ["wedding.address"],
      accounts: ["account.0.number", "account.1.number", "account.2.number", "account.3.number", "account.4.number", "account.5.number"],
      guestPhotos: ["guestPhotos.eventDate", "publicPeriod.openDate", "publicPeriod.closeDate"],
      sections: ["sectionSettings.preWedding", "sectionSettings.weddingDay"],
    };
    const hasValue = (name) => Boolean(form.elements[name]?.value?.trim?.());
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
      saveButtons.forEach((button) => { button.disabled = !(complete("core") && complete("wedding")); });
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
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
    preview.querySelector("[data-intro-preview-eyebrow]").textContent = form.elements["hero.introEyebrow"].value || invitationData.hero.eyebrow || "our wedding day";
    preview.querySelector("[data-intro-preview-name]").textContent = form.elements["hero.introName"].value || `${form.elements["couple.groom.name"].value} · ${form.elements["couple.bride.name"].value}`;
    preview.querySelector("[data-intro-preview-date]").textContent = form.elements["hero.introDate"].value || form.elements["wedding.displayDateCustom"].value;
  };
  copyEditor.querySelectorAll('[name^="hero.intro"]').forEach((field) => field.addEventListener("input", () => {
    if (field.type === "range") field.nextElementSibling.textContent = field.value;
    updateIntroDesignPreview();
  }));
  copyEditor.querySelector('[name="hero.introDesign.align"]')?.addEventListener("change", updateIntroDesignPreview);
  updateIntroDesignPreview();
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
  let activeInlineEditor = null;
  let frameDocumentRef = null;
  let refreshEditHandles = () => {};
  let syncFrameScrollHeight = () => {};
  const resetPreviewInteractionState = () => {
    frameDocumentRef?.querySelector("[data-copy-inline-editor]")?.dispatchEvent(new Event("blur"));
    frameDocumentRef?.querySelectorAll("[data-copy-edit-handle]").forEach((item) => item.remove());
    frameDocumentRef?.querySelectorAll(".copy-editable-target").forEach((item) => {
      item.classList.remove("copy-editable-target");
      item.removeAttribute("data-edit-label");
      delete item.dataset.editTargetIndex;
    });
    activeProfileTarget = "";
    activeTextTarget = null;
    activeInlineEditor = null;
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
    const frameDocument = frameDocumentRef;
    if (!frameDocument) return;
    const draft = previewDraft();
    const transportWrap = frameDocument.querySelector(".transport");
    if (transportWrap) {
      transportWrap.innerHTML = (draft.transport || [])
        .filter((item) => !item.hidden)
        .map((item) => `<div><strong>${escapeAdminHtml(item.title)}</strong>${escapeAdminHtml(item.text).replace(/\n/g, "<br>")}</div>`)
        .join("");
    }
    const notices = (draft.notices || []).filter((notice) => !notice.hidden && notice.text?.trim());
    const informationTabs = frameDocument.querySelector(".information-tabs");
    if (informationTabs) {
      informationTabs.setAttribute("data-information-index", "0");
      const tablist = informationTabs.querySelector(".information-tablist");
      if (tablist) {
        tablist.innerHTML = notices.map((notice, index) => `<button class="information-tab" type="button" role="tab" aria-selected="${index === 0}" data-information-tab="${index}">${escapeAdminHtml(notice.title)}</button>`).join("");
      }
      const informationPanel = informationTabs.querySelector("[data-information-panel]");
      if (informationPanel) {
        informationPanel.innerHTML = notices.length
          ? adminNoticeRowsHtml(notices[0])
          : '<div class="information-row"><p>표시할 식장 안내가 없습니다.</p></div>';
      }
    }
    const informationSection = frameDocument.querySelector("#information");
    if (informationSection) informationSection.hidden = notices.length === 0;
    frameDocument.querySelectorAll(".transport, .information-tabs").forEach((item) => item.classList.add("copy-editable-target"));
    refreshEditHandles();
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
  };
  const sectionIdMap = sectionRegistry.titleKeys || { invitation: "invitation", "about-us": "aboutUs", "wedding-day": "weddingDay", location: "location", gallery: "gallery", "wedding-snap": "weddingSnap", information: "information", attendance: "attendance", account: "account", guestbook: "guestbook" };
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
    if (target.matches("#wedding-snap .subtle")) return { name: "sectionDescriptions.weddingSnap", multiline: true };
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
    const targets = [activeTextTarget, activeInlineEditor?.field].filter((target) => target?.isConnected);
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
  const prepareTextSliders = (target) => {
    const name = inlineTarget(target)?.name;
    const saved = (name && invitationData.textStyles?.[name]) || null;
    const prevFontSize = target.style.getPropertyValue("font-size");
    const prevTransform = target.style.getPropertyValue("transform");
    target.style.removeProperty("font-size");
    target.style.removeProperty("transform");
    const defaultSize = Math.round(Number.parseFloat(frameDocumentRef?.defaultView?.getComputedStyle(target)?.fontSize || "16"));
    if (prevFontSize) target.style.setProperty("font-size", prevFontSize, "important");
    if (prevTransform) target.style.setProperty("transform", prevTransform, "important");
    target.dataset.originalTextSize = String(defaultSize);
    target.dataset.originalTextOffsetY = "0";
    target.dataset.originalTextOffsetX = "0";
    const currentSize = saved?.fontSize ? Math.round(saved.fontSize) : defaultSize;
    const currentOffset = saved?.offsetY ? Math.round(saved.offsetY) : 0;
    const currentOffsetX = saved?.offsetX ? Math.round(saved.offsetX) : 0;
    const sizeField = copyEditor.querySelector("[data-preview-text-size]");
    const yField = copyEditor.querySelector("[data-preview-text-y]");
    const xField = copyEditor.querySelector("[data-preview-text-x]");
    if (sizeField) sizeField.value = String(Math.max(Number(sizeField.min), Math.min(Number(sizeField.max), currentSize)));
    if (yField) yField.value = String(Math.max(Number(yField.min), Math.min(Number(yField.max), currentOffset)));
    if (xField) xField.value = String(Math.max(Number(xField.min), Math.min(Number(xField.max), currentOffsetX)));
    copyEditor.querySelector("[data-preview-text-size-output]")?.replaceChildren(String(sizeField?.value || currentSize));
    copyEditor.querySelector("[data-preview-text-y-output]")?.replaceChildren(String(yField?.value || currentOffset));
    copyEditor.querySelector("[data-preview-text-x-output]")?.replaceChildren(String(xField?.value || currentOffsetX));
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
  const currentHeroActiveMedia = () => {
    const video = form.elements["hero.video"]?.value?.trim();
    const selected = form.elements["hero.activeMedia"]?.value || "image";
    return selected === "video" && video ? "video" : "image";
  };
  const updateHeroMediaControls = () => {
    const image = form.elements["hero.image"]?.value?.trim() || "";
    const video = form.elements["hero.video"]?.value?.trim() || "";
    const hasBoth = Boolean(image && video);
    const active = currentHeroActiveMedia();
    form.querySelectorAll("[data-hero-active-media], [data-hero-dock-active]").forEach((item) => item.classList.toggle("is-hidden", !hasBoth));
    form.querySelectorAll('[name="hero.activeMedia"]').forEach((field) => { field.checked = field.value === active; });
    copyEditor.querySelectorAll("[data-hero-active]").forEach((button) => button.classList.toggle("is-active", button.dataset.heroActive === active));
    const imageThumb = copyEditor.querySelector("[data-hero-image-thumb]");
    if (imageThumb) imageThumb.style.backgroundImage = image ? `url("${adminMediaUrl(image).replace(/"/g, "%22")}")` : "";
    const videoThumb = copyEditor.querySelector("[data-hero-video-thumb]");
    if (videoThumb) videoThumb.textContent = video ? "VIDEO" : "＋";
    copyEditor.querySelector('[data-tool-action="hero-image"]')?.classList.toggle("has-media", Boolean(image));
    copyEditor.querySelector('[data-tool-action="hero-video"]')?.classList.toggle("has-media", Boolean(video));
    copyEditor.querySelector('[data-tool-action="hero-image"] strong')?.replaceChildren(image ? "이미지 등록됨" : "이미지 업로드");
    copyEditor.querySelector('[data-tool-action="hero-video"] strong')?.replaceChildren(video ? "영상 등록됨" : "영상 업로드");
    copyEditor.querySelector('[data-hero-media-actions="image"]')?.toggleAttribute("hidden", true);
    copyEditor.querySelector('[data-hero-media-actions="video"]')?.toggleAttribute("hidden", true);
  };
  const renderHeroFrameMedia = () => {
    if (!frameDocumentRef) return;
    const heroMedia = frameDocumentRef.querySelector(".hero-media");
    if (!heroMedia) return;
    const image = form.elements["hero.image"]?.value?.trim() || "";
    const video = form.elements["hero.video"]?.value?.trim() || "";
    const active = currentHeroActiveMedia();
    heroMedia.style.backgroundImage = image ? `url("${adminMediaUrl(image).replace(/"/g, "%22")}")` : "";
    heroMedia.dataset.activeMedia = active;
    heroMedia.innerHTML = active === "video" && video
      ? `<video class="hero-video" src="${escapeAdminHtml(adminMediaUrl(video))}" poster="${escapeAdminHtml(adminMediaUrl(image))}" autoplay muted loop playsinline preload="metadata"></video>`
      : "";
    refreshEditHandles();
  };
  const refreshFrameMedia = (target, url, type = "image") => {
    if (!frameDocumentRef) return;
    const mediaStyleText = url ? `url("${adminMediaUrl(url).replace(/"/g, "%22")}")` : "";
    if (target === "hero.image" || target === "hero.video") {
      updateHeroMediaControls();
      renderHeroFrameMedia();
    }
    if (target === "couple.groom.photo" || target === "couple.bride.photo") {
      const index = target === "couple.groom.photo" ? 0 : 1;
      const profilePhoto = frameDocumentRef.querySelectorAll(".profile-photo")[index];
      if (profilePhoto) profilePhoto.style.backgroundImage = mediaStyleText;
      refreshEditHandles();
    }
  };
  const updateFloatingSaveForToolDock = () => {
    const save = document.querySelector('.admin-floating-save[form="invitation-editor"]');
    if (!save || !toolPanel || toolPanel.hidden || toolPanel.dataset.context === "text-copy") {
      document.documentElement.style.removeProperty("--floating-save-bottom");
      return;
    }
    const panelHeight = Math.ceil(toolPanel.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--floating-save-bottom", toolPanel.classList.contains("is-collapsed")
      ? "calc(58px + env(safe-area-inset-bottom))"
      : `calc(${panelHeight}px + 8px + env(safe-area-inset-bottom))`);
  };
  const setToolDock = (title, help, activeTab = "media", context = "text") => {
    if (!toolPanel) return;
    toolPanel.hidden = false;
    toolPanel.classList.remove("is-collapsed");
    toolPanel.classList.toggle("is-manager", context === "information" || context === "location" || context === "wedding-snap-detail" || context === "rsvp-detail" || context === "hero-copy" || (context === "hero" && activeTab === "frame"));
    toolPanel.classList.toggle("is-hero", context === "hero");
    toolPanel.classList.toggle("is-profile", context === "profile");
    toolPanel.classList.toggle("is-copy", context === "hero-copy" || context === "text-copy");
    toolPanel.dataset.context = context;
    toolPanel.querySelector("[data-tooldock-title]").textContent = title;
    toolPanel.querySelector("[data-tooldock-help]").textContent = help;
    toolPanel.querySelectorAll("[data-tooldock-tab]").forEach((button) => {
      const tab = button.dataset.tooldockTab;
      const visible = context === "hero"
        ? ["media", "frame"].includes(tab)
        : context === "hero-copy"
          ? ["text", "position"].includes(tab)
        : context === "profile"
          ? tab === "media"
          : context === "gallery"
            ? tab === "media"
          : context === "information" || context === "location" || context === "wedding-snap-detail" || context === "rsvp-detail"
            ? tab === "items"
            : context === "text-copy"
              ? tab === "style"
              : false;
      button.hidden = !visible;
      button.classList.toggle("is-active", visible && tab === activeTab);
    });
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
    if (context === "information") autoResizeTextareas(noticeList);
    if (context === "location") autoResizeTextareas(transportList);
    updateFloatingSaveForToolDock();
  };
  const keepTextToolDockOpen = () => {
    if (!toolPanel || toolPanel.dataset.context !== "text-copy") return;
    toolPanel.hidden = false;
    toolPanel.classList.remove("is-collapsed");
    updateFloatingSaveForToolDock();
  };
  const closeTextToolDock = () => {
    if (!toolPanel || toolPanel.dataset.context !== "text-copy") return;
    toolPanel.hidden = true;
    activeTextTarget = null;
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
  const bindDesignControls = () => {
    const preset = form.elements.editorPresetId;
    const presetHidden = form.elements["appearance.design.presetId"];
    const textThemeHidden = form.elements["appearance.design.heroTextTheme"];
    preset?.addEventListener("change", () => {
      presetHidden.value = preset.value;
      refreshFrameAppearance();
    });
    copyEditor.querySelectorAll("[data-design-text-theme]").forEach((button) => button.addEventListener("click", () => {
      textThemeHidden.value = button.dataset.designTextTheme;
      copyEditor.querySelectorAll("[data-design-text-theme]").forEach((item) => item.classList.toggle("is-selected", item === button));
      setToolDock("메인 문구 테마", "가로로 밀어 문구 레이아웃을 고르고 저장해 주세요.", "text", "hero-copy");
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
        setToolDock("메인 이미지 꾸밈", "선택한 꾸밈이 미리보기에 바로 적용됩니다.", "frame", "hero");
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
    copyEditor.querySelectorAll("[data-hero-active]").forEach((button) => {
      button.addEventListener("click", () => {
        const radio = form.querySelector(`[name="hero.activeMedia"][value="${button.dataset.heroActive}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateHeroMediaControls();
        renderHeroFrameMedia();
      });
    });
    form.querySelectorAll('[name="hero.activeMedia"]').forEach((field) => {
      field.addEventListener("change", () => {
        updateHeroMediaControls();
        renderHeroFrameMedia();
      });
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
        if (action === "hero-video") {
          if (form.elements["hero.video"]?.value) {
            const actions = copyEditor.querySelector('[data-hero-media-actions="video"]');
            actions.hidden = !actions.hidden;
          } else triggerFileInput('[data-video-target="hero.video"]');
        }
        if (action === "hero-image-change") triggerFileInput('[data-image-target="hero.image"]');
        if (action === "hero-video-change") triggerFileInput('[data-video-target="hero.video"]');
        if (action === "hero-image-remove") triggerButton('[data-image-remove="hero.image"]');
        if (action === "hero-video-remove") triggerButton('[data-video-remove="hero.video"]');
        if (action === "profile-photo" && activeProfileTarget) triggerFileInput(`[data-image-target="${activeProfileTarget}"]`);
        if (action === "profile-crop" && activeProfileTarget) {
          toolPanel.classList.add("is-collapsed");
          openProfileCropEditor(activeProfileTarget, null);
        }
        if (action === "profile-remove" && activeProfileTarget) triggerButton(`[data-image-remove="${activeProfileTarget}"]`);
      });
    });
  };
  bindDesignControls();
  const onboarding = copyEditor.querySelector("[data-editor-onboarding]");
  const closeOnboarding = () => onboarding?.setAttribute("hidden", "");
  copyEditor.querySelector("[data-editor-start-close]")?.addEventListener("click", closeOnboarding);
  copyEditor.querySelector("[data-editor-theme-open]")?.addEventListener("click", () => onboarding?.removeAttribute("hidden"));
    copyEditor.querySelector("[data-editor-start-apply]")?.addEventListener("click", () => {
      closeOnboarding();
    });
  copyEditor.querySelectorAll("[data-onboarding-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      form.elements.editorPresetId.value = button.dataset.onboardingPreset;
      form.elements["appearance.design.presetId"].value = button.dataset.onboardingPreset;
      copyEditor.querySelectorAll("[data-onboarding-preset]").forEach((item) => item.classList.toggle("is-selected", item === button));
      refreshFrameAppearance();
    });
  });
  copyEditor.querySelectorAll("[data-onboarding-text-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      form.elements["appearance.design.heroTextTheme"].value = button.dataset.onboardingTextTheme;
      copyEditor.querySelectorAll("[data-onboarding-text-theme]").forEach((item) => item.classList.toggle("is-selected", item === button));
      copyEditor.querySelectorAll("[data-design-text-theme]").forEach((item) => item.classList.toggle("is-selected", item.dataset.designTextTheme === button.dataset.onboardingTextTheme));
      refreshFrameAppearance();
    });
  });
  // 레이아웃 변경 핸들러
  copyEditor.querySelectorAll("[data-editor-layout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const layoutId = button.dataset.editorLayout;
      const previousLayoutId = invitationData.designSystem.activeLayoutId || "classic";
      const previousActive = copyEditor.querySelector("[data-editor-layout].is-active");
      button.disabled = true;
      copyEditor.querySelectorAll("[data-editor-layout]").forEach((b) => b.classList.toggle("is-active", b === button));
      invitationData.designSystem.activeLayoutId = layoutId;
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
  copyEditor.querySelector("[data-copy-editor-frame]")?.addEventListener("load", (event) => {
    const frameElement = event.currentTarget;
    const frameDocument = frameElement.contentDocument;
    if (!frameDocument) return;
    frameDocumentRef = frameDocument;
    frameElement.classList.add("is-editor-ready");
    frameDocument.addEventListener("wheel", (wheelEvent) => {
      const frameWindow = frameElement.contentWindow;
      if (!frameWindow) return;
      const beforeY = frameWindow.scrollY;
      const maxY = Math.max(0, frameDocument.documentElement.scrollHeight - frameWindow.innerHeight);
      frameWindow.scrollBy({ left: wheelEvent.deltaX, top: wheelEvent.deltaY, behavior: "auto" });
      const afterY = frameWindow.scrollY;
      if ((beforeY !== afterY) || (beforeY > 0 && beforeY < maxY)) wheelEvent.preventDefault();
    }, { passive: false });
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
    const editableSelector = ".hero-media, .profile-card, .profile-photo, .hero-eyebrow, .hero-names, .hero-date, .section-label, .section-title, .location-venue, .location-hall, .location-address, .transport, .transport div, #gallery, .gallery-item, .information-tabs, .information-panel, #wedding-snap .subtle, #attendance .subtle, #account .subtle, #guestbook .subtle, .invitation-copy-group, .ending-content .preserve";
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
      frameDocument.querySelectorAll(".hero-media, .profile-card, .hero-eyebrow, .hero-names, .hero-date, .section-label, .section-title, .location-venue, .location-hall, .location-address, .transport, #gallery, .information-tabs, #wedding-snap .subtle, #attendance .subtle, #account .subtle, #guestbook .subtle, .invitation-copy-group, .ending-content .preserve").forEach((item) => {
        item.classList.add("copy-editable-target");
      });
      window.WEDDING_DESIGN?.applyTextStyles?.(invitationData, frameDocument);
      frameDocument.querySelector(".hero-media")?.setAttribute("data-edit-label", "메인 이미지·영상");
      frameDocument.querySelector(".hero-eyebrow")?.setAttribute("data-edit-label", "메인 영문문구");
      frameDocument.querySelector(".hero-date")?.setAttribute("data-edit-label", "메인 날짜");
      frameDocument.querySelectorAll(".section-label").forEach((item) => item.setAttribute("data-edit-label", "영문 타이틀"));
      frameDocument.querySelectorAll(".section-title").forEach((item) => item.setAttribute("data-edit-label", "국문 타이틀"));
      frameDocument.querySelector(".invitation-copy-group")?.setAttribute("data-edit-label", "초대글");
      frameDocument.querySelector(".location-venue")?.setAttribute("data-edit-label", "식장명");
      frameDocument.querySelector(".location-hall")?.setAttribute("data-edit-label", "홀 정보");
      frameDocument.querySelector(".location-address")?.setAttribute("data-edit-label", "주소");
      frameDocument.querySelector(".transport")?.setAttribute("data-edit-label", "교통 안내 항목");
      frameDocument.querySelector("#gallery")?.setAttribute("data-edit-label", "갤러리 사진");
      frameDocument.querySelector(".information-tabs")?.setAttribute("data-edit-label", "식장 안내 항목");
      frameDocument.querySelector("#wedding-snap .subtle")?.setAttribute("data-edit-label", "게스트앨범 안내 문구");
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
      const editableObserver = new MutationObserver(() => {
        if (isMarkingEditableAreas) return;
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
    const openInlineEditor = (target, config) => {
      if (activeInlineEditor?.field?.isConnected) activeInlineEditor.commit();
      else frameDocument.querySelector("[data-copy-inline-editor]")?.dispatchEvent(new Event("blur"));
      activeTextTarget = target;
      const storedText = config.name ? form.elements[config.name]?.value || "" : "";
      const originalText = (config.wholeParagraphs || (config.multiline && storedText)) ? storedText : [...target.childNodes]
        .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.matches("[data-copy-edit-handle]")))
        .map((node) => (node.nodeName === "BR" ? " " : node.textContent))
        .join("")
        .trim();
      const field = frameDocument.createElement(config.multiline ? "textarea" : "input");
      field.className = "copy-inline-editor";
      field.dataset.copyInlineEditor = "";
      field.value = originalText;
      if (config.multiline) field.rows = Math.max(2, originalText.split("\n").length);
      target.replaceWith(field);
      const update = () => {
        if (config.names) {
          const names = field.value.split(/[·ㆍ|/]/).map((item) => item.trim()).filter(Boolean);
          if (names[0]) syncField("couple.groom.name", names[0]);
          if (names[1]) syncField("couple.bride.name", names[1]);
        } else {
          syncField(config.name, field.value);
        }
      };
      field.addEventListener("input", update);
      const commit = () => {
        if (!field.isConnected) return;
        update();
        if (config.wholeParagraphs) {
          const group = target;
          group.replaceChildren();
          field.value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean).forEach((text) => {
            const paragraph = frameDocument.createElement("p");
            paragraph.className = "invitation-copy";
            paragraph.textContent = text;
            group.appendChild(paragraph);
          });
          field.replaceWith(target);
        } else {
          target.textContent = field.value;
          field.replaceWith(target);
        }
        activeTextTarget = target;
        refreshSelectedTextStyle();
        activeInlineEditor = null;
        safeMarkEditableAreas();
      };
      activeInlineEditor = { field, target, commit };
      field.addEventListener("blur", commit, { once: true });
      const frameWin = frameDocument.defaultView;
      const keepScroll = frameWin ? { x: frameWin.scrollX, y: frameWin.scrollY } : null;
      field.focus();
      field.select();
      setTimeout(() => {
        if (keepScroll && field.isConnected) frameWin?.scrollTo(keepScroll.x, keepScroll.y);
      }, 80);
    };
    frameDocument.addEventListener("click", (clickEvent) => {
      if (!copyEditor.classList.contains("is-frame-interaction-enabled")) {
        if (clickEvent.target.closest("a, button, input, select, textarea, label")) {
          clickEvent.preventDefault();
          clickEvent.stopImmediatePropagation();
        }
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
      const inlineField = clickEvent.target.closest("[data-copy-inline-editor]");
      if (inlineField) {
        keepTextToolDockOpen();
        return;
      }
      const target = handle ? handle.closest(editableSelector) : clickEvent.target.closest(editableSelector);
      if (!target || target.matches("[data-copy-inline-editor]")) {
        if (!target && toolPanel?.dataset.context === "text-copy") {
          closeTextToolDock();
          return;
        }
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
          setToolDock("메인 이미지", "이미지, 영상, 꾸밈, 메인문구테마를 아래 탭에서 수정합니다.", "media", "hero");
        } else {
          const fieldName = media === "groom" ? "couple.groom.photo" : "couple.bride.photo";
          activeProfileTarget = fieldName;
          toolPanel.dataset.profileSide = media;
          setToolDock(media === "groom" ? "신랑 대표이미지" : "신부 대표이미지", "사진 업로드 또는 영역 맞추기만 사용할 수 있습니다.", "media", "profile");
        }
        return;
      }
      if (target.matches(".hero-names")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = null;
        setToolDock("메인 문구 테마", "이름 문구의 테마와 위치를 조정합니다.", "text", "hero-copy");
        return;
      }
      const config = inlineTarget(target);
      if (config) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = target;
        setToolDock("문구 글자/위치", "문구는 그 자리에서 수정하고, 크기와 위치는 아래에서 미리 조정합니다.", "style", "text-copy");
        prepareTextSliders(target);
        openInlineEditor(target, config);
        requestAnimationFrame(keepTextToolDockOpen);
        return;
      }
      if (toolPanel?.dataset.context === "text-copy") closeTextToolDock();
      if (target.closest("#gallery")) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        activeProfileTarget = "";
        activeTextTarget = null;
        openGalleryModal();
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
  });
  copyEditor.addEventListener("pointerdown", (event) => {
    if (toolPanel?.dataset.context !== "text-copy") return;
    if (event.target.closest("[data-editor-tool-panel]") || event.target.closest("[data-copy-editor-frame]")) return;
    closeTextToolDock();
  }, true);
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
        if (fileInput.dataset.imageTarget === "hero.image") {
          const imageActive = form.querySelector('[name="hero.activeMedia"][value="image"]');
          if (imageActive) imageActive.checked = true;
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
  form.querySelectorAll("[data-video-target]").forEach((fileInput) => {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const label = fileInput.closest(".image-upload");
      label.firstChild.textContent = "업로드 중...";
      try {
        const url = await window.RSVP_STORAGE.uploadInvitationMedia(file, fileInput.dataset.videoTarget.replace(/\./g, "-"));
        form.elements[fileInput.dataset.videoTarget].value = url;
        if (fileInput.dataset.videoTarget === "hero.video") {
          const videoActive = form.querySelector('[name="hero.activeMedia"][value="video"]');
          if (videoActive) videoActive.checked = true;
        }
        form.querySelector(`[data-video-preview="${fileInput.dataset.videoTarget}"]`).innerHTML = `<video src="${escapeAdminHtml(adminMediaUrl(url))}" muted controls playsinline></video>`;
        refreshFrameMedia(fileInput.dataset.videoTarget, adminMediaUrl(url), "video");
        label.firstChild.textContent = "업로드 완료";
      } catch (error) {
        label.firstChild.textContent = "업로드 실패";
        alert(`영상을 업로드하지 못했습니다.\n${error.message || "파일 크기와 Storage 정책을 확인해 주세요."}`);
      }
    });
  });
  form.querySelectorAll("[data-video-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.videoRemove;
      form.elements[target].value = "";
      if (target === "hero.video") form.querySelector('[name="hero.activeMedia"][value="image"]')?.click();
      form.querySelector(`[data-video-preview="${target}"]`).innerHTML = "<span>등록된 영상이 없습니다.</span>";
      refreshFrameMedia(target, "", "video");
    });
  });
  form.querySelectorAll("[data-image-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.imageRemove;
      form.elements[target].value = "";
      if (form.elements[`${target}Original`]) form.elements[`${target}Original`].value = "";
      if (form.elements[`${target}Crop`]) form.elements[`${target}Crop`].value = "";
      if (target === "hero.image" && form.elements["hero.video"]?.value) form.querySelector('[name="hero.activeMedia"][value="video"]')?.click();
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
      const keepFocus = document.querySelector(".admin-editor-view")?.classList.contains("view-copy") ? "copy"
        : document.querySelector(".admin-editor-view")?.classList.contains("view-share") ? "share"
          : document.querySelector(".admin-editor-view")?.classList.contains("view-gallery") ? "gallery"
            : document.querySelector(".admin-editor-view")?.classList.contains("view-sections") ? "sections"
            : "";
      if (activeInlineEditor?.field?.isConnected) activeInlineEditor.commit();
      else copyEditor.querySelector("[data-copy-editor-frame]")?.contentDocument?.querySelector("[data-copy-inline-editor]")?.dispatchEvent(new Event("blur"));
      syncEditorPublicPeriod();
      invitationData = editorData(form);
      applyAppearance(invitationData.appearance);
      await window.RSVP_STORAGE.saveInvitationData(invitationData);
      renderEditor("저장했습니다. 현재 편집 화면에 계속 머무릅니다.", keepFocus);
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
  const { error } = await client.auth.signInWithPassword({
    email,
    password: form.get("password"),
  });
  if (error) return renderLogin("가입되지 않은 ID이거나 ID/비밀번호가 일치하지 않습니다. 처음 이용하신다면 회원가입을 진행해 주세요.");
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

const ADMIN_SAVED_GUEST_PHOTOS_KEY = "wedding-admin-saved-guest-photos";
const isGuestVideo = (photo = {}) => /\.(mp4|webm|mov)(?:$|[?#])/i.test(photo.name || photo.path || "");
const guestPhotoPreviewUrl = (photo = {}) => photo.thumbSignedUrl || "";
const savedGuestPhotosKey = () => `${ADMIN_SAVED_GUEST_PHOTOS_KEY}:${window.RSVP_STORAGE.getActiveInvitationSlug()}`;

function savedGuestPhotoPaths() {
  try { return new Set(JSON.parse(localStorage.getItem(savedGuestPhotosKey()) || "[]")); }
  catch { return new Set(); }
}

function rememberSavedGuestPhotos(photos) {
  const saved = savedGuestPhotoPaths();
  photos.forEach((photo) => saved.add(photo.path));
  localStorage.setItem(savedGuestPhotosKey(), JSON.stringify([...saved]));
}

function guestPhotoCards(photos, saved = false) {
  return photos.length ? photos.map((photo) => `
    <article class="private-photo ${saved ? "is-saved" : "is-new"}">
      <a href="${escapeAdminHtml(photo.signedUrl)}" target="_blank" rel="noopener" download>
      ${isGuestVideo(photo)
        ? '<span class="private-video-file"><strong>VIDEO</strong><small>저장해서 확인하기</small></span>'
        : guestPhotoPreviewUrl(photo)
          ? `<img src="${escapeAdminHtml(guestPhotoPreviewUrl(photo))}" alt="하객이 업로드한 사진" loading="lazy" decoding="async">`
          : '<span class="private-video-file"><strong>IMAGE</strong><small>원본으로 확인하기</small></span>'}
      <span>${escapeAdminHtml(formatDate(photo.created_at))}</span>
      </a>
      <div class="private-photo-actions">
        <a class="icon-btn" href="${escapeAdminHtml(photo.signedUrl)}" download aria-label="파일 하나 저장" title="저장"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5zM8 4v6h8V4m-7 11h6v5H9z"/></svg></a>
        <button class="icon-btn" type="button" data-admin-remove-photo="${escapeAdminHtml(photo.path)}" aria-label="파일 삭제" title="삭제">×</button>
      </div>
    </article>`).join("") : `<p class="admin-message">${saved ? "아직 저장 처리한 파일이 없습니다." : "새로 저장할 파일이 없습니다."}</p>`;
}

const zipCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  bytes.forEach((byte) => { value = zipCrcTable[(value ^ byte) & 0xff] ^ (value >>> 8); });
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function writeZipNumber(view, offset, value, bytes) {
  for (let index = 0; index < bytes; index += 1) view.setUint8(offset + index, (value >>> (index * 8)) & 0xff);
}

function safeZipName(photo, index) {
  const fallback = `guest-file-${String(index + 1).padStart(3, "0")}`;
  return String(photo.name || photo.path?.split("/").pop() || fallback).replace(/[\\/:*?"<>|]+/g, "_") || fallback;
}

async function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const { time, date } = dosDateTime(file.date);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeZipNumber(localView, 0, 0x04034b50, 4);
    writeZipNumber(localView, 4, 20, 2);
    writeZipNumber(localView, 10, time, 2);
    writeZipNumber(localView, 12, date, 2);
    writeZipNumber(localView, 14, crc, 4);
    writeZipNumber(localView, 18, file.bytes.length, 4);
    writeZipNumber(localView, 22, file.bytes.length, 4);
    writeZipNumber(localView, 26, nameBytes.length, 2);
    local.set(nameBytes, 30);
    localParts.push(local, file.bytes);
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeZipNumber(centralView, 0, 0x02014b50, 4);
    writeZipNumber(centralView, 4, 20, 2);
    writeZipNumber(centralView, 6, 20, 2);
    writeZipNumber(centralView, 12, time, 2);
    writeZipNumber(centralView, 14, date, 2);
    writeZipNumber(centralView, 16, crc, 4);
    writeZipNumber(centralView, 20, file.bytes.length, 4);
    writeZipNumber(centralView, 24, file.bytes.length, 4);
    writeZipNumber(centralView, 28, nameBytes.length, 2);
    writeZipNumber(centralView, 42, offset, 4);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + file.bytes.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeZipNumber(endView, 0, 0x06054b50, 4);
  writeZipNumber(endView, 8, files.length, 2);
  writeZipNumber(endView, 10, files.length, 2);
  writeZipNumber(endView, 12, centralSize, 4);
  writeZipNumber(endView, 16, offset, 4);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

async function downloadGuestPhotos(photos, button) {
  if (!photos.length) return alert("저장할 파일이 없습니다.");
  button.disabled = true;
  const original = button.textContent;
  button.textContent = `${photos.length}개 다운로드 준비 중...`;
  try {
    for (let index = 0; index < photos.length; index += 1) {
      button.textContent = `${photos.length}개 중 ${index + 1}개 다운로드 열기...`;
      const link = document.createElement("a");
      link.href = photos[index].signedUrl;
      link.download = safeZipName(photos[index], index);
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
    button.disabled = false;
    button.textContent = original;
    if (!confirm("파일 저장을 완료했나요?\n저장 완료를 누르면 해당 파일이 '이미 저장한 파일'로 이동합니다.\n저장을 취소했다면 [취소]를 눌러 주세요.")) return;
    rememberSavedGuestPhotos(photos);
    await renderGuestPhotos();
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    alert(`파일 다운로드를 열지 못했습니다.\n${error.message || "잠시 후 다시 시도해 주세요."}`);
  }
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

function renderMusicSettingsView(files) {
  const music = invitationData.music || {};
  const enabled = music.enabled !== false;
  const currentSrc = String(music.src || "").trim();
  const volume = Number.isFinite(Number(music.volume)) ? Number(music.volume) : 0.45;
  const hasLibrary = files.length > 0;
  const inLibrary = files.some((file) => file.src === currentSrc);
  const options = [
    `<option value="">사용 안 함 (선택 없음)</option>`,
    ...files.map((file) => `<option value="${escapeAdminHtml(file.src)}" ${file.src === currentSrc ? "selected" : ""}>${escapeAdminHtml(file.name)}</option>`),
    `<option value="__custom__" ${currentSrc && !inLibrary ? "selected" : ""}>직접 경로 입력…</option>`,
  ].join("");
  adminApp.innerHTML = `
    ${adminHeader("content")}
    ${contentBackBar("배경음악")}
    <section class="admin-card">
      <h2>배경음악</h2>
      <p class="admin-message">진입 화면이 끝난 뒤 자동으로 재생됩니다. (브라우저 정책상 첫 화면 터치 후 소리가 켜질 수 있어요.)</p>
      <p class="admin-message micro-help">음악 파일을 프로젝트의 <code>source/music</code> 폴더에 넣고 배포하면 아래 목록에 자동으로 나타납니다. 지원 형식: mp3, m4a, aac, ogg, wav.</p>
      <form data-music-form>
        <label class="toggle-row">
          <input type="checkbox" name="music.enabled" ${enabled ? "checked" : ""}>
          <span>배경음악 사용</span>
        </label>
        <label class="field">
          <span>음악 파일 선택</span>
          <select name="music.choice" data-music-choice>${options}</select>
        </label>
        ${hasLibrary ? "" : `<p class="admin-message micro-help">현재 <code>source/music</code> 폴더에서 음악 파일을 찾지 못했습니다. 파일을 넣고 배포하거나, 아래에 경로를 직접 입력해 주세요.</p>`}
        <label class="field" data-music-custom-row ${currentSrc && !inLibrary ? "" : "hidden"}>
          <span>직접 경로 입력</span>
          <input type="text" name="music.src" data-music-src value="${escapeAdminHtml(currentSrc && !inLibrary ? currentSrc : "")}" placeholder="예: source/music/wedding.mp3">
        </label>
        <label class="field">
          <span>기본 음량 (<output data-music-volume-output>${volume.toFixed(2)}</output>)</span>
          <input type="range" name="music.volume" data-music-volume min="0" max="1" step="0.05" value="${volume}">
        </label>
        <div class="image-actions">
          <button class="btn" type="button" data-music-preview>▶ 미리듣기</button>
          <button class="btn btn-primary" type="submit">저장</button>
        </div>
        <audio data-music-audio preload="none"></audio>
        <p class="admin-message micro-help" data-music-status></p>
      </form>
    </section>`;
  bindAdminNavigation();
  bindMusicSettings(files);
}

function bindMusicSettings(files) {
  const form = adminApp.querySelector("[data-music-form]");
  if (!form) return;
  const choice = form.querySelector("[data-music-choice]");
  const customRow = form.querySelector("[data-music-custom-row]");
  const customInput = form.querySelector("[data-music-src]");
  const volumeInput = form.querySelector("[data-music-volume]");
  const volumeOutput = form.querySelector("[data-music-volume-output]");
  const audio = form.querySelector("[data-music-audio]");
  const previewButton = form.querySelector("[data-music-preview]");
  const status = form.querySelector("[data-music-status]");

  const resolveSrc = () => {
    if (choice.value === "__custom__") return customInput.value.trim();
    return choice.value;
  };

  choice.addEventListener("change", () => {
    customRow.toggleAttribute("hidden", choice.value !== "__custom__");
  });
  volumeInput.addEventListener("input", () => {
    volumeOutput.textContent = Number(volumeInput.value).toFixed(2);
    if (audio) audio.volume = Math.max(0, Math.min(1, Number(volumeInput.value) || 0));
  });

  previewButton.addEventListener("click", () => {
    const src = resolveSrc();
    if (!src) {
      status.textContent = "재생할 음악을 선택하거나 경로를 입력해 주세요.";
      return;
    }
    if (!audio.paused && audio.dataset.src === src) {
      audio.pause();
      previewButton.textContent = "▶ 미리듣기";
      return;
    }
    audio.src = adminMediaUrl(src);
    audio.dataset.src = src;
    audio.volume = Math.max(0, Math.min(1, Number(volumeInput.value) || 0));
    audio.play()
      .then(() => { previewButton.textContent = "⏸ 멈춤"; status.textContent = ""; })
      .catch((error) => { status.textContent = `미리듣기를 재생하지 못했습니다. (${error?.message || "파일 경로 확인"})`; });
  });
  audio.addEventListener("ended", () => { previewButton.textContent = "▶ 미리듣기"; });
  audio.addEventListener("pause", () => { previewButton.textContent = "▶ 미리듣기"; });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const src = resolveSrc();
    const next = {
      enabled: form.querySelector('[name="music.enabled"]').checked,
      src,
      volume: Math.max(0, Math.min(1, Number(volumeInput.value) || 0)),
    };
    const previous = invitationData.music;
    invitationData.music = { ...(invitationData.music || {}), ...next };
    submitButton.disabled = true;
    status.textContent = "저장 중…";
    try {
      await window.RSVP_STORAGE.saveInvitationData(invitationData);
      status.textContent = "저장했습니다. 청첩장에서 진입 화면 이후 재생됩니다.";
    } catch (error) {
      invitationData.music = previous;
      status.textContent = "";
      notifySaveFailure(error, "배경음악을 저장");
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function renderMusicSettings() {
  rememberAdminView("music");
  adminApp.innerHTML = `
    ${adminHeader("content")}
    ${contentBackBar("배경음악")}
    <section class="admin-card">
      <h2>배경음악</h2>
      <p class="admin-message">음악 파일 목록을 불러오는 중입니다…</p>
    </section>`;
  bindAdminNavigation();
  const files = await fetchMusicLibrary();
  renderMusicSettingsView(files);
}

async function renderGuestPhotos() {
  rememberAdminView("photos");
  adminApp.innerHTML = `
    ${adminHeader("photos")}
    ${contentBackBar("하객 사진·영상")}
    <section class="admin-card">
      <h2>하객 사진·영상</h2>
      <p class="admin-message">하객이 보내준 파일을 불러오고 있습니다.</p>
    </section>`;
  bindAdminNavigation();
  try {
    const photos = await window.RSVP_STORAGE.listGuestPhotos();
    const savedPaths = savedGuestPhotoPaths();
    const newPhotos = photos.filter((photo) => !savedPaths.has(photo.path));
    const savedPhotos = photos.filter((photo) => savedPaths.has(photo.path));
    adminApp.innerHTML = `
      ${adminHeader("photos")}
      ${contentBackBar("하객 사진·영상")}
      <section class="admin-card">
        <div class="admin-toolbar"><h2>하객 사진·영상</h2><span class="badge">${photos.length}개</span></div>
        <p class="admin-message">저장 여부는 이 관리자 브라우저에 기록됩니다. 다른 기기에서는 새 파일로 표시될 수 있습니다.</p>
        <div class="guest-photo-admin-actions">
          <button class="btn btn-primary" type="button" data-download-new-guest-photos>새 파일만 전체 저장 (${newPhotos.length})</button>
          <button class="btn" type="button" data-download-all-guest-photos>모든 파일 전체 저장 (${photos.length})</button>
        </div>
        <section class="guest-photo-admin-group"><h3>새로 업로드된 파일 <span class="badge">${newPhotos.length}개</span></h3><div class="private-photo-grid">${guestPhotoCards(newPhotos)}</div></section>
        <section class="guest-photo-admin-group"><h3>이미 저장한 파일 <span class="badge">${savedPhotos.length}개</span></h3><div class="private-photo-grid">${guestPhotoCards(savedPhotos, true)}</div></section>
      </section>`;
    bindAdminNavigation();
    document.querySelector("[data-download-new-guest-photos]")?.addEventListener("click", (event) => downloadGuestPhotos(newPhotos, event.currentTarget));
    document.querySelector("[data-download-all-guest-photos]")?.addEventListener("click", (event) => downloadGuestPhotos(photos, event.currentTarget));
    document.querySelectorAll("[data-admin-remove-photo]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("이 파일을 삭제할까요?")) return;
        button.disabled = true;
        button.textContent = "…";
        try {
          await window.RSVP_STORAGE.removeGuestPhoto(button.dataset.adminRemovePhoto);
          await renderGuestPhotos();
        } catch {
          button.disabled = false;
          button.textContent = "×";
          alert("파일을 삭제하지 못했습니다.");
        }
      });
    });
  } catch (error) {
    console.error("[renderGuestPhotos]", error);
    adminApp.innerHTML = `
      ${adminHeader("photos")}
      ${contentBackBar("하객 사진·영상")}
      <section class="admin-card"><p class="admin-message">파일을 불러오지 못했습니다. Storage 정책을 확인해 주세요.</p><p class="admin-message micro-help">${escapeAdminHtml(error.message || "")}</p></section>`;
    bindAdminNavigation();
  }
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
    adminApp.innerHTML = `${adminHeader("guestbook")}${contentBackBar("방명록")}<section class="admin-card"><p class="admin-message">방명록을 불러오지 못했습니다. 최신 supabase-setup.sql을 다시 실행해 주세요.</p><p class="admin-message micro-help">${escapeAdminHtml(error.message || "방명록 조회 권한을 확인해 주세요.")}</p></section>`;
    bindAdminNavigation();
  }
}

async function start() {
  if (!window.INVITATION_DATA) return renderDependencyNotice("기본 청첩장 데이터 스크립트를 불러오지 못했습니다.");
  if (!window.RSVP_STORAGE?.loadInvitationData) return renderDependencyNotice("저장소 스크립트를 불러오지 못했습니다.");
  applyAppearance(invitationData.appearance);
  const client = getAdminSupabaseClient();
  if (!client) return renderLogin("로그인 서버 연결을 준비하고 있습니다. 화면이 열렸다면 잠시 후 로그인해 주세요.");
  bindPasswordRecoveryListener(client);
  const { data } = await client.auth.getSession();
  if (hasPasswordRecoveryContext()) return renderPasswordReset();
  if (!data.session) return renderLogin();
  currentInvitationSite = await window.RSVP_STORAGE.getCurrentInvitationSite();
  if (!currentInvitationSite?.slug) return renderBasicInfoOnboarding();
  if (currentInvitationSite.disabled) return renderLogin("비활성화된 일반관리자입니다. 사이트 관리자에게 문의해 주세요.");
  await loadInvitationData();
  renderAdminView(localStorage.getItem(GENERAL_ADMIN_VIEW_KEY) || "editor");
}

start().catch((error) => {
  console.error("[admin start]", error);
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
