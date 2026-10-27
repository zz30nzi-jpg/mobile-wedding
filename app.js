let data = window.INVITATION_DATA;
const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const pageParams = new URLSearchParams(location.search);
// 개인 링크(?to=홍길동)로 들어오면 봉투에 "to. 홍길동"을 보여 줌. 이름 없는 링크는 원래 봉투 그대로
const guestName = String(pageParams.get("to") || "").trim().slice(0, 20);
// 이 값이 있으면 특정 청첩장·미리보기를 보는 중이라 관리자 페이지로 보내지 않음
const hasCardContext = ["card", "invitation", "__layout", "__thumb", "previewSectionMode", "copyEditorPreview"].some((key) => pageParams.has(key));

function redirectOAuthCallbackToAdmin() {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const hasAuthCallback = pageParams.has("code") || pageParams.has("error") || hashParams.has("access_token") || hashParams.has("refresh_token") || hashParams.has("error");
  if (hasAuthCallback && !hasCardContext) {
    location.replace(`${location.origin}/admin.html${location.search}${location.hash}`);
  }
}

redirectOAuthCallbackToAdmin();

async function redirectSignedInAdminFromRoot() {
  const isRootInvitationPage = ["/", "/index.html"].includes(location.pathname);
  if (!isRootInvitationPage || hasCardContext) return;
  try {
    const client = window.RSVP_STORAGE?.getSupabaseClient?.();
    const { data: sessionData } = client ? await client.auth.getSession() : { data: {} };
    const user = sessionData.session?.user;
    if (user && !user.is_anonymous) location.replace(`${location.origin}/admin.html`);
  } catch (error) {
    console.warn("[public auth redirect]", error);
  }
}

redirectSignedInAdminFromRoot();

const sharedUtils = window.WEDDING_UTILS || {};
const sectionRegistry = window.WEDDING_SECTIONS || {};
// shared-utils.js는 index.html에서 항상 먼저 로드됩니다(실패 시 부팅 중단).
const { escapeHtml, escapeLineHtml, emphasisHtml, dateInputToday, TRANSPORT_TYPES, normalizeTransportTitle, normalizeTransportLines, noticeRowsHtml } = sharedUtils;
const WEEKDAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const stripEmphasis = (value = "") => String(value).replace(/\*\*([^*\n]+?)\*\*/g, "$1");
const transportType = (title) => TRANSPORT_TYPES.find((type) => type.label === normalizeTransportTitle(title)) || TRANSPORT_TYPES[0];
// 티켓 오른쪽 칸: 날짜가 주인공, 시간은 그 아래 한 줄로
const locationTicketStub = () => {
  if (!weddingDate || Number.isNaN(weddingDate.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  const hours = weddingDate.getHours();
  const time = `${hours % 12 || 12}:${pad(weddingDate.getMinutes())}`;
  return `<div class="location-ticket-stub" aria-label="예식 일시">
    <span class="ticket-year">${weddingDate.getFullYear()}</span>
    <strong class="ticket-date">${pad(weddingDate.getMonth() + 1)}.${pad(weddingDate.getDate())}</strong>
    <span class="ticket-day">${WEEKDAYS_EN[weddingDate.getDay()]}</span>
    <i class="ticket-rule" aria-hidden="true"></i>
    <span class="ticket-time">${time}<small>${hours < 12 ? "AM" : "PM"}</small></span>
  </div>`;
};

const transportPanelHtml = (item) => {
  const type = transportType(item.title);
  const lines = normalizeTransportLines(item);
  return `<div class="transport-head"><span class="transport-icon" aria-hidden="true">${type.icon}</span><strong>${escapeHtml(type.label)}</strong></div>
    <ul class="transport-lines">${lines.map((line) => `<li><span class="transport-line-icon" aria-hidden="true">${escapeHtml(line.icon)}</span><span>${escapeLineHtml(line.text)}</span></li>`).join("")}</ul>`;
};
const mediaUrl = (src = "") => window.RSVP_STORAGE?.mediaPublicUrl?.(src) || src || "";
const mediaStyle = (src) => mediaUrl(src) ? `style="background-image:url('${escapeHtml(mediaUrl(src))}')"` : "";
const lazyMediaStyle = (src) => mediaUrl(src) ? `data-lazy-background="${escapeHtml(mediaUrl(src))}"` : "";
// 메인 영상은 방문마다 파일 전체를 내려받아 egress가 커서 사용하지 않음 — 첫 화면은 항상 이미지
const tel = (number) => `tel:${String(number).replace(/[^0-9+]/g, "")}`;
let invitationMusicAudio = null;
let invitationMusicButton = null;
let invitationMusicResumeBound = false;
let invitationMusicMuted = false;
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
  const day = WEEKDAYS_KO[date.getDay()];
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
  const customDisplayDate = wedding.displayDateCustom?.trim?.() || "";
  if (customDisplayDate) {
    data.wedding.displayDate = customDisplayDate;
    return;
  }
  data.wedding.displayDate = weddingDisplayDateText(wedding.date, format) || wedding.displayDate || "";
}

function invitationMusicConfig() {
  const music = data.music || {};
  const src = String(music.src || "").trim();
  if (!src || music.enabled === false) return null;
  const rawVolume = Number(music.volume);
  const volume = Number.isFinite(rawVolume) ? rawVolume : 0.25;
  return { src: mediaUrl(src), volume: Math.max(0, Math.min(1, volume)) };
}

function givenName(name = "") {
  const chars = Array.from(String(name || "").trim().replace(/\s+/g, ""));
  return chars.length > 1 ? chars.slice(1).join("") : chars.join("");
}

function invitationMusicStoryLabel() {
  const groom = givenName(data.couple?.groom?.name) || "groom";
  const bride = givenName(data.couple?.bride?.name) || "bride";
  return `${groom}♥${bride} story song`;
}

function updateInvitationMusicButton(isPlaying = false) {
  if (!invitationMusicButton) return;
  invitationMusicButton.classList.toggle("is-playing", isPlaying);
  invitationMusicButton.setAttribute("aria-label", isPlaying ? "배경음악 끄기" : "배경음악 켜기");
  invitationMusicButton.setAttribute("title", `${invitationMusicStoryLabel()} ${isPlaying ? "on" : "off"}`);
}

function showInvitationMusicToast() {
  invitationMusicButton?.classList.add("is-visible");
}

// Mobile browsers only unlock audio on click/touchend/keydown (not pointerdown or scroll).
const invitationMusicUnlockEvents = ["click", "touchend", "keydown"];

function bindInvitationMusicResume() {
  if (invitationMusicResumeBound) return;
  invitationMusicResumeBound = true;
  const resume = (event) => {
    // The toggle button handles its own tap; resuming here too would play then instantly pause.
    if (event.target?.closest?.(".music-toggle")) return;
    invitationMusicUnlockEvents.forEach((type) => document.removeEventListener(type, resume, true));
    invitationMusicResumeBound = false;
    playInvitationMusic();
  };
  invitationMusicUnlockEvents.forEach((type) => document.addEventListener(type, resume, true));
}

function bindInvitationMusicVisibility() {
  let resumeOnReturn = false;
  document.addEventListener("visibilitychange", () => {
    if (!invitationMusicAudio) return;
    if (document.hidden) {
      resumeOnReturn = !invitationMusicAudio.paused;
      invitationMusicAudio.pause();
      return;
    }
    if (resumeOnReturn) playInvitationMusic();
    resumeOnReturn = false;
  });
}

function playInvitationMusic() {
  if (!invitationMusicAudio || invitationMusicMuted) return;
  invitationMusicAudio.play()
    .then(() => updateInvitationMusicButton(true))
    .catch(() => {
      updateInvitationMusicButton(false);
      bindInvitationMusicResume();
    });
}

function setupInvitationMusic() {
  const config = invitationMusicConfig();
  if (!config) return;
  invitationMusicAudio = new Audio(config.src);
  invitationMusicAudio.loop = true;
  // 곡 전체를 페이지 열 때 받지 않고, 재생할 때 받아 오며 재생(음악을 안 켜는 방문자는 받지 않음, 봉투 애니메이션과 다운로드가 겹치지 않음)
  invitationMusicAudio.preload = "metadata";
  invitationMusicAudio.volume = config.volume;
  invitationMusicButton = document.createElement("button");
  invitationMusicButton.type = "button";
  invitationMusicButton.className = "music-toggle";
  invitationMusicButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="music-toggle-note"><path d="M9 17.5V6.2l10-2.2v11.3"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.4" r="2.4"/></g><path class="music-toggle-slash" d="M4 4l16 16"/></svg>';
  invitationMusicButton.setAttribute("aria-label", "배경음악 켜기");
  invitationMusicButton.addEventListener("click", () => {
    if (!invitationMusicAudio) return;
    if (invitationMusicAudio.paused) {
      invitationMusicMuted = false;
      playInvitationMusic();
    } else {
      invitationMusicMuted = true;
      invitationMusicAudio.pause();
      updateInvitationMusicButton(false);
    }
  });
  invitationMusicAudio.addEventListener("error", () => {
    console.warn("배경음악 파일을 불러오지 못했습니다:", config.src);
    invitationMusicButton?.remove();
    invitationMusicButton = null;
  });
  bindInvitationMusicVisibility();
  document.body.appendChild(invitationMusicButton);
  updateInvitationMusicButton(false);
  // 토스트처럼 잠깐 떴다 사라지지 않고, 우측 하단에 항상 작게 고정 표시합니다.
  invitationMusicButton.classList.add("is-visible");
}
let weddingDate;
let guestbookEntries = [];
let guestbookVisibleCount = 3;
let galleryPreviewImages = [];
const galleryImagePreloads = new Set();
let modalScrollY = 0;
// section-registry.js·design-system.js는 index.html에서 항상 먼저 로드됩니다(실패 시 부팅 중단).
const defaultSectionSettings = sectionRegistry.defaultSettings;

function applyAppearance() {
  return window.WEDDING_DESIGN.apply(data);
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
  const invitationText = stripEmphasis(data.invitation?.paragraphs?.join(" ") || "") || data.meta.description;
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

// 메인 이름 사이 구분 기호(관리자 '문구' 탭): 가운뎃점 또는 하트
function heroNameSeparatorHtml(kind) {
  return kind === "heart" ? '<span class="hero-name-sep is-heart" role="img" aria-label="하트"><svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.6 10.3 20C4.2 14.5 0 10.7 0 6.1 0 2.6 2.7 0 6.1 0c2 0 3.9.9 5.9 3.1C14 .9 15.9 0 17.9 0 21.3 0 24 2.6 24 6.1c0 4.6-4.2 8.4-10.3 13.9z"/></svg></span>' : "<span>·</span>";
}

// 메인 사진 보이는 영역(관리자 '보이는 영역 맞추기'): 원본은 그대로 두고 확대·중심점만 적용
function applyHeroImageFrame(element, frame) {
  if (!element) return null;
  const enabled = frame && frame.enabled && (Number(frame.zoom) > 100 || Number(frame.x) !== 50 || Number(frame.y) !== 50);
  if (!enabled) {
    element.style.removeProperty("background-size");
    element.style.removeProperty("background-position");
    delete element.dataset.imageFrame;
    return null;
  }
  const zoom = Math.max(1, (Number(frame.zoom) || 100) / 100);
  const x = Math.max(0, Math.min(100, Number(frame.x) || 0));
  const y = Math.max(0, Math.min(100, Number(frame.y) || 0));
  const boxWidth = element.clientWidth || 1;
  const boxHeight = element.clientHeight || 1;
  const ratio = Number(frame.ratio) || boxWidth / boxHeight;
  // cover 기준 크기 × 확대
  const coverScale = Math.max(boxWidth / ratio, boxHeight);
  const imageHeight = coverScale * zoom;
  const imageWidth = imageHeight * ratio;
  element.dataset.imageFrame = "on";
  element.style.setProperty("background-size", `${Math.round(imageWidth)}px ${Math.round(imageHeight)}px`, "important");
  element.style.setProperty("background-position", `${x}% ${y}%`, "important");
  return { boxWidth, boxHeight, imageWidth, imageHeight };
}

function syncHeroImageFrame() {
  const element = document.querySelector(".hero-media");
  if (!element || !data?.hero) return;
  const frame = data.hero.imageFrame;
  if (frame?.enabled && !(Number(frame.ratio) > 0) && data.hero.image) {
    const probe = new Image();
    probe.onload = () => {
      frame.ratio = probe.naturalWidth / probe.naturalHeight;
      applyHeroImageFrame(element, frame);
    };
    probe.src = mediaUrl(data.hero.image);
    return;
  }
  applyHeroImageFrame(element, frame);
}

function syncInterludeFrame() {
  const element = document.querySelector(".photo-interlude-media");
  if (!element) return;
  const frame = data?.media?.interludeFrame;
  applyHeroImageFrame(element, frame && Number(frame.ratio) > 0 ? frame : null);
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
  const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  let cells = "";
  for (let off = -2; off <= 2; off++) {
    const d = new Date(weddingDate);
    d.setDate(weddingDate.getDate() + off);
    const isWed = off === 0;
    cells += `<div class="day-cell${isWed ? " day-wedding" : ""}">
      <span class="day-week">${WEEKDAYS_EN[d.getDay()]}</span>
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
      <caption><span class="calendar-month-name">${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]}</span><span class="calendar-year-month">${year}. ${String(month + 1).padStart(2, "0")}</span></caption>
      <thead><tr>${WEEKDAYS_KO.map((item) => `<th>${item}</th>`).join("")}</tr></thead>
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
  // "의 아들"처럼 조사로 시작하면 부모 이름에 붙여 씀
  return relation.startsWith("의") ? `${parents}${relation}` : [parents, relation].filter(Boolean).join(" ");
}

function hasAnyParent(person = {}) {
  return String(person.parents || "").split("·").map((item) => item.trim()).filter(Boolean).length >= 1;
}

function invitationParentLine(role, person = {}) {
  const name = String(person.name || "").trim();
  if (!name) return "";
  // 세로 2줄: [부모님의 아들] / [이름]
  const parentText = parentDisplay(person);
  return `<span class="parents-line"><span class="parents-names">${escapeHtml(parentText)}</span><strong>${escapeHtml(name)}</strong></span>`;
}

function publicPeriodStatus() {
  if (isCopyEditorPreview) return { visible: true };
  const today = dateInputToday();
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

function galleryImages() {
  return data.gallery.filter(Boolean).slice(0, 30);
}

function galleryThumbAt(index) {
  return data.galleryThumbs?.[index] || data.gallery[index] || "";
}

function preloadGalleryImage(url = "") {
  const source = mediaUrl(url);
  if (!source || galleryImagePreloads.has(source)) return;
  galleryImagePreloads.add(source);
  const image = new Image();
  image.decoding = "async";
  image.src = source;
}

// egress 절약: 큰 원본은 실제로 볼 때만 받고, 다음 사진은 작은 사진(17~58KB)만 미리 받아 넘길 때 바로 보이게 함
function warmGalleryNeighbors(index = 0) {
  const images = galleryImages();
  if (!images.length) return;
  const center = Number.isFinite(Number(index)) ? Number(index) : 0;
  const next = (center + 1 + images.length) % images.length;
  preloadGalleryImage(galleryThumbAt(next) || images[next]);
}

// 아래 작은 사진 목록: 지금 사진 앞뒤 2장씩 최대 5장만(보이는 만큼만 받음)
function galleryThumbStrip(index = 0) {
  const images = galleryImages();
  const count = Math.min(5, images.length);
  const start = Math.max(0, Math.min(index - 2, images.length - count));
  const thumbs = Array.from({ length: count }, (_, offset) => start + offset).map((thumbIndex) =>
    `<button type="button" class="${thumbIndex === index ? "is-active" : ""}" data-gallery-jump="${thumbIndex}" aria-label="${thumbIndex + 1}번째 사진 보기"><img src="${escapeHtml(mediaUrl(galleryThumbAt(thumbIndex)) || mediaUrl(images[thumbIndex]))}" alt="" decoding="async"></button>`).join("");
  // 앞뒤에 사진이 더 있으면 끝에 반투명 칸(+장 수)으로 알려 줌. 사진은 불러오지 않고, 누르면 그쪽으로 이동
  const before = start;
  const after = images.length - (start + count);
  const hint = (left, target) => `<button type="button" class="gallery-thumb-more" data-gallery-jump="${target}" aria-label="${left}장 더 보기">+${left}</button>`;
  return `${before > 0 ? hint(before, start - 1) : ""}${thumbs}${after > 0 ? hint(after, start + count) : ""}`;
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
  const entriesToShow = visibleEntries.slice(0, guestbookVisibleCount);
  const hasMore = visibleEntries.length > guestbookVisibleCount;
  return visibleEntries.length
    ? `${entriesToShow.map((entry) => `
      <article class="guestbook-entry">
        <div><strong>${escapeHtml(entry.guest_name)}</strong><span>${escapeHtml(new Date(entry.created_at).toLocaleDateString("ko-KR"))}</span></div>
        <p>${escapeHtml(entry.message)}</p>
      </article>`).join("")}
      <button class="guestbook-more" type="button" id="guestbook-more" ${hasMore ? "" : "disabled"} aria-label="축하 메시지 더 보기">˘</button>`
    : '<p class="subtle">첫 번째 축하 메시지를 남겨 주세요.</p>';
}

function activeSectionOrder() {
  const previewMode = pageParams.get("previewSectionMode");
  if (previewMode === "preWedding" || previewMode === "weddingDay") {
    const previewOrder = data.sectionSettings?.[previewMode];
    return Array.isArray(previewOrder) ? previewOrder : defaultSectionSettings[previewMode];
  }
  const eventDate = String(data.wedding?.date || "").slice(0, 10) || "2026-10-04";
  const today = dateInputToday();
  const mode = today < eventDate ? "preWedding" : "weddingDay";
  const configured = data.sectionSettings?.[mode];
  return Array.isArray(configured) ? configured : defaultSectionSettings[mode];
}

const isCopyEditorPreview = pageParams.get("copyEditorPreview") === "1";

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
  return [...data.transport].sort((left, right) => {
    const rank = (item) => TRANSPORT_TYPES.findIndex((type) => type.label === normalizeTransportTitle(item.title));
    return rank(left) - rank(right);
  });
}

// 진입화면(봉투 또는 타이핑) 마크업
function introHtml() {
  const { groom, bride } = data.couple;
  const introDesign = data.hero.introDesign || {};
  const introAlign = ["left", "center", "right"].includes(introDesign.align) ? introDesign.align : "center";
  const introNumber = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const introStyle = `--intro-align:${introAlign};--intro-eyebrow-size:${introNumber(introDesign.eyebrowSize, 11, 8, 24)}px;--intro-name-size:${introNumber(introDesign.nameSize, 30, 20, 54)}px;--intro-date-size:${introNumber(introDesign.dateSize, 11, 8, 20)}px;--intro-eyebrow-name-gap:${introNumber(introDesign.eyebrowNameGap, 10, 0, 40)}px;--intro-name-date-gap:${introNumber(introDesign.nameDateGap, 10, -24, 40)}px;--intro-offset-y:${introNumber(introDesign.offsetY, 0, -160, 160)}px${window.ENVELOPE_INTRO.koFont(introDesign.koFont) ? `;--intro-ko-font:${window.ENVELOPE_INTRO.koFont(introDesign.koFont)}` : ""}`;
  const introEyebrow = escapeHtml(data.hero.introEyebrow || data.hero.eyebrow || "our wedding day");
  const introDateText = escapeHtml(data.hero.introDate || data.wedding.displayDate);
  const introNameText = escapeHtml(data.hero.introName || `${groom.name} · ${bride.name}`);
  // 봉투 모양·색 계산과 마크업은 관리자 미리보기와 같이 쓰도록 shared-utils.js(ENVELOPE_INTRO)에 있음
  const envelopeIntro = window.ENVELOPE_INTRO.render({ script: data.hero.introScript, to: guestName, name: data.hero.introName || `${groom.name} · ${bride.name}`, date: data.hero.introDate || data.wedding.displayDate, design: introDesign, unit: "cqw" });
  // 봉투 진입화면: 문구가 봉투 위에 이미 쓰여 있고, 탭하면 실링이 떨어지고 덮개가 열린 뒤 봉투가 내려가며 청첩장이 드러남
  const introMarkup = (introDesign.style || "typing") === "envelope"
    ? `
    <div class="invitation-intro envelope-intro" data-invitation-intro ${envelopeIntro.attrs}>
      ${envelopeIntro.stage}
    </div>`
    : `
    <div class="invitation-intro${introBlurImage() ? " has-soft-bg" : ""}" data-invitation-intro${introBackgroundStyle()}>
      <div class="invitation-intro-copy" style="${introStyle}">
        <p>${introEyebrow}</p>
        <strong data-intro-name></strong>
        <span>${introDateText}</span>
      </div>
    </div>`;
  return introMarkup;
}

// ── 청첩장 섹션별 마크업 (render()가 순서대로 이어 붙임) ──
function heroHtml() {
  const { groom, bride } = data.couple;
  // 받는 분 이름(?to=)이 있을 때만 메인 사진 위에 "to. 이름". 관리자 미리보기는 '받는 분' 탭을 연 동안만 예시 이름으로 보여 줌
  const heroToName = guestName || (isCopyEditorPreview ? "홍길동" : "");
  return `<header class="hero">
        <div class="media hero-media" ${mediaStyle(data.hero.image)} data-active-media="image"></div>
        ${heroToName ? `<p class="hero-to${guestName ? "" : " is-sample"}" data-hero-to>to. ${escapeHtml(heroToName)}</p>` : ""}
        <div class="hero-content hero-content-${escapeHtml(data.hero.contentPosition || "bottom")}">
          <p class="hero-eyebrow" data-main="${escapeHtml(data.hero.eyebrowMain || "Our Wedding")}" data-script="${escapeHtml(data.hero.eyebrowScript || "Day")}">${escapeHtml(data.hero.eyebrow)}</p>
          <h1 class="hero-names">${escapeHtml(groom.name)} ${heroNameSeparatorHtml(data.appearance?.design?.heroNameSeparator)} ${escapeHtml(bride.name)}</h1>
          <p class="hero-date single-line-fit">${escapeHtml(data.wedding.displayDate)}</p>
        </div>
      </header>`;
}

function invitationSectionHtml() {
  const { groom, bride } = data.couple;
  const displaySettings = data.displaySettings || {};
  const showParentLines = displaySettings.showInvitationParents !== false && hasAnyParent(groom) && hasAnyParent(bride);
  const parentsMarkup = showParentLines
    ? `${invitationParentLine("신랑", groom)}<span class="parents-heart">♥</span>${invitationParentLine("신부", bride)}`
    : `<span class="parents-line parents-line-simple"><strong>${escapeHtml(groom.name)}</strong> ♥ <strong>${escapeHtml(bride.name)}</strong></span>`;
  return `<section class="section" id="invitation">
        ${sectionCopy("invitation", "Invitation", data.invitation.title)}
        ${data.invitation.paragraphs.map((text) => `<p class="invitation-copy">${emphasisHtml(text)}</p>`).join("")}
        ${parentsMarkup ? `<p class="parents">${parentsMarkup}</p>` : ""}
        <div class="contact-row">
          <a class="btn" href="${tel(groom.phone)}">신랑에게 연락</a>
          <a class="btn" href="${tel(bride.phone)}">신부에게 연락</a>
        </div>
      </section>`;
}

function aboutUsSectionHtml() {
  const { groom, bride } = data.couple;
  const displaySettings = data.displaySettings || {};
  return `<section class="section" id="about-us">
        ${sectionCopy("aboutUs", "About Us", "저희를 소개합니다")}
        <div class="profile-grid">
          ${[["신랑", groom], ["신부", bride]].map(([role, person]) => `
            <article class="profile-card">
              <div class="media profile-photo" ${lazyMediaStyle(person.photo)}></div>
              <div class="profile-body">
                <h3 class="profile-name single-line-fit"><span class="profile-role">${role}</span><span class="profile-person-name">${escapeHtml(person.name)}</span></h3>
                ${displaySettings.showProfileParents !== false && parentDisplay(person) ? `<div class="profile-parents single-line-fit">${escapeHtml(parentDisplay(person))}</div>` : ""}
                ${displaySettings.showProfileBirthdays !== false && person.birthday ? `<div class="profile-birthday">${escapeHtml(person.birthday)}</div>` : ""}
                <div class="profile-mbti">${escapeHtml(person.mbti)}</div>
                <div class="profile-tags">${(person.tags || []).slice(0, 3).map((tag) => `<span class="tag">#${escapeHtml(String(tag).replace(/^#+/, ""))}</span>`).join(" ")}</div>
              </div>
            </article>`).join("")}
        </div>
      </section>`;
}

function weddingDaySectionHtml() {
  return `<section class="section" id="wedding-day">
        ${weddingDayTitleMarkup()}
        ${renderCalendar()}
        ${renderDayStrip()}
        <div class="countdown" id="countdown"></div>
        <p class="subtle" id="countdown-message"></p>
      </section>`;
}

function photoInterludeSectionHtml() {
  return `<section class="section photo-interlude" id="photo-interlude">
        <div class="photo-interlude-media media" ${lazyMediaStyle(data.media?.interludePhoto)}></div>
      </section>`;
}

function locationSectionHtml() {
  const location = venueParts();
  return `<section class="section" id="location">
        ${sectionCopy("location", "Location", "오시는 길")}
        <div class="location-ticket">
          <div class="location-ticket-main">
            <h3 class="location-venue single-line-fit">${escapeHtml(location.venue)}</h3>
            ${location.hall ? `<p class="location-hall">${escapeHtml(location.hall)}</p>` : ""}
            <p class="location-address">${escapeHtml(data.wedding.address)}</p>
            <button class="location-ticket-copy copy-btn" type="button" data-copy="${escapeHtml(data.wedding.address)}">주소 복사하기<span class="copy-toast" aria-hidden="true">복사완료</span></button>
          </div>
          ${locationTicketStub()}
        </div>
        <div class="map-links">
          <button class="btn copy-btn" data-map-app="copy" data-copy="${escapeHtml(data.wedding.address)}" aria-label="주소 복사" title="주소 복사"><span class="map-icon-label" aria-hidden="true"></span><span class="copy-toast" aria-hidden="true">복사완료</span></button>
          ${mapLinksForAddress(data.wedding.address).map((link) => `<a class="btn" data-map-app="${link.app}" ${link.fallbackUrl ? `data-map-fallback="${escapeHtml(link.fallbackUrl)}"` : ""} href="${escapeHtml(link.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(link.label)}" title="${escapeHtml(link.label)}"><span class="map-icon-label" aria-hidden="true"></span><span class="map-app-name">${escapeHtml(link.label)}</span></a>`).join("")}
        </div>
        <div class="transport">
          <div class="transport-list">
            ${sortedTransport().filter((item) => !item.hidden).map((item, index) => `
              <div class="transport-panel" data-transport-panel="${index}">${transportPanelHtml(item)}</div>`).join("")}
          </div>
        </div>
      </section>`;
}

function gallerySectionHtml(gallery) {
  return `<section class="section" id="gallery">
        ${sectionCopy("gallery", "Gallery", "갤러리")}
        <div class="gallery-grid">
          ${galleryPreviewImages.map((image, index) => `<button class="gallery-item" data-gallery="${gallery.indexOf(image)}" aria-label="사진 ${index + 1} 크게 보기"><span class="media" ${lazyMediaStyle(galleryThumbAt(gallery.indexOf(image)))}></span></button>`).join("")}
        </div>
        <div class="gallery-footer">
          <button class="btn gallery-more" id="gallery-more" aria-label="사진 더보기" title="사진 더보기">사진 더보기</button>
        </div>
      </section>`;
}

function informationSectionHtml() {
  return (data.notices || []).filter((notice) => !notice.hidden && notice.text?.trim()).length ? `<section class="section" id="information">
        ${sectionCopy("information", "Information", "식장 안내")}
        ${informationTabsMarkup()}
      </section>` : "";
}

function attendanceSectionHtml() {
  return `<section class="section" id="attendance">
        ${sectionCopy("attendance", "Rsvp", "참석 의사 전달")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.attendance || "신랑신부에게 참석의사를 미리 전달해주세요")}</p>
        <button class="btn btn-primary" id="attendance-open">전달하기</button>
        ${isCopyEditorPreview ? '<button class="btn copy-preview-detail-edit" type="button" data-preview-detail-edit="rsvp">✎ 세부내용 수정</button>' : ""}
      </section>`;
}

function accountSectionHtml() {
  return `<section class="section" id="account">
        ${sectionCopy("account", "Account", "마음 전하는 곳")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.account || "참석이 어려우신 분들을 위해\n계좌번호를 안내해 드립니다.")}</p>
        <div class="account-groups">${renderAccounts("신랑측")}${renderAccounts("신부측")}</div>
      </section>`;
}

function guestbookSectionHtml() {
  return `<section class="section" id="guestbook">
        ${sectionCopy("guestbook", "Guestbook", "축하 메시지")}
        <p class="subtle">${escapeLineHtml(data.sectionDescriptions?.guestbook || "따뜻한 마음을 짧게 남겨 주세요.")}</p>
        <button class="btn btn-primary" id="guestbook-open">작성하기</button>
        <div class="guestbook-list" id="guestbook-list">${guestbookMarkup()}</div>
      </section>`;
}

function endingHtml() {
  const { groom, bride } = data.couple;
  return `<section class="ending">
        <div class="media" ${lazyMediaStyle(data.ending.image)}></div>
        <div class="ending-content"><p class="preserve">${escapeHtml(data.ending.text)}</p><p class="ending-names">${escapeHtml(groom.name)} · ${escapeHtml(bride.name)}</p><button class="btn" id="share-button">청첩장 공유하기</button></div>
      </section>`;
}

function render() {
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
  const gallery = galleryImages();
  galleryPreviewImages = shuffledGalleryPreview(gallery);
  app.innerHTML = `
    ${introHtml()}
    <article class="invitation">
      ${heroHtml()}

      ${invitationSectionHtml()}

      ${aboutUsSectionHtml()}

      ${weddingDaySectionHtml()}

      ${photoInterludeSectionHtml()}

      ${locationSectionHtml()}

      ${gallerySectionHtml(gallery)}

      ${informationSectionHtml()}

      ${attendanceSectionHtml()}

      ${accountSectionHtml()}

      ${guestbookSectionHtml()}

      ${endingHtml()}
      <footer class="footer"></footer>
      <nav class="bottom-tabbar" aria-label="주요 메뉴">
        <a href="#wedding-day"><span>일정</span></a>
        <a href="#location"><span>장소</span></a>
        <a href="#information"><span>안내</span></a>
        <a href="#gallery"><span>사진</span></a>
        <a href="#attendance"><span>참석 여부</span></a>
        <a href="#guestbook"><span>방명록</span></a>
      </nav>
    </article>`;
  applySectionOrder();
  renderInvitationStickers();
}

function renderInvitationStickers() {
  const stickers = window.WEDDING_STICKERS;
  if (!stickers || !Array.isArray(data.stickers)) return;
  app.querySelectorAll(".invitation-sticker").forEach((node) => node.remove());
  data.stickers.map(stickers.normalize).forEach((item) => {
    const target = item.section === "ending" ? app.querySelector(".ending") : app.querySelector(`.section[id="${item.section}"]`);
    if (!target) return;
    target.insertAdjacentHTML("beforeend", stickers.markup(item));
    // 예전 스티커(섹션 높이 %): 지금 섹션 높이로 px로 바꿔 고정 → 토글을 열어도 따라 움직이지 않음
    if (item.top == null) target.lastElementChild.style.top = `${Math.round((item.y / 100) * target.offsetHeight)}px`;
  });
  // 편집 미리보기: 메인 사진은 스티커를 붙일 수 없는 곳이라 스티커 탭에서 흐리게 덮어 표시
  if (isCopyEditorPreview && !app.querySelector(".hero .sticker-no-place")) {
    app.querySelector(".hero")?.insertAdjacentHTML("beforeend", '<div class="sticker-no-place" aria-hidden="true"><span>메인 사진에는 스티커를 붙일 수 없어요</span></div>');
  }
}

// Admin sticker page embeds the invitation with ?stickerEditor=1 and talks to it via postMessage.
const isStickerEditorPreview = pageParams.get("stickerEditor") === "1";

function stickerTargetAt(x, y) {
  return document.elementsFromPoint(x, y)
    .map((node) => node.closest?.(".section[id], .ending"))
    .find(Boolean) || null;
}

function stickerTargetId(target) {
  return target?.classList.contains("ending") ? "ending" : target?.id || "";
}

function stickerPlacement(target, x, y) {
  const rect = target.getBoundingClientRect();
  const percent = (value) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
  return { section: stickerTargetId(target), x: percent(((x - rect.left) / rect.width) * 100), y: percent(((y - rect.top) / rect.height) * 100), top: Math.round(Math.max(0, y - rect.top)) };
}

function selectEditorSticker(id = "") {
  app.querySelectorAll(".invitation-sticker").forEach((node) => node.classList.toggle("is-selected", node.dataset.stickerId === id));
}

function postStickerEditor(message) {
  window.parent?.postMessage({ source: "wedding-sticker-editor", ...message }, location.origin);
}

function bindStickerEditor() {
  // 청첩장 화면 편집 미리보기 안에서 '스티커' 탭일 때만 켜짐(관리자가 mode 메시지로 켜고 끔)
  // 인스타그램 스토리처럼: 고른 손그림은 놓을 곳을 눌러 붙이고, 스티커를 끌어 옮기고, 두 손가락으로 크기·기울기를 바꿈.
  // 스티커가 아닌 곳을 한 손가락으로 쓸면 그대로 스크롤됨
  let active = false;
  const layer = document.createElement("div");
  layer.className = "sticker-gesture-layer";
  layer.hidden = true;
  const hint = document.createElement("p");
  hint.className = "sticker-place-hint";
  hint.hidden = true;
  hint.textContent = "스티커를 놓을 곳을 눌러 주세요";
  document.body.append(layer, hint);

  let selectedId = "";
  let pendingItem = null;
  const pointers = new Map();
  let gesture = null;
  const stickerElement = () => (selectedId ? app.querySelector(`.invitation-sticker[data-sticker-id="${selectedId}"]`) : null);
  const setSelected = (id) => {
    selectedId = id || "";
    selectEditorSticker(selectedId);
    layer.hidden = !selectedId;
  };
  const setPending = (item) => {
    pendingItem = item;
    hint.hidden = !item;
    document.body.classList.toggle("sticker-placing", Boolean(item));
  };
  const setActive = (on) => {
    active = Boolean(on);
    document.body.classList.toggle("sticker-editor-preview", active);
    document.body.classList.toggle("sticker-mode", active);
    // 스티커는 메인 사진에 붙일 수 없어서 스티커 탭에서는 메인 사진을 빼고 초대글부터 보여 줌
    if (active) window.scrollTo(0, 0);
    if (!active) {
      setPending(null);
      setSelected("");
      pointers.clear();
      gesture = null;
    }
  };
  const currentTransform = (sticker) => ({
    size: Number.parseFloat(sticker.style.getPropertyValue("--sticker-size")) || 84,
    rotate: Number.parseFloat(sticker.style.getPropertyValue("--sticker-rotate")) || 0,
  });
  const center = (sticker) => {
    const rect = sticker.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  // 제스처 레이어가 덮고 있어도 손가락 아래 스티커를 찾음
  const stickerAtPoint = (x, y) => document.elementsFromPoint(x, y).map((node) => node.closest?.(".invitation-sticker")).find(Boolean) || null;
  const twoPointers = () => [...pointers.values()].slice(0, 2);
  const distance = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);
  const angle = ([a, b]) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const startGesture = ({ afterPinch = false } = {}) => {
    const sticker = stickerElement();
    if (!sticker) return;
    const { size, rotate } = currentTransform(sticker);
    if (pointers.size >= 2) {
      const pair = twoPointers();
      gesture = { type: "pinch", sticker, size, rotate, distance: distance(pair) || 1, angle: angle(pair) };
      return;
    }
    const point = [...pointers.values()][0];
    if (point.onSticker) {
      const middle = center(sticker);
      gesture = { type: "drag", sticker, size, rotate, offsetX: point.x - middle.x, offsetY: point.y - middle.y, startX: point.x, startY: point.y, moved: afterPinch };
    } else {
      // 스티커 밖 한 손가락: 스크롤은 브라우저에 맡기고, 그냥 톡 누른 경우만 선택 해제
      gesture = { type: "tap", sticker, startX: point.x, startY: point.y, moved: afterPinch };
    }
  };

  const onDown = (event) => {
    if (!active) return;
    if (pendingItem) {
      // 놓을 곳을 누르면 그 자리에 붙임
      event.preventDefault();
      const target = stickerTargetAt(event.clientX, event.clientY);
      if (!target) {
        // 메인 사진처럼 붙일 수 없는 곳: 그대로 기다리며 안내만 바꿈
        hint.textContent = "여기에는 붙일 수 없어요. 다른 곳을 눌러 주세요";
        clearTimeout(hint._resetTimer);
        hint._resetTimer = setTimeout(() => { hint.textContent = "스티커를 놓을 곳을 눌러 주세요"; }, 1800);
        return;
      }
      postStickerEditor({ type: "placed", item: { ...pendingItem, ...stickerPlacement(target, event.clientX, event.clientY) } });
      setPending(null);
      return;
    }
    const hit = stickerAtPoint(event.clientX, event.clientY);
    if (hit && hit.dataset.stickerId !== selectedId) {
      setSelected(hit.dataset.stickerId);
      postStickerEditor({ type: "select", id: selectedId });
    }
    if (!selectedId) return;
    const onSticker = hit?.dataset.stickerId === selectedId;
    if (onSticker) {
      event.preventDefault();
      try { event.target.setPointerCapture?.(event.pointerId); } catch {}
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, onSticker });
    startGesture();
  };
  const onMove = (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { ...pointers.get(event.pointerId), x: event.clientX, y: event.clientY });
    const sticker = gesture.sticker;
    if (gesture.type === "pinch" && pointers.size >= 2) {
      const pair = twoPointers();
      const size = Math.round(Math.max(28, Math.min(240, gesture.size * (distance(pair) / gesture.distance))));
      let rotate = Math.round(gesture.rotate + (angle(pair) - gesture.angle));
      rotate = ((rotate + 540) % 360) - 180;
      sticker.style.setProperty("--sticker-size", `${size}px`);
      sticker.style.setProperty("--sticker-rotate", `${rotate}deg`);
      gesture.changed = true;
      return;
    }
    if (gesture.type === "tap") {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 6) gesture.moved = true;
      return;
    }
    if (gesture.type !== "drag") return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 4) return;
    gesture.moved = true;
    const x = event.clientX - gesture.offsetX;
    const y = event.clientY - gesture.offsetY;
    const target = stickerTargetAt(x, y);
    if (target) {
      if (sticker.parentElement !== target) target.appendChild(sticker);
      const placement = stickerPlacement(target, x, y);
      sticker.style.left = `${placement.x}%`;
      sticker.style.top = `${placement.top}px`;
      gesture.placement = placement;
    }
    if (event.clientY < 48) window.scrollBy(0, -10);
    else if (event.clientY > window.innerHeight - 48) window.scrollBy(0, 10);
  };
  const onUp = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    const ended = gesture;
    gesture = null;
    if (ended) {
      const { size, rotate } = currentTransform(ended.sticker);
      if (ended.type === "pinch" && ended.changed) postStickerEditor({ type: "transformed", id: selectedId, size, rotate });
      if (ended.type === "drag" && ended.moved && ended.placement) postStickerEditor({ type: "moved", id: selectedId, ...ended.placement });
      // 스티커 밖을 톡 누르면 선택 해제(스크롤하느라 손가락이 움직였거나 브라우저가 가져간 경우는 그대로)
      if (ended.type === "tap" && !ended.moved && event.type === "pointerup") {
        setSelected("");
        postStickerEditor({ type: "select", id: "" });
      }
    }
    if (pointers.size && selectedId) startGesture({ afterPinch: ended?.type === "pinch" });
  };
  document.addEventListener("pointerdown", onDown, { passive: false });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  // 컴퓨터: 고른 스티커 위에서 휠 = 크기, Shift+휠 = 기울기(스티커 밖에서는 평소처럼 스크롤)
  document.addEventListener("wheel", (event) => {
    const sticker = stickerElement();
    if (!active || !sticker || stickerAtPoint(event.clientX, event.clientY) !== sticker) return;
    event.preventDefault();
    const { size, rotate } = currentTransform(sticker);
    if (event.shiftKey) sticker.style.setProperty("--sticker-rotate", `${Math.max(-180, Math.min(180, rotate + Math.sign(event.deltaY) * 3))}deg`);
    else sticker.style.setProperty("--sticker-size", `${Math.max(28, Math.min(240, size - Math.sign(event.deltaY) * 4))}px`);
    clearTimeout(sticker._wheelTimer);
    sticker._wheelTimer = setTimeout(() => postStickerEditor({ type: "transformed", id: selectedId, ...currentTransform(sticker) }), 200);
  }, { passive: false });

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.data?.source !== "wedding-sticker-admin") return;
    const message = event.data;
    if (message.type === "mode") {
      setActive(message.active);
    } else if (message.type === "scroll") {
      // 저장 뒤 미리보기를 새로 그려도 보던 위치 그대로(부드러운 스크롤 없이 바로)
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, Number(message.y) || 0);
      requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = ""; });
    } else if (message.type === "set") {
      data.stickers = Array.isArray(message.stickers) ? message.stickers : [];
      renderInvitationStickers();
      setSelected(active ? message.selectedId || "" : "");
    } else if (message.type === "focus") {
      app.querySelector(`.invitation-sticker[data-sticker-id="${message.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (message.type === "arm") {
      // 팔레트에서 고른 스티커: 다음에 누르는 곳에 붙음
      setSelected("");
      setPending(message.item);
    }
  });
  setActive(isStickerEditorPreview);
  postStickerEditor({ type: "ready" });
}

function renderInvitationLoadError(error) {
  document.documentElement.classList.add("theme-ready");
  const status = error?.publicInvitationStatus || "network_error";
  const titleMap = {
    not_found: "존재하지 않는 청첩장입니다",
    disabled: "현재 공개되지 않은 청첩장입니다",
    empty: "청첩장 설정이 아직 완료되지 않았습니다",
    setup_error: "청첩장을 불러오지 못했습니다",
    network_error: "청첩장을 불러오지 못했습니다",
  };
  const textMap = {
    not_found: "주소가 정확한지 다시 확인해 주세요.",
    disabled: "공개 기간이 아니거나 관리자가 공개를 중지했습니다.",
    empty: "관리자가 청첩장 기본 설정을 완료한 뒤 다시 확인해 주세요.",
    setup_error: "서비스 설정이 아직 반영되지 않았습니다. 잠시 후 다시 시도해주세요.",
    network_error: "잠시 후 다시 시도해주세요.",
  };
  app.innerHTML = `
    <main class="invitation-closed" role="main" data-public-load-status="${escapeHtml(status)}">
      <div>
        <p class="section-label">Wedding Invitation</p>
        <h1>${escapeHtml(titleMap[status] || titleMap.network_error)}</h1>
        <p>${escapeHtml(textMap[status] || textMap.network_error)}</p>
      </div>
    </main>`;
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
  if (!document.body.classList.contains("modal-open")) {
    modalScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add("modal-open");
    document.body.style.top = `-${modalScrollY}px`;
  }
  modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal">${content}</div></div>`;
  document.querySelector("#modal-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });
  document.querySelector("[data-close]")?.addEventListener("click", closeModal);
}
function closeModal() {
  const restoreScrollY = modalScrollY;
  const previousScrollBehavior = document.documentElement.style.scrollBehavior;
  modalRoot.innerHTML = "";
  document.documentElement.style.scrollBehavior = "auto";
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  window.scrollTo({ top: restoreScrollY, left: 0, behavior: "instant" });
  requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
  });
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
  const locationUrl = mapRedirectUrl();
  const imageUrl = mediaUrl(data.meta.shareImage || data.hero.image);

  // 카카오 카드는 이미지가 필수라, 공유 이미지·메인 사진이 없으면 기본 공유(앱 공유/링크 복사)로 넘긴다.
  if (!imageUrl) return false;

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: data.meta.title,
      description: String(data.meta.description || "").trim() || `${data.wedding.displayDate}\n${data.wedding.venue}`,
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

// 진입화면 흐린 배경: 저장 시 만들어 둔 아주 작은 사진(hero.introBlur)을 늘려 쓰면 blur 계산 없이 부드럽게 흐려 보임.
// 아직 없으면(관리자에서 저장 전) 원본 메인 사진에 CSS blur를 한 번 그려 사용
function introBlurImage() {
  const blur = String(data.hero?.introBlur || "");
  return blur.startsWith("data:image/") && data.hero?.introBlurSource === data.hero?.image ? blur : "";
}

function introBackgroundStyle() {
  const source = introBlurImage() || mediaUrl(data.hero.image);
  return source ? ` style="--intro-bg-image:url('${escapeHtml(source)}')"` : "";
}

function playInvitationIntro() {
  const intro = document.querySelector("[data-invitation-intro]");
  const target = document.querySelector("[data-intro-name]");
  if (!intro || !target) {
    showInvitationMusicToast();
    playInvitationMusic();
    return;
  }
  const preventIntroAction = (event) => event.preventDefault();
  const preventIntroKey = (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"].includes(event.key)) event.preventDefault();
  };
  // 진입화면 동안 스크롤만 막음. 예전처럼 body를 position:fixed로 고정했다 풀면
  // 끝나는 순간 페이지 전체 배치를 다시 계산해 버벅이고 화면이 살짝 흔들렸음
  document.documentElement.classList.add("intro-lock");
  document.body.classList.add("intro-open");
  window.addEventListener("wheel", preventIntroAction, { passive: false });
  window.addEventListener("touchmove", preventIntroAction, { passive: false });
  window.addEventListener("keydown", preventIntroKey);
  const unlockScroll = () => {
    document.documentElement.classList.remove("intro-lock");
    document.body.classList.remove("intro-open");
    window.removeEventListener("wheel", preventIntroAction);
    window.removeEventListener("touchmove", preventIntroAction);
    window.removeEventListener("keydown", preventIntroKey);
  };
  const unlock = () => {
    unlockScroll();
    // 다 사라진 진입화면 레이어(흐린 사진)를 치워 스크롤할 때 그래픽 메모리를 차지하지 않게 함
    intro.remove();
  };
  if (intro.dataset.introStyle === "envelope") {
    const stage = intro.querySelector("[data-envelope-open]");
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      // 탭 동작 안에서 음악을 시작해야 브라우저 자동재생 차단에 걸리지 않음
      playInvitationMusic();
      intro.classList.add("is-opening");
      // 봉투 아래·씰은 뚜껑이 열린 직후(0.7s)부터 0.85s 동안 내려감 → 1.55s에 끝.
      // 그때부터 배경이 사라지는 동안(0.7s)에도 바로 스크롤할 수 있게 하고(is-finished는 터치를 통과시킴),
      // 레이어는 다 사라진 뒤에 치움
      setTimeout(() => {
        intro.classList.add("is-finished");
        unlockScroll();
        showInvitationMusicToast();
      }, 1550);
      setTimeout(() => intro.remove(), 2300);
    };
    stage?.addEventListener("click", open);
    stage?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open();
    });
    return;
  }
  const text = data.hero.introName || `${data.couple.groom.name} · ${data.couple.bride.name}`;
  // 타이핑하는 동안 메인 사진을 미리 받아 해독해 두어, 진입화면이 사라질 때 사진 해독이 겹쳐 끊기지 않게 함
  const heroSource = mediaUrl(data.hero.image);
  const heroReady = heroSource
    ? Promise.race([
      (() => { const image = new Image(); image.src = heroSource; return image.decode(); })().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    : Promise.resolve();
  let index = 0;
  // 글꼴이 페이드 도중에 늦게 도착하면 글자를 다시 그리며 끊기므로, 사진과 함께 준비된 뒤 시작(최대 1.5초)
  const fontsReady = document.fonts?.ready ? Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]) : Promise.resolve();
  const finish = async () => {
    await Promise.all([heroReady, fontsReady]);
    // 다음 프레임에 시작해야 클래스 변경이 한 프레임 안에서 레이아웃 작업과 겹치지 않음
    requestAnimationFrame(() => {
      intro.classList.add("is-finished");
      setTimeout(() => {
        unlock();
        showInvitationMusicToast();
        playInvitationMusic();
      }, 720);
    });
  };
  const typeNext = () => {
    target.textContent = text.slice(0, index += 1);
    if (index < text.length) setTimeout(typeNext, 95);
    else setTimeout(finish, 850);
  };
  setTimeout(typeNext, 350);
}

// 기본 청첩장(main)이 아니면 ?card=슬러그 를 붙임
function cardQuery() {
  const slug = window.RSVP_STORAGE?.getActiveInvitationSlug?.() || "";
  // 이 배포의 기본 청첩장은 ?card= 없이도 열리므로 붙이지 않음(짧은 주소)
  return slug && slug !== "main" && slug !== window.RSVP_STORAGE?.SITE_CARD_SLUG ? `?card=${encodeURIComponent(slug)}` : "";
}

function sharePageUrl() {
  return `${location.origin}/api/share${cardQuery()}`;
}

// 카카오 공유 "위치 보기" 버튼: /api/map 이 예식장 주소의 카카오맵 검색으로 넘겨 준다
function mapRedirectUrl() {
  return `${location.origin}/api/map${cardQuery()}`;
}

async function copyInvitationLink() {
  await navigator.clipboard.writeText(sharePageUrl());
  closeModal();
  alert("청첩장 주소를 복사했습니다.");
}

function bindShareModal() {
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
    catch { alert(`청첩장 주소: ${sharePageUrl()}`); }
  });
}

function attendanceForm() {
  return `
    <div class="gallery-slider-head">
      <h2>참석 의사 전달</h2>
      <button class="gallery-close" type="button" data-close aria-label="닫기">×</button>
    </div>
    <form class="form-grid" id="attendance-form">
      <section class="rsvp-choice-group" data-rsvp-toggle="side">
        <span>어느 측 하객이신가요? <b class="req">*</b></span>
        <input type="hidden" name="side" value="신랑측">
        <div class="rsvp-choice-list cols-2">
          <button class="is-active" type="button" data-value="신랑측">신랑</button>
          <button type="button" data-value="신부측">신부</button>
        </div>
      </section>
      <section class="rsvp-choice-group" data-rsvp-toggle="attendance">
        <span>참석 하시나요? <b class="req">*</b></span>
        <input type="hidden" name="attendance" value="참석">
        <div class="rsvp-choice-list cols-2">
          <button class="is-active" type="button" data-value="참석">참석</button>
          <button type="button" data-value="불참">불참석</button>
        </div>
      </section>
      <label class="field"><span>성함 <b class="req">*</b></span><input name="guest_name" required maxlength="30" autocomplete="name"></label>
      <section class="rsvp-choice-group" data-rsvp-toggle="meal">
        <span>식사 하시나요?</span>
        <input type="hidden" name="meal" value="O">
        <div class="rsvp-choice-list cols-2">
          <button class="is-active" type="button" data-value="O">O</button>
          <button type="button" data-value="X">X</button>
        </div>
      </section>
      <label class="consent"><input type="checkbox" id="attendance-consent" required> <span>개인정보 수집 및 이용 동의 <button type="button" class="consent-detail" data-consent-detail>[자세히보기]</button></span></label>
      <p class="consent-detail-text" id="attendance-consent-detail" hidden>수집 항목: 성함, 신랑측·신부측 구분, 참석 여부, 식사 여부, 응답 등록 일시. 이용 목적: 결혼식 참석 인원 확인, 좌석·식사 준비, 신랑·신부의 하객 응답 관리. 보유 및 이용 기간: 행사 종료 후 정리 목적에 필요한 기간 동안 보관한 뒤 삭제하며, 청첩장 관리자가 먼저 삭제하거나 이용 종료를 요청하는 경우 지체 없이 삭제합니다. 동의를 거부할 권리가 있으며, 필수 항목 동의 거부 시 참석 의사 전달 기능을 이용할 수 없습니다.</p>
      <div class="modal-actions"><button class="btn btn-primary" id="attendance-submit" type="submit" disabled>전달하기</button></div>
    </form>`;
}

function guestbookForm() {
  return `
    <div class="gallery-slider-head">
      <h2>축하 메시지 작성</h2>
      <button class="gallery-close" type="button" data-close aria-label="닫기">×</button>
    </div>
    <form class="form-grid" id="guestbook-form">
      <label class="field"><span>성함 <b class="req">*</b></span><input name="guest_name" required maxlength="30" autocomplete="name" placeholder="성함을 입력해 주세요."></label>
      <label class="field"><span>축하 메시지 <b class="req">*</b></span><textarea name="message" required maxlength="300" rows="4" placeholder="축하 메시지를 남겨 주세요."></textarea></label>
      <label class="consent"><input type="checkbox" required> <span>방명록 개인정보 수집 및 이용 동의 <button type="button" class="consent-detail" data-guestbook-consent-detail>[자세히보기]</button></span></label>
      <p class="consent-detail-text" id="guestbook-consent-detail" hidden>수집 항목: 성함, 축하 메시지, 작성 일시. 이용 목적: 청첩장 방명록 게시, 신랑·신부의 축하 메시지 확인 및 관리. 보유 및 이용 기간: 청첩장 운영 기간 동안 보관하며, 청첩장 관리자가 삭제하거나 이용 종료를 요청하는 경우 지체 없이 삭제합니다. 동의를 거부할 권리가 있으며, 동의 거부 시 방명록 작성 기능을 이용할 수 없습니다.</p>
      <div class="modal-actions"><button class="btn btn-primary" id="guestbook-submit" type="submit">메시지 남기기</button></div>
    </form>`;
}

// 좌우로 45px 넘게 밀면 move(-1: 이전 / 1: 다음)
function bindSwipe(element, move) {
  let touchStartX = 0;
  element.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  element.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
  }, { passive: true });
}

function visibleNotices() {
  return data.notices.filter((notice) => !notice.hidden && notice.text?.trim());
}

function informationTabsMarkup() {
  const notices = visibleNotices();
  return `
    <div class="information-tabs" data-information-index="0">
      <div class="information-tablist" role="tablist">${notices.map((notice, index) => `<button class="information-tab" type="button" role="tab" aria-selected="${index === 0}" data-information-tab="${index}">${escapeHtml(notice.title)}</button>`).join("")}</div>
      <div class="information-panel" role="tabpanel" data-information-panel></div>
    </div>`;
}

function bindInformationTabs() {
  const root = document.querySelector(".information-tabs");
  if (!root) return;
  const notices = visibleNotices();
  const draw = () => {
    const index = Number(root.dataset.informationIndex);
    root.querySelector("[data-information-panel]").innerHTML = noticeRowsHtml(notices[index]);
    root.querySelectorAll("[data-information-tab]").forEach((tab, tabIndex) => tab.setAttribute("aria-selected", String(tabIndex === index)));
  };
  const move = (step) => {
    root.dataset.informationIndex = String((Number(root.dataset.informationIndex) + step + notices.length) % notices.length);
    draw();
  };
  root.querySelectorAll("[data-information-tab]").forEach((tab) => tab.addEventListener("click", () => {
    root.dataset.informationIndex = tab.dataset.informationTab;
    draw();
  }));
  bindSwipe(root, move);
  draw();
}

function gallerySlider(index = 0) {
  const images = galleryImages();
  const safeIndex = Math.max(0, Math.min(index, images.length - 1));
  const fullSource = mediaUrl(images[safeIndex]);
  const thumbSource = mediaUrl(galleryThumbAt(safeIndex));
  const initialSource = thumbSource || fullSource;
  const isLoadingFull = Boolean(fullSource && initialSource !== fullSource);
  return `
    <div class="gallery-slider" data-gallery-index="${safeIndex}">
      <div class="gallery-slider-head">
        <p class="gallery-page" data-gallery-page>${safeIndex + 1} / ${images.length}</p>
        <button class="gallery-close" type="button" data-close aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="gallery-slide">
        <button class="gallery-nav gallery-prev" type="button" data-gallery-move="-1" aria-label="이전 사진"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="gallery-slide-photo ${data.galleryDisplayMode === "original" ? "is-original" : "is-portrait"}">
          <img src="${escapeHtml(initialSource)}" alt="갤러리 사진 ${safeIndex + 1}" data-gallery-image class="${isLoadingFull ? "is-loading" : ""}" decoding="async" loading="eager" fetchpriority="high">
        </div>
        <button class="gallery-nav gallery-next" type="button" data-gallery-move="1" aria-label="다음 사진"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="gallery-thumbs" data-gallery-thumbs>${galleryThumbStrip(safeIndex)}</div>
    </div>`;
}

function renderGallerySlide(slider, index = 0) {
  const images = galleryImages();
  if (!slider || !images.length) return;
  const safeIndex = (index + images.length) % images.length;
  const image = slider.querySelector("[data-gallery-image]");
  const page = slider.querySelector("[data-gallery-page]");
  const fullSource = mediaUrl(images[safeIndex]);
  const thumbSource = mediaUrl(galleryThumbAt(safeIndex));
  const previewSource = thumbSource || fullSource;
  const token = `${safeIndex}-${Date.now()}`;
  slider.dataset.galleryIndex = String(safeIndex);
  slider.dataset.galleryLoadToken = token;
  image.alt = `갤러리 사진 ${safeIndex + 1}`;
  image.onload = null;
  image.onerror = null;
  if (previewSource && image.getAttribute("src") !== previewSource) image.src = previewSource;
  image.classList.toggle("is-loading", Boolean(fullSource && previewSource !== fullSource));
  page.textContent = `${safeIndex + 1} / ${images.length}`;
  // 아래 작은 사진 목록: 지금 사진 앞뒤로 다시 그림
  const strip = slider.querySelector("[data-gallery-thumbs]");
  if (strip) strip.innerHTML = galleryThumbStrip(safeIndex);
  if (fullSource && previewSource !== fullSource) {
    galleryImagePreloads.add(fullSource);
    const fullImage = new Image();
    fullImage.decoding = "async";
    fullImage.onload = () => {
      if (slider.dataset.galleryLoadToken !== token) return;
      image.src = fullSource;
      image.classList.remove("is-loading");
    };
    fullImage.onerror = () => {
      if (slider.dataset.galleryLoadToken === token) image.classList.remove("is-loading");
    };
    fullImage.src = fullSource;
  }
  warmGalleryNeighbors(safeIndex);
}

function openGallerySlider(index = 0) {
  openModal(gallerySlider(index));
  // 사진 보기는 카드 대신 화면 전체(어두운 배경)로
  document.querySelector("#modal-backdrop")?.classList.add("is-gallery");
  const slider = document.querySelector(".gallery-slider");
  renderGallerySlide(slider, Number(slider?.dataset.galleryIndex || index));
  const move = (step) => {
    const images = galleryImages();
    const current = Number(slider.dataset.galleryIndex);
    const next = (current + step + images.length) % images.length;
    renderGallerySlide(slider, next);
  };
  document.querySelectorAll("[data-gallery-move]").forEach((button) => {
    button.addEventListener("click", () => move(Number(button.dataset.galleryMove)));
  });
  slider.querySelector("[data-gallery-thumbs]")?.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-gallery-jump]");
    if (thumb) renderGallerySlide(slider, Number(thumb.dataset.galleryJump));
  });
  // 컴퓨터에서는 ←/→로 넘기고 Esc로 닫기(팝업이 닫히면 스스로 해제)
  const onKey = (event) => {
    if (!slider.isConnected) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (event.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", onKey);
  bindSwipe(slider, move);
}

// 참석 의사 전달 모달: 열고 선택 버튼·동의·전송을 연결
function openAttendanceModal() {
  openModal(attendanceForm());
  const form = document.querySelector("#attendance-form");
  const consent = document.querySelector("#attendance-consent");
  const consentDetail = document.querySelector("#attendance-consent-detail");
  const submitButton = document.querySelector("#attendance-submit");

  form.querySelectorAll("[data-rsvp-toggle]").forEach((group) => {
    const input = group.querySelector("input[type=hidden]");
    group.querySelectorAll("button[data-value]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.value;
        group.querySelectorAll("button[data-value]").forEach((other) => other.classList.toggle("is-active", other === button));
      });
    });
  });

  consent?.addEventListener("change", () => { submitButton.disabled = !consent.checked; });

  form.querySelector("[data-consent-detail]")?.addEventListener("click", () => {
    consentDetail.hidden = !consentDetail.hidden;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    submitButton.disabled = true;
    submitButton.textContent = "전달 중...";
    try {
      const result = await window.RSVP_STORAGE.submitAttendanceResponse({
        guest_name: fields.get("guest_name").trim(),
        attendance: fields.get("attendance"),
        side: fields.get("side"),
        meal: fields.get("meal"),
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
}

// 방명록 작성 모달: 열고 동의 안내·전송을 연결
function openGuestbookModal() {
  openModal(guestbookForm());
  const form = document.querySelector("#guestbook-form");
  const guestbookConsentDetail = document.querySelector("#guestbook-consent-detail");
  form.querySelector("[data-guestbook-consent-detail]")?.addEventListener("click", () => {
    if (guestbookConsentDetail) guestbookConsentDetail.hidden = !guestbookConsentDetail.hidden;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
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
      guestbookVisibleCount = Math.max(3, guestbookVisibleCount);
      document.querySelector("#guestbook-list").innerHTML = guestbookMarkup();
      closeModal();
    } catch {
      button.disabled = false;
      button.textContent = "메시지 남기기";
      alert("메시지를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });
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
        copyButton.classList.add("is-copied");
        setTimeout(() => { copyButton.classList.remove("is-copied"); }, 1200);
      } catch { alert(`복사할 내용: ${copyButton.dataset.copy}`); }
    }
    const galleryButton = event.target.closest("[data-gallery]");
    if (galleryButton) {
      warmGalleryNeighbors(Number(galleryButton.dataset.gallery));
      openGallerySlider(Number(galleryButton.dataset.gallery));
    }
  });

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const galleryButton = event.target.closest("[data-gallery]");
    if (galleryButton) preloadGalleryImage(galleryImages()[Number(galleryButton.dataset.gallery)]);
  }, { passive: true });

  document.querySelector("#gallery-more")?.addEventListener("click", () => {
    warmGalleryNeighbors(0);
    openGallerySlider();
  });

  bindInformationTabs();

  document.querySelector("#attendance-open")?.addEventListener("click", openAttendanceModal);

  document.querySelector("#guestbook-open")?.addEventListener("click", openGuestbookModal);

  document.querySelector("#guestbook-list")?.addEventListener("click", (event) => {
    const moreButton = event.target.closest("#guestbook-more");
    if (!moreButton || moreButton.disabled) return;
    guestbookVisibleCount += 3;
    document.querySelector("#guestbook-list").innerHTML = guestbookMarkup();
  });

  document.querySelector("#share-button").addEventListener("click", () => {
    openModal(shareModal());
    bindShareModal();
  });
}

const LAYOUT_SKINS = window.WEDDING_DESIGN.layoutSkins;

function applyLayoutTemplate(layoutId) {
  const urlOverride = pageParams.get("__layout");
  const isThumb = pageParams.get("__thumb") === "1";
  if (isThumb) document.body.classList.add("is-thumb");
  const id = urlOverride || layoutId || "classic";
  // 스킨 레이아웃: 기본 레이아웃(구조)은 그대로 쓰고 색·장식만 덧입힘 (public.css 의 data-layout-skin 규칙)
  const skinBase = LAYOUT_SKINS[id];
  document.body.dataset.layout = skinBase || id;
  if (skinBase) document.body.dataset.layoutSkin = id;
  else delete document.body.dataset.layoutSkin;
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
  if (pageParams.get("__aiPreview") !== "1") return;
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
  try {
    data = await window.RSVP_STORAGE.loadInvitationData(data);
  } catch (error) {
    renderInvitationLoadError(error);
    return;
  }
  normalizeWeddingDisplayDate();
  applyAIThemePreviewOverride();
  // 방명록은 첫 화면을 늦추지 않도록 렌더링 뒤에 불러와 목록만 채움
  const guestbookLoaded = window.RSVP_STORAGE.loadGuestbookEntries().catch(() => []);
  applyAppearance();
  applyLayoutTemplate(data.designSystem?.activeLayoutId);
  weddingDate = new Date(data.wedding.date);
  document.title = data.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", data.meta.description);
  updateSocialMeta();
  render();
  document.documentElement.classList.add("theme-ready");
  guestbookLoaded.then((entries) => {
    guestbookEntries = entries || [];
    const list = document.querySelector("#guestbook-list");
    if (list) list.innerHTML = guestbookMarkup();
  });
  // 다음 방문 때 첫 화면 배경을 이 테마 색으로 바로 칠할 수 있게 기억해 둠 (index.html 참고)
  try { localStorage.setItem("wedding-theme-bg", getComputedStyle(document.body).getPropertyValue("--body-bg").trim()); } catch {}
  if (isCopyEditorPreview) {
    document.documentElement.classList.add("copy-editor-public-preview-root");
    document.body.classList.add("copy-editor-public-preview");
    document.documentElement.style.overscrollBehaviorY = "contain";
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.touchAction = "pan-y";
    document.querySelector("[data-invitation-intro]")?.remove();
    bindStickerEditor();
  } else {
    setupInvitationMusic();
    playInvitationIntro();
  }
  applyResponsiveText();
  loadLazyBackgrounds();
  arrangeEditorialGallery();
  updateCountdown();
  bindEvents();
  setInterval(updateCountdown, 1000);
}

// 관리자 수정모드 미리보기: 편집 중인 값으로 실제 화면을 다시 그림(admin.js renderPreviewNow)
window.renderCopyEditorPreview = (next) => {
  if (!isCopyEditorPreview || !next) return;
  data = next;
  // 예식 일시를 바꿨을 수 있으니 달력·카운트다운 기준 날짜도 다시 계산
  weddingDate = new Date(data.wedding.date);
  render();
  applyLayoutTemplate(data.designSystem?.activeLayoutId);
  window.WEDDING_DESIGN?.apply(data);
  document.querySelector("[data-invitation-intro]")?.remove();
  applyResponsiveText();
  loadLazyBackgrounds();
  arrangeEditorialGallery();
  updateCountdown();
};

function applyResponsiveText() {
  fitSingleLineText();
  syncHeroImageFrame();
  syncInterludeFrame();
  window.WEDDING_DESIGN?.applyTextStyles?.(data, document);
}

start();
window.addEventListener("resize", applyResponsiveText);
document.fonts?.ready.then(applyResponsiveText);
