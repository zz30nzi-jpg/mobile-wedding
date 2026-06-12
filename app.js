let data = window.INVITATION_DATA;
const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");

function redirectOAuthCallbackToAdmin() {
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const hasAuthCallback = params.has("code") || params.has("error") || hashParams.has("access_token") || hashParams.has("refresh_token") || hashParams.has("error");
  const hasCardContext = params.has("card") || params.has("invitation") || params.has("__layout") || params.has("__thumb") || params.has("previewSectionMode") || params.has("copyEditorPreview");
  if (hasAuthCallback && !hasCardContext) {
    location.replace(`${location.origin}/admin.html${location.search}${location.hash}`);
  }
}

redirectOAuthCallbackToAdmin();

async function redirectSignedInAdminFromRoot() {
  const params = new URLSearchParams(location.search);
  const hasCardContext = params.has("card") || params.has("invitation") || params.has("__layout") || params.has("__thumb") || params.has("previewSectionMode") || params.has("copyEditorPreview");
  const isRootInvitationPage = ["/", "/index.html"].includes(location.pathname);
  if (!isRootInvitationPage || hasCardContext) return;
  try {
    const client = window.RSVP_STORAGE?.getSupabaseClient?.();
    const { data: sessionData } = client ? await client.auth.getSession() : { data: {} };
    const user = sessionData.session?.user;
    if (user && !user.is_anonymous) location.replace(`${location.origin}/admin.html`);
  } catch {}
}

redirectSignedInAdminFromRoot();

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const escapeLineHtml = (value = "") => escapeHtml(value).replace(/\n/g, "<br>");
const mediaUrl = (src = "") => window.RSVP_STORAGE?.mediaPublicUrl?.(src) || src || "";
const mediaStyle = (src) => mediaUrl(src) ? `style="background-image:url('${escapeHtml(mediaUrl(src))}')"` : "";
const lazyMediaStyle = (src) => mediaUrl(src) ? `data-lazy-background="${escapeHtml(mediaUrl(src))}"` : "";
const heroActiveMedia = () => data.hero.activeMedia === "video" && data.hero.video ? "video" : "image";
const heroMediaMarkup = () => heroActiveMedia() === "video"
  ? `<video class="hero-video" src="${escapeHtml(mediaUrl(data.hero.video))}" poster="${escapeHtml(mediaUrl(data.hero.image))}" autoplay muted loop playsinline preload="metadata" onerror="this.hidden=true"></video>`
  : "";
const tel = (number) => `tel:${String(number).replace(/[^0-9+]/g, "")}`;
const isVideoMedia = (value = "") => /\.(mp4|webm|mov)(?:$|[?#])/i.test(value);
const tmapWebUrl = (query) => `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${query}`;
const tmapAppUrl = (query) => `tmap://search?name=${query}`;
const mapLinksForAddress = (address = "") => {
  const query = encodeURIComponent(address.trim());
  return [
    { label: "네이버 지도", app: "naver", url: `https://map.naver.com/p/search/${query}` },
    { label: "카카오맵", app: "kakao", url: `https://map.kakao.com/link/search/${query}` },
    { label: "티맵", app: "tmap", url: tmapAppUrl(query), fallbackUrl: tmapWebUrl(query) },
  ];
};
function weddingDisplayDateText(value, format = "long_ko") {
  if (!value) return "";
  const date = new Date(value);
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

function normalizeWeddingDisplayDate() {
  const wedding = data.wedding || {};
  const format = wedding.displayDateFormat || "long_ko";
  if (format === "custom") {
    data.wedding.displayDate = wedding.displayDateCustom || wedding.displayDate || weddingDisplayDateText(wedding.date);
    return;
  }
  data.wedding.displayDate = weddingDisplayDateText(wedding.date, format) || wedding.displayDate || "";
}
let weddingDate;
let guestbookEntries = [];
let galleryPreviewImages = [];
const themes = ["beige", "sky", "pink", "gray", "black", "white", "green"];
const movieConcepts = ["none", "about_time", "la_la_land", "spirited_away", "you_are_the_apple"];
const heroDecorations = ["none", "doodle_hearts", "organic_heart", "wedding_rings", "poster_card"];
const heroTextThemes = ["auto", "default_center", "editorial_left", "minimal_center"];
const defaultSectionSettings = {
  preWedding: ["invitation", "about-us", "wedding-day", "location", "gallery", "wedding-snap", "information", "attendance", "account", "guestbook"],
  weddingDay: ["invitation", "about-us", "wedding-day", "location", "gallery", "wedding-snap", "information", "attendance", "account", "guestbook"],
};

function applyTheme(theme) {
  const selected = themes.includes(theme) ? theme : "sky";
  document.body.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--body-bg").trim());
}

function applyMovieConcept(movieConcept) {
  document.body.dataset.movieConcept = movieConcepts.includes(movieConcept) ? movieConcept : "none";
}

function applyHeroDecoration(heroDecoration) {
  const legacyDecorations = { line_frame: "doodle_hearts", heart_frame: "organic_heart" };
  const selected = legacyDecorations[heroDecoration] || heroDecoration;
  document.body.dataset.heroDecoration = heroDecorations.includes(selected) ? selected : "none";
}

function applyHeroTextTheme(heroTextTheme) {
  document.body.dataset.heroTextTheme = heroTextThemes.includes(heroTextTheme) ? heroTextTheme : "auto";
}

function applyAppearance(appearance = {}) {
  if (window.WEDDING_DESIGN) return window.WEDDING_DESIGN.apply(data);
  const legacyPoster = appearance.heroDecoration === "poster";
  applyTheme(appearance.theme);
  applyMovieConcept(appearance.movieConcept);
  applyHeroDecoration(legacyPoster ? "none" : appearance.heroDecoration);
  applyHeroTextTheme(legacyPoster && (!appearance.heroTextTheme || appearance.heroTextTheme === "auto") ? "editorial_left" : appearance.heroTextTheme);
}

function setMetaProperty(property, content) {
  if (!content) return;
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function updateSocialMeta() {
  const invitationText = data.invitation?.paragraphs?.join(" ") || data.meta.description;
  const description = `${data.wedding.displayDate} · ${data.wedding.venue} · ${invitationText}`.slice(0, 180);
  setMetaProperty("og:title", data.meta.title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:url", location.href);
  setMetaProperty("og:image", mediaUrl(data.meta.shareImage || data.hero.image));
}

function sectionHeader(label, title) {
  return `<p class="section-label">${escapeHtml(label)}</p><h2 class="section-title single-line-fit">${escapeHtml(title)}</h2>`;
}

function sectionCopy(key, label, title) {
  const configured = data.sectionTitles?.[key] || {};
  return sectionHeader(configured.en || label, configured.ko || title);
}

function weddingDayTitleMarkup() {
  const configured = data.sectionTitles?.weddingDay || {};
  const label = configured.en || "Wedding Day";
  const title = configured.ko || data.wedding.displayDate;
  return sectionHeader(label, title);
}

function venueParts() {
  const venue = String(data.wedding.venue || "").trim();
  const configuredHall = String(data.wedding.hall || "").trim();
  if (configuredHall) {
    const cleanVenue = venue.replace(new RegExp(`\\s*${configuredHall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim();
    return { venue: cleanVenue || venue, hall: configuredHall };
  }
  const match = venue.match(/^(.*?)(?:\s+)((?:B?\d+\s*F|지하\s*\d+층|\d+층)\b.*)$/i);
  return match ? { venue: match[1], hall: match[2] } : { venue, hall: "" };
}

function fitSingleLineText() {
  document.querySelectorAll(".single-line-fit").forEach((element) => {
    element.style.fontSize = "";
    let size = parseFloat(getComputedStyle(element).fontSize);
    while (element.scrollWidth > element.clientWidth && size > 7) {
      size -= 0.5;
      element.style.setProperty("font-size", `${size}px`, "important");
    }
  });
}

function renderDayStrip() {
  if (!weddingDate) return "";
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  let cells = "";
  for (let off = -2; off <= 2; off++) {
    const d = new Date(weddingDate);
    d.setDate(weddingDate.getDate() + off);
    const isWed = off === 0;
    cells += `<div class="day-cell${isWed ? " day-wedding" : ""}">
      <span class="day-week">${weekdays[d.getDay()]}</span>
      <span class="day-num">${d.getDate()}</span>
    </div>`;
  }
  return `<div class="day-strip-wrap">
    <div class="day-strip-month">${months[weddingDate.getMonth()]}</div>
    <div class="day-strip">${cells}</div>
  </div>`;
}

function renderCalendar() {
  const year = weddingDate.getFullYear();
  const month = weddingDate.getMonth();
  const day = weddingDate.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDay).fill("").concat(Array.from({ length: lastDate }, (_, index) => index + 1));
  while (cells.length % 7) cells.push("");
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return `
    <table class="calendar">
      <caption>${year}. ${String(month + 1).padStart(2, "0")}</caption>
      <thead><tr>${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<th>${item}</th>`).join("")}</tr></thead>
      <tbody>${weeks.map((week) => `<tr>${week.map((item) => `<td class="${item === day ? "wedding-day" : ""}">${item === day ? `<span>${item}</span>` : item}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

function renderAccounts(side) {
  const rows = data.accounts.filter((account) => account.side === side && (account.name || account.personName || account.relation || account.bank || account.number));
  if (!rows.length) return "";
  const accountNumberText = (value = "") => {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits || raw.includes("-") || digits.length < 8) return raw;
    if (digits.length <= 10) return digits.replace(/(\d{3})(\d{2,3})(\d+)/, "$1-$2-$3");
    if (digits.length <= 12) return digits.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3");
    return digits.replace(/(\d{3})(\d{4})(\d{4})(\d+)/, "$1-$2-$3-$4");
  };
  return `
    <details>
      <summary>${escapeHtml(side)} 계좌번호</summary>
      ${rows.map((account) => `
        <div class="account-row">
          <p><strong>${escapeHtml(account.name || account.personName || "")}${account.relation ? ` · ${escapeHtml(account.relation)}` : ""}</strong><br>${account.bank && account.number ? `${escapeHtml(account.bank)} ${escapeHtml(accountNumberText(account.number))}` : '<span class="account-pending">계좌번호 준비 중</span>'}</p>
          ${account.bank && account.number ? `<button class="account-copy-btn copy-btn" type="button" data-copy="${escapeHtml(account.bank)} ${escapeHtml(accountNumberText(account.number))}" aria-label="계좌번호 복사" title="계좌번호 복사"><span aria-hidden="true">⧉</span></button>` : ""}
        </div>`).join("")}
    </details>`;
}

function parentDisplay(person = {}) {
  const parents = String(person.parents || "").split("·").map((item) => item.trim()).filter(Boolean).join(" · ");
  if (!parents) return "";
  const relation = String(person.relation || "").trim();
  return [parents, relation].filter(Boolean).join(" ");
}

function hasAnyParent(person = {}) {
  return String(person.parents || "").split("·").map((item) => item.trim()).filter(Boolean).length >= 1;
}

function invitationParentLine(role, person = {}) {
  const parentText = parentDisplay(person);
  const name = String(person.name || "").trim();
  if (!name) return "";
  return `<span>${parentText ? `${escapeHtml(parentText)} ` : ""}<strong>${escapeHtml(name)}</strong></span>`;
}

function todayInputDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function publicPeriodStatus() {
  if (isCopyEditorPreview) return { visible: true };
  const today = todayInputDate();
  const openDate = String(data.publicPeriod?.openDate || "").slice(0, 10);
  const closeDate = String(data.publicPeriod?.closeDate || "").slice(0, 10);
  if (openDate && today < openDate) {
    return { visible: false, title: "아직 공개 전입니다", text: `청첩장은 ${openDate}부터 확인할 수 있어요.` };
  }
  if (closeDate && today > closeDate) {
    return { visible: false, title: "공개 기간이 종료되었습니다", text: `청첩장 공개 종료일은 ${closeDate}입니다.` };
  }
  return { visible: true };
}

function guestPhotoStatus() {
  const settings = data.guestPhotos || {};
  const today = todayInputDate();
  return {
    canUpload: settings.previewVisible || today === settings.eventDate,
    showSection: settings.previewVisible || today >= settings.eventDate,
  };
}

function galleryImages() {
  return data.gallery.filter(Boolean).slice(0, 30);
}

function galleryThumbAt(index) {
  return data.galleryThumbs?.[index] || data.gallery[index] || "";
}

function shuffledGalleryPreview(images) {
  const shuffled = [...images];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  // 벨벳나이트(crimson_silk)는 큰 미리보기 1장 + 3열 그리드 2줄(6장)로 정렬되도록 7장을 사용한다.
  const count = document.body.dataset.layout === "crimson_silk" ? 7 : 6;
  return shuffled.slice(0, count);
}

function probeImageOrientation(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > img.naturalHeight ? "landscape" : "portrait");
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// 스칼렛데이(editorial_red) 매거진 갤러리: 1·6번 프레임은 가로형(16:9)이라
// 가로형 사진만 배치하고, 가로형 사진이 없으면 해당 프레임을 세로형으로 대체한다.
async function arrangeEditorialGallery() {
  if (document.body.dataset.layout !== "editorial_red") return;
  const grid = document.querySelector("#gallery .gallery-grid");
  const items = grid ? [...grid.querySelectorAll(".gallery-item")] : [];
  if (!items.length) return;
  const gallery = galleryImages();
  const sources = galleryPreviewImages.slice(0, items.length).map((image) => mediaUrl(galleryThumbAt(gallery.indexOf(image))));
  const orientations = await Promise.all(sources.map(probeImageOrientation));
  const landscapeIndexes = orientations.flatMap((orientation, index) => (orientation === "landscape" ? [index] : []));
  const wideSlots = [...new Set([0, items.length - 1])];
  const order = items.map((_, index) => index);
  wideSlots.forEach((slot, slotIndex) => {
    const landscapeIndex = landscapeIndexes[slotIndex];
    if (landscapeIndex === undefined || landscapeIndex === slot) return;
    const slotPos = order.indexOf(slot);
    const landscapePos = order.indexOf(landscapeIndex);
    [order[slotPos], order[landscapePos]] = [order[landscapePos], order[slotPos]];
  });
  order.forEach((originalIndex, position) => {
    const item = items[originalIndex];
    grid.appendChild(item);
    item.classList.toggle("is-wide", wideSlots.includes(position) && orientations[originalIndex] === "landscape");
  });
}

function loadLazyBackgrounds() {
  const targets = [...document.querySelectorAll("[data-lazy-background]")];
  const load = (target) => {
    target.style.backgroundImage = `url("${target.dataset.lazyBackground.replace(/"/g, '\\"')}")`;
    delete target.dataset.lazyBackground;
  };
  if (!("IntersectionObserver" in window)) return targets.forEach(load);
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    load(entry.target);
    observer.unobserve(entry.target);
  }), { rootMargin: "240px 0px" });
  targets.forEach((target) => observer.observe(target));
}

function guestbookMarkup() {
  const visibleEntries = guestbookEntries.filter((entry) => !entry.hidden);
  return visibleEntries.length
    ? visibleEntries.map((entry) => `
      <article class="guestbook-entry">
        <div><strong>${escapeHtml(entry.guest_name)}</strong><span>${escapeHtml(new Date(entry.created_at).toLocaleDateString("ko-KR"))}</span></div>
        <p>${escapeHtml(entry.message)}</p>
      </article>`).join("")
    : '<p class="subtle">첫 번째 축하 메시지를 남겨 주세요.</p>';
}

function activeSectionOrder() {
  const previewMode = new URLSearchParams(location.search).get("previewSectionMode");
  if (previewMode === "preWedding" || previewMode === "weddingDay") {
    const previewOrder = data.sectionSettings?.[previewMode];
    return Array.isArray(previewOrder) ? previewOrder : defaultSectionSettings[previewMode];
  }
  const eventDate = data.guestPhotos?.eventDate || "2026-10-04";
  const today = todayInputDate();
  const mode = today < eventDate ? "preWedding" : "weddingDay";
  const configured = data.sectionSettings?.[mode];
  return Array.isArray(configured) ? configured : defaultSectionSettings[mode];
}

const isCopyEditorPreview = new URLSearchParams(location.search).get("copyEditorPreview") === "1";

function applySectionOrder() {
  const article = document.querySelector(".invitation");
  const ending = article.querySelector(".ending");
  const sections = new Map([...article.querySelectorAll(".section[id]")].map((section) => [section.id, section]));
  const order = activeSectionOrder().filter((id, index, items) => sections.has(id) && items.indexOf(id) === index);
  const visible = new Set(order);
  sections.forEach((section, id) => {
    if (!visible.has(id)) section.remove();
  });
  order.forEach((id) => article.insertBefore(sections.get(id), ending));

  const nav = article.querySelector(".bottom-tabbar");
  if (!nav) return;
  const links = new Map([...nav.querySelectorAll("a")].map((link) => [link.getAttribute("href").slice(1), link]));
  links.forEach((link, id) => {
    if (!visible.has(id)) link.remove();
  });
  order.forEach((id) => {
    if (links.has(id)) nav.appendChild(links.get(id));
  });
  nav.style.setProperty("--tab-count", String(nav.querySelectorAll("a").length || 1));
}

function sortedTransport() {
  const priorities = ["지하철", "버스", "자가용"];
  return [...data.transport].sort((left, right) => {
    const rank = (item) => {
      const index = priorities.findIndex((keyword) => String(item.title).includes(keyword));
      return index < 0 ? priorities.length : index;
    };
    return rank(left) - rank(right);
  });
}

function render() {
  const { groom, bride } = data.couple;
  const displaySettings = data.displaySettings || {};
  const period = publicPeriodStatus();
  if (!period.visible) {
    app.innerHTML = `
      <main class="invitation-closed" role="main">
        <div>
          <p class="section-label">Wedding Invitation</p>
          <h1>${escapeHtml(period.title)}</h1>
          <p>${escapeHtml(period.text)}</p>
        </div>
      </main>`;
    return;
  }
  const introDesign = data.hero.introDesign || {};
  const introAlign = ["left", "center", "right"].includes(introDesign.align) ? introDesign.align : "center";
  const introNumber = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const introStyle = `--intro-align:${introAlign};--intro-eyebrow-size:${introNumber(introDesign.eyebrowSize, 11, 8, 24)}px;--intro-name-size:${introNumber(introDesign.nameSize, 30, 20, 54)}px;--intro-date-size:${introNumber(introDesign.dateSize, 11, 8, 20)}px;--intro-eyebrow-name-gap:${introNumber(introDesign.eyebrowNameGap, 10, 0, 40)}px;--intro-name-date-gap:${introNumber(introDesign.nameDateGap, 10, -24, 40)}px;--intro-offset-y:${introNumber(introDesign.offsetY, 0, -160, 160)}px`;
  const guestPhotos = guestPhotoStatus();
  const gallery = galleryImages();
  const location = venueParts();
  const showParentLines = displaySettings.showInvitationParents !== false && hasAnyParent(groom) && hasAnyParent(bride);
  const parentsMarkup = showParentLines
    ? `${invitationParentLine("신랑", groom)}<span class="parents-heart">♥</span>${invitationParentLine("신부", bride)}`
    : `<span><strong>${escapeHtml(groom.name)}</strong> ♥ <strong>${escapeHtml(bride.name)}</strong></span>`;
  galleryPreviewImages = shuffledGalleryPreview(gallery);
  app.innerHTML = `
    <div class="invitation-intro" data-invitation-intro>
      <div class="invitation-intro-copy" style="${introStyle}">
        <p>${escapeHtml(data.hero.introEyebrow || data.hero.eyebrow || "our wedding day")}</p>
        <strong data-intro-name></strong>
        <span>${escapeHtml(data.hero.introDate || data.wedding.displayDate)}</span>
      </div>
    </div>
    <article class="invitation">
      <header class="hero">
        <div class="media hero-media" ${mediaStyle(data.hero.image)} data-active-media="${heroActiveMedia()}">${heroMediaMarkup()}</div>
        <div class="hero-content hero-content-${escapeHtml(data.hero.contentPosition || "bottom")}">
          <p class="hero-eyebrow">${escapeHtml(data.hero.eyebrow)}</p>
          <h1 class="hero-names">${escapeHtml(groom.name)} <span>·</span> ${escapeHtml(bride.name)}</h1>
          <p class="hero-date single-line-fit">${escapeHtml(data.wedding.displayDate)}</p>
        </div>
      </header>

      <section class="section" id="invitation">
        ${sectionCopy("invitation", "Invitation", data.invitation.title)}
        ${data.invitation.paragraphs.map((text) => `<p class="invitation-copy">${escapeHtml(text)}</p>`).join("")}
        ${parentsMarkup ? `<p class="parents">${parentsMarkup}</p>` : ""}
        <div class="contact-row">
          <a class="btn" href="${tel(groom.phone)}">신랑에게 연락</a>
          <a class="btn" href="${tel(bride.phone)}">신부에게 연락</a>
        </div>
      </section>

      <section class="section" id="about-us">
        ${sectionCopy("aboutUs", "About Us", "저희를 소개합니다")}
        <div class="profile-grid">
          ${[["신랑", groom], ["신부", bride]].map(([role, person]) => `
            <article class="profile-card">
              <div class="media profile-photo" ${mediaStyle(person.photo)}></div>
              <div class="profile-body">
                <h3 class="profile-name single-line-fit"><span class="profile-role">${role}</span><span class="profile-person-name">${escapeHtml(person.name)}</span></h3>
                ${displaySettings.showProfileParents !== false && parentDisplay(person) ? `<div class="profile-parents single-line-fit">${escapeHtml(parentDisplay(person))}</div>` : ""}
                ${displaySettings.showProfileBirthdays !== false && person.birthday ? `<div class="profile-birthday">${escapeHtml(person.birthday)}</div>` : ""}
                <div class="profile-mbti">${escapeHtml(person.mbti)}</div>
                <div class="profile-tags">${(person.tags || []).slice(0, 3).map((tag) => `<span class="tag">#${escapeHtml(String(tag).replace(/^#+/, ""))}</span>`).join(" ")}</div>
              </div>
            </article>`).join("")}
        </div>
      </section>

      <section class="section" id="wedding-day">
        ${weddingDayTitleMarkup()}
        ${renderCalendar()}
        ${renderDayStrip()}
        <div class="countdown" id="countdown"></div>
        <p class="subtle" id="countdown-message"></p>
      </section>

      <section class="section" id="location">
        ${sectionCopy("location", "Location", "오시는 길")}
        <h3 class="location-venue single-line-fit">${escapeHtml(location.venue)}</h3>
        ${location.hall ? `<p class="location-hall">${escapeHtml(location.hall)}</p>` : ""}
        <p class="location-address">${escapeHtml(data.wedding.address)}</p>
        <div class="map-links">
          <button class="btn copy-btn" data-map-app="copy" data-copy="${escapeHtml(data.wedding.address)}">주소 복사</button>
          ${mapLinksForAddress(data.wedding.address).map((link) => `<a class="btn" data-map-app="${link.app}" ${link.fallbackUrl ? `data-map-fallback="${escapeHtml(link.fallbackUrl)}"` : ""} href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join("")}
        </div>
        <div class="transport">
          ${sortedTransport().filter((item) => !item.hidden).map((item) => `<div><strong>${escapeHtml(item.title)}</strong>${escapeLineHtml(item.text)}</div>`).join("")}
        </div>
      </section>

      <section class="section" id="gallery">
        ${sectionCopy("gallery", "Gallery", "갤러리")}
        <div class="gallery-grid">
          ${galleryPreviewImages.map((image, index) => `<button class="gallery-item" data-gallery="${gallery.indexOf(image)}" aria-label="사진 ${index + 1} 크게 보기"><span class="media" ${lazyMediaStyle(galleryThumbAt(gallery.indexOf(image)))}></span></button>`).join("")}
        </div>
        <button class="btn gallery-more" id="gallery-more">사진 더보기</button>
      </section>

      ${guestPhotos.showSection ? `
        <section class="section guest-photo-section" id="wedding-snap">
          ${sectionCopy("weddingSnap", "Guest Album", "예쁘게 빛난 순간, 같이 공유해요!")}
          <p class="subtle">${guestPhotos.canUpload ? escapeLineHtml(data.sectionDescriptions?.weddingSnap || "오늘의 추억은 여러분의 한 장에서 완성돼요.\n예식 당일, 아래 버튼으로 가볍게 공유해주세요!") : escapeLineHtml(data.guestPhotos?.manageDescription || "이 휴대폰에서 보낸 사진과 영상을 확인하거나 삭제할 수 있습니다.")}</p>
          <div class="guest-photo-actions">
            ${guestPhotos.canUpload ? '<button class="btn btn-primary" id="guest-photo-open">사진·영상 업로드</button>' : ""}
            <button class="btn" id="guest-photo-manage">내가 보낸 파일</button>
          </div>
          ${isCopyEditorPreview ? '<button class="btn copy-preview-detail-edit" type="button" data-preview-detail-edit="wedding-snap">✎ 세부내용 수정</button>' : ""}
          ${guestPhotos.canUpload ? '<p class="action-footnote">결혼식 당일부터 업로드 가능합니다.</p>' : ""}
        </section>` : ""}

      ${(data.notices || []).filter((notice) => !notice.hidden).length ? `<section class="section" id="information">
        ${sectionCopy("information", "Information", "식장 안내")}
        ${informationSliderMarkup()}
      </section>` : ""}

      <section class="section" id="attendance">
        ${sectionCopy("attendance", "Rsvp", "참석 의사 전달")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.attendance || "신랑, 신부에게 참석의사를\n미리 전달할 수 있어요.")}</p>
        <button class="btn btn-primary" id="attendance-open">전달하기</button>
        ${isCopyEditorPreview ? '<button class="btn copy-preview-detail-edit" type="button" data-preview-detail-edit="rsvp">✎ 세부내용 수정</button>' : ""}
      </section>

      <section class="section" id="account">
        ${sectionCopy("account", "Account", "마음 전하는 곳")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.account || "참석이 어려우신 분들을 위해\n계좌번호를 안내해 드립니다.")}</p>
        <div class="account-groups">${renderAccounts("신랑측")}${renderAccounts("신부측")}</div>
      </section>

      <section class="section" id="guestbook">
        ${sectionCopy("guestbook", "Guestbook", "축하 메시지")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.guestbook || "따뜻한 마음을 짧게 남겨 주세요.")}</p>
        <form class="guestbook-form" id="guestbook-form">
          <label class="field"><span>성함</span><input name="guest_name" required maxlength="30" autocomplete="name" placeholder="성함을 입력해 주세요."></label>
          <label class="field"><span>축하 메시지</span><textarea name="message" required maxlength="300" rows="3" placeholder="축하 메시지를 남겨 주세요."></textarea></label>
          <button class="btn btn-primary" id="guestbook-submit">메시지 남기기</button>
        </form>
        <div class="guestbook-list" id="guestbook-list">${guestbookMarkup()}</div>
      </section>

      <section class="ending">
        <div class="media" ${mediaStyle(data.ending.image)}></div>
        <div class="ending-content"><p class="preserve">${escapeHtml(data.ending.text)}</p><p class="ending-names">${escapeHtml(groom.name)} · ${escapeHtml(bride.name)}</p><button class="btn" id="share-button">청첩장 공유하기</button></div>
      </section>
      <footer class="footer"></footer>
      <nav class="bottom-tabbar" aria-label="주요 메뉴">
        <a href="#wedding-day"><span>일정</span></a>
        <a href="#location"><span>장소</span></a>
        <a href="#gallery"><span>사진</span></a>
        <a href="#attendance"><span>참석 여부</span></a>
        <a href="#guestbook"><span>방명록</span></a>
      </nav>
    </article>`;
  applySectionOrder();
}

function updateCountdown() {
  const gap = weddingDate.getTime() - Date.now();
  const passed = gap < 0;
  let rest = Math.abs(gap);
  const days = Math.floor(rest / 86400000); rest %= 86400000;
  const hours = Math.floor(rest / 3600000); rest %= 3600000;
  const minutes = Math.floor(rest / 60000); rest %= 60000;
  const seconds = Math.floor(rest / 1000);
  const countdown = document.querySelector("#countdown");
  const message = document.querySelector("#countdown-message");
  if (!countdown || !message) return;
  countdown.innerHTML = [["DAYS", days], ["HOUR", hours], ["MIN", minutes], ["SEC", seconds]].map(([label, value]) => `<div class="countdown-item"><strong>${value}</strong><small>${label}</small></div>`).join("");
  message.textContent = passed ? `결혼식으로부터 ${days}일이 지났습니다.` : `결혼식까지 ${days}일 남았습니다.`;
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal">${content}</div></div>`;
  document.querySelector("#modal-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });
  document.querySelector("[data-close]")?.addEventListener("click", closeModal);
}
function closeModal() { modalRoot.innerHTML = ""; }

function showUploadStatus({ completed = 0, total = 1, percent = 0, state = "uploading", message = "" } = {}) {
  let status = document.querySelector("[data-upload-status]");
  if (!status) {
    status = document.createElement("aside");
    status.className = "upload-status";
    status.dataset.uploadStatus = "";
    document.body.append(status);
  }
  clearTimeout(status.removeTimer);
  status.classList.toggle("is-complete", state === "complete");
  status.classList.toggle("is-error", state === "error");
  status.innerHTML = `<div><strong>${state === "complete" ? "업로드 완료" : state === "error" ? "업로드 확인 필요" : "사진·영상 업로드 중"}</strong><span>${message || `${completed} / ${total} · ${percent}%`}</span></div><progress max="100" value="${percent}"></progress>`;
  if (state !== "uploading") status.removeTimer = setTimeout(() => status.remove(), 3600);
}

function shareModal() {
  const url = sharePageUrl();
  return `
    <h2>청첩장 공유하기</h2>
    <div class="share-choice-grid">
      <button class="share-choice" type="button" data-native-share><strong>앱으로 공유</strong></button>
      <button class="share-choice" type="button" data-copy-link><strong>링크 복사</strong></button>
      <a class="share-choice" href="${escapeHtml(`sms:?&body=${encodeURIComponent(`${data.meta.title}\n${url}`)}`)}"><strong>문자로 공유</strong></a>
    </div>
    <div class="modal-actions"><button class="btn" type="button" data-close>닫기</button></div>`;
}

function initializeKakaoShare() {
  const key = window.KAKAO_SHARE_CONFIG?.javascriptKey?.trim();
  if (!key || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) window.Kakao.init(key);
  return window.Kakao.isInitialized();
}

function shareWithKakaoTalk() {
  if (!initializeKakaoShare()) return false;

  const configuredShareUrl = window.KAKAO_SHARE_CONFIG?.shareBaseUrl?.trim();
  const shareUrl = configuredShareUrl || sharePageUrl();
  const locationUrl = publicInvitationUrl("location");
  const imageUrl = mediaUrl(data.meta.shareImage || data.hero.image);

  if (!imageUrl) {
    throw new Error("카카오톡 공유용 이미지 또는 메인 사진을 먼저 등록해 주세요.");
  }

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: data.meta.title,
      description: `${data.wedding.displayDate}\n${data.wedding.venue}`,
      imageUrl,
      imageWidth: 600,
      imageHeight: 800,
      link: {
        mobileWebUrl: shareUrl,
        webUrl: shareUrl,
      },
    },
    buttons: [
      {
        title: "청첩장 보기",
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      {
        title: "위치 보기",
        link: {
          mobileWebUrl: locationUrl,
          webUrl: locationUrl,
        },
      },
    ],
  });

  return true;
}

function playInvitationIntro() {
  const intro = document.querySelector("[data-invitation-intro]");
  const target = document.querySelector("[data-intro-name]");
  if (!intro || !target) return;
  const scrollTop = window.scrollY;
  const preventIntroAction = (event) => event.preventDefault();
  const preventIntroKey = (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"].includes(event.key)) event.preventDefault();
  };
  document.body.classList.add("intro-open");
  document.body.style.top = `-${scrollTop}px`;
  window.addEventListener("wheel", preventIntroAction, { passive: false });
  window.addEventListener("touchmove", preventIntroAction, { passive: false });
  window.addEventListener("keydown", preventIntroKey);
  const unlock = () => {
    document.body.classList.remove("intro-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollTop);
    window.removeEventListener("wheel", preventIntroAction);
    window.removeEventListener("touchmove", preventIntroAction);
    window.removeEventListener("keydown", preventIntroKey);
  };
  const text = data.hero.introName || `${data.couple.groom.name} · ${data.couple.bride.name}`;
  let index = 0;
  const typeNext = () => {
    target.textContent = text.slice(0, index += 1);
    if (index < text.length) setTimeout(typeNext, 95);
    else setTimeout(() => {
      intro.classList.add("is-finished");
      setTimeout(unlock, 720);
    }, 850);
  };
  setTimeout(typeNext, 350);
}

function sharePageUrl() {
  const slug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || "";
  const query = slug && slug !== "main" ? `?card=${encodeURIComponent(slug)}` : "";
  return `${location.origin}/api/share${query}`;
}

function publicInvitationUrl(section = "") {
  const slug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || "";
  const path = slug && slug !== "main" ? `/index.html?card=${encodeURIComponent(slug)}` : "/";
  const hash = section ? `#${encodeURIComponent(section)}` : "";
  return `${location.origin}${path}${hash}`;
}

async function copyInvitationLink() {
  await navigator.clipboard.writeText(sharePageUrl());
  closeModal();
  alert("청첩장 주소를 복사했습니다.");
}

function bindShareModal() {
  document.querySelector("[data-kakao-share]")?.addEventListener("click", async () => {
    try {
      if (!shareWithKakaoTalk()) {
        alert("카카오톡 카드 공유를 사용하려면 kakao-config.js에 JavaScript 키를 등록해 주세요. 앱 공유를 대신 열겠습니다.");
        const shareData = { title: data.meta.title, text: data.meta.description, url: sharePageUrl() };
        if (navigator.share) await navigator.share(shareData);
        else await copyInvitationLink();
      }
    } catch (error) {
      alert(error.message || "카카오톡 공유를 열지 못했습니다. Kakao Developers의 JavaScript SDK 도메인과 제품 링크 웹 도메인을 확인해 주세요.");
    }
  });
  document.querySelector("[data-native-share]")?.addEventListener("click", async () => {
    const shareData = { title: data.meta.title, text: data.meta.description, url: sharePageUrl() };
    try {
      if (shareWithKakaoTalk()) return;
      if (navigator.share) await navigator.share(shareData);
      else await copyInvitationLink();
    } catch (error) {
      if (error.name !== "AbortError") alert("공유하지 못했습니다. 링크 복사를 이용해 주세요.");
    }
  });
  document.querySelector("[data-copy-link]")?.addEventListener("click", async () => {
    try { await copyInvitationLink(); }
    catch { alert(`청첩장 주소: ${location.href}`); }
  });
}

function attendanceForm() {
  const rsvp = data.rsvp || {};
  const transportOptions = rsvp.transportOptions || ["자가용", "기차", "버스", "택시", "도보", "직접입력"];
  return `
    <h2>참석 정보 입력</h2>
    <p class="form-guide">${escapeLineHtml(rsvp.modalGuide || "기차표와 숙소 준비를 위해 필요한 정보입니다.")}</p>
    <form class="form-grid" id="attendance-form">
      <label class="field"><span>성함</span><input name="guest_name" required maxlength="30" autocomplete="name"></label>
      <label class="field"><span>연락처</span><input name="phone" required maxlength="20" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"></label>
      <label class="rsvp-switch"><span>참석 여부</span><input type="hidden" name="attendance" value="참석"><input type="checkbox" id="attendance-status" checked><i aria-hidden="true"></i></label>
      <label class="field"><span>추가 전달 사항</span><textarea name="notes" rows="3" maxlength="500" placeholder="${escapeHtml(rsvp.notesPlaceholder || "교통편이나 숙소 관련 요청을 자유롭게 적어 주세요.")}"></textarea></label>
      <div class="attendance-details" id="attendance-details">
        <label class="field"><span>출발일자</span><input name="departure_date" type="date"></label>
        <label class="field"><span>출발지</span><input name="origin" maxlength="50" placeholder="${escapeHtml(rsvp.originPlaceholder || "예: 서울역, 창원시 성산구")}"></label>
        <section class="rsvp-choice-group">
          <span>오는 방법</span>
          <input type="hidden" name="transport" value="${escapeHtml(transportOptions[0] || "자가용")}">
          <div class="rsvp-choice-list">
            ${transportOptions.map((option, index) => `<button class="${index === 0 ? "is-active" : ""}" type="button" data-transport-choice="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
          </div>
        </section>
        <label class="field" id="travel-details-field" hidden><span>기타 이동 정보</span><input name="travel_details" maxlength="100" placeholder="${escapeHtml(rsvp.transportPlaceholder || "예: KTX 창원중앙역 도착 후 택시")}"></label>
        <section class="companion-manager">
          <span>함께 오시는 분</span>
          <div id="companions-list">
            <label class="companion-row"><input name="companions" maxlength="40" placeholder="이름 또는 관계"><button class="icon-btn" type="button" data-companion-add aria-label="동행인 추가">＋</button><button class="icon-btn" type="button" data-companion-remove aria-label="동행인 삭제">－</button></label>
          </div>
        </section>
        <p class="attendance-count">예상 참석 인원 <strong id="attendance-count">1명</strong></p>
        <label class="rsvp-switch"><span>숙소 필요 여부</span><input type="hidden" name="needs_accommodation" value="아니오"><input type="checkbox" id="accommodation-status"><i aria-hidden="true"></i></label>
        <div class="accommodation-extra" id="accommodation-extra" hidden>
          <p class="form-guide">${escapeLineHtml(rsvp.accommodationGuide || "숙소 준비를 위해 함께 오는 인원 이름 또는 명수를 적어 주세요.")}</p>
          <label class="field"><span>숙소 인원 정보</span><input name="accommodation_details" maxlength="120" placeholder="예: 홍길동, 김영희 / 총 2명"></label>
        </div>
      </div>
      <label class="consent"><input type="checkbox" required> <span>교통편 및 숙소 준비를 위한 개인정보 수집에 동의합니다.</span></label>
      <div class="modal-actions"><button class="btn" type="button" data-close>취소</button><button class="btn btn-primary" id="attendance-submit">전달하기</button></div>
    </form>`;
}

function informationSliderMarkup() {
  const notices = data.notices.filter((notice) => !notice.hidden);
  return `
    <div class="information-slider" data-information-index="0">
      <div class="information-dots">${notices.map((_, index) => `<i class="${index === 0 ? "is-active" : ""}"></i>`).join("")}</div>
      <div class="information-slide-wrap">
        <div data-information-slide></div>
        <button class="information-arrow information-prev" type="button" data-information-move="-1" aria-label="이전 안내">‹</button>
        <button class="information-arrow information-next" type="button" data-information-move="1" aria-label="다음 안내">›</button>
      </div>
    </div>`;
}

function bindInformationSlider() {
  const slider = document.querySelector(".information-slider");
  if (!slider) return;
  const notices = data.notices.filter((notice) => !notice.hidden);
  let touchStartX = 0;
  const renderSlide = () => {
    const index = Number(slider.dataset.informationIndex);
    const notice = notices[index];
    slider.querySelector("[data-information-slide]").innerHTML = `
      <article class="information-slide">
        <h3>${escapeHtml(notice.title)}</h3>
        <p>${escapeLineHtml(notice.text)}</p>
      </article>`;
    slider.querySelectorAll(".information-dots i").forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
  };
  const move = (step) => {
    slider.dataset.informationIndex = String((Number(slider.dataset.informationIndex) + step + notices.length) % notices.length);
    renderSlide();
  };
  slider.querySelectorAll("[data-information-move]").forEach((button) => button.addEventListener("click", () => move(Number(button.dataset.informationMove))));
  slider.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
  }, { passive: true });
  renderSlide();
}

function companionLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function companionInputValues(form) {
  return [...form.querySelectorAll('input[name="companions"]')].map((input) => input.value.trim()).filter(Boolean);
}

function gallerySlider(index = 0) {
  const images = galleryImages();
  const safeIndex = Math.max(0, Math.min(index, images.length - 1));
  return `
    <div class="gallery-slider" data-gallery-index="${safeIndex}">
      <div class="gallery-slider-head">
        <h2>Gallery</h2>
        <button class="gallery-close" type="button" data-close aria-label="닫기">×</button>
      </div>
      <div class="gallery-slide">
        <button class="gallery-nav gallery-prev" type="button" data-gallery-move="-1" aria-label="이전 사진">‹</button>
        <div class="gallery-slide-photo ${data.galleryDisplayMode === "original" ? "is-original" : "is-portrait"}">
          <img src="${escapeHtml(mediaUrl(images[safeIndex]))}" alt="갤러리 사진 ${safeIndex + 1}" data-gallery-image decoding="async">
        </div>
        <button class="gallery-nav gallery-next" type="button" data-gallery-move="1" aria-label="다음 사진">›</button>
      </div>
      <p class="gallery-page" data-gallery-page>${safeIndex + 1} / ${images.length}</p>
    </div>`;
}

function openGallerySlider(index = 0) {
  openModal(gallerySlider(index));
  const slider = document.querySelector(".gallery-slider");
  let touchStartX = 0;
  const move = (step) => {
    const images = galleryImages();
    const current = Number(slider.dataset.galleryIndex);
    const next = (current + step + images.length) % images.length;
    const image = slider.querySelector("[data-gallery-image]");
    const page = slider.querySelector("[data-gallery-page]");
    slider.dataset.galleryIndex = String(next);
    image.classList.add("is-loading");
    image.onload = () => image.classList.remove("is-loading");
    image.src = mediaUrl(images[next]);
    image.alt = `갤러리 사진 ${next + 1}`;
    page.textContent = `${next + 1} / ${images.length}`;
  };
  document.querySelectorAll("[data-gallery-move]").forEach((button) => {
    button.addEventListener("click", () => move(Number(button.dataset.galleryMove)));
  });
  slider.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
  }, { passive: true });
}

function guestPhotoForm() {
  return `
    <div class="snap-modal-head">
      <div class="snap-modal-hero" ${mediaStyle(data.hero.image)}>
        <span>하객 앨범</span><small>${escapeHtml(data.couple.groom.name)} · ${escapeHtml(data.couple.bride.name)}</small>
        <h2>소중한 추억을 함께 남겨주세요</h2>
      </div>
      <div class="snap-modal-guide"><strong>${escapeHtml(data.guestPhotos?.modalGuideTitle || "여러분의 사진첩이 우리 앨범이 됩니다.")}</strong><p>${escapeLineHtml(data.guestPhotos?.modalGuideText || "1. 두 사람의 설렘 가득한 스냅\n2. 멋진 입장 & 환한 행진\n3. 가족·친구와의 찰칵 한 컷\n4. 당신의 시선으로 포착한 장면들")}</p><em>${escapeHtml(data.guestPhotos?.modalGuideFootnote || "작은 한 컷이 우리에게 큰 선물이 돼요.")}</em></div>
    </div>
    <form class="form-grid snap-upload-form" id="guest-photo-form">
      <label class="field"><span>이름(폴더명)</span><input name="guest_name" required maxlength="20" placeholder="예: 홍길동"></label>
      <label class="consent"><input type="checkbox" required> <span>신랑 신부에게 사진과 영상을 전달하기 위해 파일을 업로드하는 것에 동의합니다.</span></label>
      <section class="snap-upload-box">
        <strong>사진·영상 업로드</strong>
        <p class="upload-selection" id="guest-photo-selection">예식 당일 함께한 사진과 영상을 업로드해 주세요.</p>
        <label class="btn guest-photo-picker"><span>파일 첨부하기</span><input type="file" id="guest-photo-files" accept="image/*,video/mp4,video/webm,video/quicktime" multiple></label>
        <div class="guest-photo-selection-grid" id="guest-photo-selection-grid"></div>
      </section>
      <ul class="snap-upload-notes"><li>파일은 장당 50MB 이하만 올릴 수 있어요.</li><li>사진과 영상을 한 번에 여러 개 선택할 수 있어요.</li><li>추가 업로드도 같은 이름으로 남겨 주세요.</li></ul>
      <div class="modal-actions"><button class="btn" type="button" data-close>취소</button><button class="btn btn-primary" id="guest-photo-submit">신랑 신부에게 공유하기</button></div>
    </form>`;
}

function ownGuestPhotoGallery(photos) {
  const previewUrl = (photo = {}) => photo.thumbSignedUrl || "";
  return `
    <h2>내가 보낸 파일</h2>
    <p class="form-guide">이 휴대폰 브라우저에서 업로드한 사진과 영상입니다. 잘못 올린 파일은 삭제할 수 있습니다.</p>
    <div class="own-photo-grid">
      ${photos.length ? photos.map((photo) => `
        <article class="own-photo">
          <a href="${escapeHtml(photo.signedUrl)}" target="_blank" rel="noopener">${isVideoMedia(photo.name || photo.path)
            ? `<span class="guest-video-file"><strong>VIDEO</strong><small>저장해서 확인하기</small></span>`
            : previewUrl(photo)
              ? `<img src="${escapeHtml(previewUrl(photo))}" alt="내가 보낸 사진" loading="lazy" decoding="async">`
              : `<span class="guest-video-file"><strong>IMAGE</strong><small>원본으로 확인하기</small></span>`}</a>
          <button class="btn" type="button" data-remove-guest-photo="${escapeHtml(photo.path)}">삭제</button>
        </article>`).join("") : '<p class="subtle">아직 이 휴대폰에서 보낸 파일이 없습니다.</p>'}
    </div>
    <p class="form-guide">브라우저 데이터 삭제, 시크릿 모드 종료, 휴대폰 변경 후에는 기존 파일을 직접 관리할 수 없습니다.</p>
    <div class="modal-actions"><button class="btn" type="button" data-close>닫기</button></div>`;
}

async function openOwnGuestPhotos() {
  openModal('<h2>내가 보낸 파일</h2><p class="form-guide">파일을 불러오고 있습니다.</p><div class="modal-actions"><button class="btn" type="button" data-close>닫기</button></div>');
  try {
    const photos = await window.RSVP_STORAGE.listOwnGuestPhotos();
    openModal(ownGuestPhotoGallery(photos));
    document.querySelectorAll("[data-remove-guest-photo]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("이 파일을 삭제할까요?")) return;
        button.disabled = true;
        button.textContent = "삭제 중...";
        try {
          await window.RSVP_STORAGE.removeOwnGuestPhoto(button.dataset.removeGuestPhoto);
          await openOwnGuestPhotos();
        } catch {
          button.disabled = false;
          button.textContent = "삭제";
          alert("파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      });
    });
  } catch {
    openModal('<h2>내가 보낸 파일</h2><p class="form-guide">파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><div class="modal-actions"><button class="btn" type="button" data-close>닫기</button></div>');
  }
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const tmapLink = event.target.closest('[data-map-app="tmap"]');
    if (tmapLink) {
      event.preventDefault();
      const fallbackUrl = tmapLink.dataset.mapFallback;
      let opened = false;
      const markOpened = () => { opened = true; };
      document.addEventListener("visibilitychange", markOpened, { once: true });
      location.href = tmapLink.href;
      if (fallbackUrl) {
        setTimeout(() => {
          document.removeEventListener("visibilitychange", markOpened);
          if (!opened && !document.hidden) location.href = fallbackUrl;
        }, 900);
      }
      return;
    }
    const copyButton = event.target.closest(".copy-btn");
    if (copyButton) {
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copy);
        if (copyButton.classList.contains("account-copy-btn")) {
          copyButton.classList.add("is-copied");
          setTimeout(() => { copyButton.classList.remove("is-copied"); }, 1200);
          return;
        }
        const original = copyButton.textContent;
        copyButton.textContent = "복사 완료";
        setTimeout(() => { copyButton.textContent = original; }, 1200);
      } catch { alert(`복사할 내용: ${copyButton.dataset.copy}`); }
    }
    const galleryButton = event.target.closest("[data-gallery]");
    if (galleryButton) {
      openGallerySlider(Number(galleryButton.dataset.gallery));
    }
  });

  document.querySelector("#gallery-more")?.addEventListener("click", () => openGallerySlider());

  bindInformationSlider();

  document.querySelector("#attendance-open")?.addEventListener("click", () => {
    openModal(attendanceForm());
    const form = document.querySelector("#attendance-form");
    const status = document.querySelector("#attendance-status");
    const attendanceValue = form.elements.attendance;
    const accommodationStatus = document.querySelector("#accommodation-status");
    const accommodationValue = form.elements.needs_accommodation;
    const accommodationExtra = document.querySelector("#accommodation-extra");
    const details = document.querySelector("#attendance-details");
    const companionsList = document.querySelector("#companions-list");
    const travelDetailsField = document.querySelector("#travel-details-field");
    const count = document.querySelector("#attendance-count");
    const updateAttendanceForm = () => {
      const isAttending = status.checked;
      attendanceValue.value = isAttending ? "참석" : "불참";
      details.hidden = !isAttending;
      count.textContent = `${isAttending ? companionInputValues(form).length + 1 : 0}명`;
    };
    const updateAccommodationForm = () => {
      const needsRoom = accommodationStatus.checked;
      accommodationValue.value = needsRoom ? "예" : "아니오";
      accommodationExtra.hidden = !needsRoom;
    };
    const updateTransportForm = (choice) => {
      form.elements.transport.value = choice;
      form.querySelectorAll("[data-transport-choice]").forEach((button) => button.classList.toggle("is-active", button.dataset.transportChoice === choice));
      travelDetailsField.hidden = choice !== "직접입력";
      if (travelDetailsField.hidden) form.elements.travel_details.value = "";
    };
    const addCompanionInput = (value = "") => {
      const row = document.createElement("label");
      row.className = "companion-row";
      row.innerHTML = `<input name="companions" maxlength="40" placeholder="이름 또는 관계" value="${escapeHtml(value)}"><button class="icon-btn" type="button" data-companion-add aria-label="동행인 추가">＋</button><button class="icon-btn" type="button" data-companion-remove aria-label="동행인 삭제">－</button>`;
      companionsList.append(row);
      updateCompanionButtons();
      row.querySelector("input").focus();
    };
    const updateCompanionButtons = () => {
      const rows = [...companionsList.querySelectorAll(".companion-row")];
      rows.forEach((row) => {
        row.querySelector("[data-companion-remove]").disabled = rows.length <= 1;
      });
    };
    status.addEventListener("change", updateAttendanceForm);
    accommodationStatus.addEventListener("change", updateAccommodationForm);
    form.querySelectorAll("[data-transport-choice]").forEach((button) => {
      button.addEventListener("click", () => updateTransportForm(button.dataset.transportChoice));
    });
    companionsList.addEventListener("click", (event) => {
      if (event.target.closest("[data-companion-add]")) addCompanionInput();
      const removeButton = event.target.closest("[data-companion-remove]");
      if (removeButton && companionsList.querySelectorAll(".companion-row").length > 1) {
        removeButton.closest(".companion-row").remove();
        updateCompanionButtons();
        updateAttendanceForm();
      }
    });
    companionsList.addEventListener("input", updateAttendanceForm);
    updateCompanionButtons();
    updateAttendanceForm();
    updateAccommodationForm();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = document.querySelector("#attendance-submit");
      const fields = new FormData(form);
      const isAttending = fields.get("attendance") === "참석";
      const companionList = isAttending ? companionInputValues(form) : [];
      submitButton.disabled = true;
      submitButton.textContent = "전달 중...";
      try {
        const result = await window.RSVP_STORAGE.submitAttendanceResponse({
          guest_name: fields.get("guest_name").trim(),
          phone: fields.get("phone").trim(),
          attendance: fields.get("attendance"),
          origin: isAttending ? fields.get("origin") : null,
          transport: isAttending ? fields.get("transport") : null,
          departure_date: isAttending ? fields.get("departure_date") : null,
          travel_details: isAttending ? fields.get("travel_details").trim() : "",
          companions: companionList,
          companion_count: companionList.length,
          total_count: isAttending ? companionList.length + 1 : 0,
          needs_accommodation: isAttending ? fields.get("needs_accommodation") : null,
          accommodation_details: isAttending && fields.get("needs_accommodation") === "예" ? fields.get("accommodation_details").trim() : "",
          notes: fields.get("notes").trim(),
        });
        closeModal();
        alert(result.isPreview
          ? "미리보기 모드로 저장했습니다. 실제 수집을 시작하려면 Supabase 설정을 완료해 주세요."
          : "참석 정보를 전달했습니다. 감사합니다.");
      } catch {
        submitButton.disabled = false;
        submitButton.textContent = "전달하기";
        alert("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  });

  document.querySelector("#guest-photo-open")?.addEventListener("click", () => {
    openModal(guestPhotoForm());
    const form = document.querySelector("#guest-photo-form");
    const files = document.querySelector("#guest-photo-files");
    const selection = document.querySelector("#guest-photo-selection");
    const selectionGrid = document.querySelector("#guest-photo-selection-grid");
    let selectedPhotos = [];
    const renderSelectedPhotos = () => {
      const checkedCount = selectedPhotos.filter((photo) => photo.checked).length;
      selection.textContent = selectedPhotos.length
        ? `${selectedPhotos.length}개 중 ${checkedCount}개를 업로드합니다. 제외할 파일은 체크를 해제해 주세요.`
        : "선택된 파일이 없습니다.";
      selectionGrid.innerHTML = selectedPhotos.map((photo, index) => `
        <label class="guest-photo-selection-card">
          ${photo.file.type.startsWith("video/") ? '<span class="guest-video-file"><strong>VIDEO</strong><small>업로드할 영상</small></span>' : `<img src="${escapeHtml(photo.previewUrl)}" alt="선택한 사진 ${index + 1} 미리보기">`}
          <span><input type="checkbox" data-guest-photo-choice="${index}" ${photo.checked ? "checked" : ""}> 업로드 선택</span>
        </label>`).join("");
    };
    files.addEventListener("change", () => {
      selectedPhotos.push(...[...files.files].map((file) => ({ file, checked: true, previewUrl: URL.createObjectURL(file) })));
      files.value = "";
      renderSelectedPhotos();
    });
    selectionGrid.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-guest-photo-choice]");
      if (!checkbox) return;
      selectedPhotos[Number(checkbox.dataset.guestPhotoChoice)].checked = checkbox.checked;
      renderSelectedPhotos();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const uploadFiles = selectedPhotos.filter((photo) => photo.checked).map((photo) => photo.file);
      if (!uploadFiles.length) {
        alert("업로드할 사진 또는 영상을 하나 이상 선택해 주세요.");
        return;
      }
      selectedPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      closeModal();
      showUploadStatus({ total: uploadFiles.length });
      window.RSVP_STORAGE.uploadGuestPhotos(uploadFiles, showUploadStatus)
        .then(() => showUploadStatus({ completed: uploadFiles.length, total: uploadFiles.length, percent: 100, state: "complete", message: "신랑 신부에게 소중한 순간을 전달했습니다." }))
        .catch((error) => showUploadStatus({ total: uploadFiles.length, state: "error", message: error.message || "파일을 업로드하지 못했습니다." }));
    });
  });

  document.querySelector("#guest-photo-manage")?.addEventListener("click", openOwnGuestPhotos);

  document.querySelector("#guestbook-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.querySelector("#guestbook-submit");
    const fields = new FormData(form);
    button.disabled = true;
    button.textContent = "등록 중...";
    try {
      await window.RSVP_STORAGE.submitGuestbookEntry({
        guest_name: fields.get("guest_name").trim(),
        message: fields.get("message").trim(),
      });
      guestbookEntries = await window.RSVP_STORAGE.loadGuestbookEntries();
      document.querySelector("#guestbook-list").innerHTML = guestbookMarkup();
      form.reset();
      button.disabled = false;
      button.textContent = "메시지 남기기";
    } catch {
      button.disabled = false;
      button.textContent = "메시지 남기기";
      alert("메시지를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });

  document.querySelector("#share-button").addEventListener("click", () => {
    openModal(shareModal());
    bindShareModal();
  });
}

function applyLayoutTemplate(layoutId) {
  const params = new URLSearchParams(location.search);
  const urlOverride = params.get("__layout");
  const isThumb = params.get("__thumb") === "1";
  if (isThumb) document.body.classList.add("is-thumb");
  // 미리보기(썸네일/레이아웃 미리보기)는 영상 대신 이미지로 표시
  if ((isThumb || params.get("__heroimg") === "1") && data?.hero?.image) data.hero.activeMedia = "image";
  const id = urlOverride || layoutId || "classic";
  document.body.dataset.layout = id;
  // 레이아웃 템플릿 커스텀 속성 적용 (heroBgImage, textScale)
  const templates = data?.designSystem?.layoutTemplates || [];
  const tpl = templates.find((t) => t.id === id);
  const root = document.documentElement;
  if (tpl?.heroBgImage) {
    root.style.setProperty("--layout-hero-bg-image", `url("${tpl.heroBgImage}")`);
  } else {
    root.style.removeProperty("--layout-hero-bg-image");
  }
  if (tpl?.textScale && tpl.textScale !== 1) {
    root.style.setProperty("--layout-text-scale", String(tpl.textScale));
  } else {
    root.style.removeProperty("--layout-text-scale");
  }
}

function applyAIThemePreviewOverride() {
  if (new URLSearchParams(location.search).get("__aiPreview") !== "1") return;
  let payload;
  try { payload = JSON.parse(sessionStorage.getItem("ai_theme_preview") || "null"); } catch { payload = null; }
  if (!payload?.palette || !Object.keys(payload.palette).length) return;
  window.WEDDING_DESIGN.normalize(data);
  const system = data.designSystem;
  const isMovie = payload.type === "movie";
  const theme = { id: "__ai_preview__", name: payload.name || "AI 미리보기", type: isMovie ? "movie" : "color", enabled: true, palette: payload.palette };
  if (isMovie) {
    theme.heroDecoration = payload.heroDecoration || "none";
    theme.heroTextTheme = payload.heroTextTheme || "default_center";
  }
  system.themes = system.themes.filter((item) => item.id !== "__ai_preview__");
  system.themes.push(theme);
  data.appearance.design = { ...data.appearance.design, presetId: "__ai_preview__", heroDecoration: "inherit", heroTextTheme: "inherit" };
}

async function start() {
  applyAppearance(data.appearance);
  data = await window.RSVP_STORAGE.loadInvitationData(data);
  normalizeWeddingDisplayDate();
  applyAIThemePreviewOverride();
  try { guestbookEntries = await window.RSVP_STORAGE.loadGuestbookEntries(); }
  catch { guestbookEntries = []; }
  applyAppearance(data.appearance);
  applyLayoutTemplate(data.designSystem?.activeLayoutId);
  weddingDate = new Date(data.wedding.date);
  document.title = data.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", data.meta.description);
  updateSocialMeta();
  render();
  if (isCopyEditorPreview) {
    document.body.classList.add("copy-editor-public-preview");
    document.querySelector("[data-invitation-intro]")?.remove();
  } else {
    playInvitationIntro();
  }
  applyResponsiveText();
  loadLazyBackgrounds();
  arrangeEditorialGallery();
  updateCountdown();
  bindEvents();
  setInterval(updateCountdown, 1000);
}

function applyResponsiveText() {
  fitSingleLineText();
  window.WEDDING_DESIGN?.applyTextStyles?.(data, document);
}

start();
window.addEventListener("resize", applyResponsiveText);
document.fonts?.ready.then(applyResponsiveText);
