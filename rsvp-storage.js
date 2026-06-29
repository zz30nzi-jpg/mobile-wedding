const RSVP_LOCAL_KEY = "wedding-attendance-responses";
const GUESTBOOK_LOCAL_KEY = "wedding-guestbook-entries";
const INVITATION_LOCAL_KEY = "wedding-invitation-preview-draft";
const DEFAULT_INVITATION_ID = "main";
let activeInvitationSlug = "";
let supabaseClientInstance = null;

function isLocalDevelopmentHost() {
  return ["localhost", "127.0.0.1", ""].includes(location.hostname);
}

function publicInvitationError(status, message) {
  const error = new Error(message);
  error.publicInvitationStatus = status;
  return error;
}

function isEmptyInvitationContent(content) {
  return !content || typeof content !== "object" || Array.isArray(content) || !Object.keys(content).length;
}

function compactPublicDesignData(content) {
  if (!content || typeof content !== "object") return content;
  const copy = JSON.parse(JSON.stringify(content));
  const system = copy.designSystem;
  if (!system || typeof system !== "object") return copy;
  const design = copy.appearance?.design || {};
  const activeThemeId = design.presetId || "sky";
  const activeTheme = Array.isArray(system.themes) ? system.themes.find((theme) => theme.id === activeThemeId) : null;
  const keepAssetIds = new Set([
    design.heroDecoration,
    design.heroTextTheme,
    activeTheme?.heroDecoration,
    activeTheme?.heroTextTheme,
    activeTheme?.sectionIcon,
    activeTheme?.backgroundDecoration,
  ].filter((value) => value && value !== "inherit" && !/^https?:|^data:|^invitations\//.test(String(value))));
  const nextAssets = {};
  Object.entries(system.assets || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    nextAssets[key] = value.filter((asset) => keepAssetIds.has(asset.id));
  });
  const keptFontIds = new Set((nextAssets.textThemes || []).map((asset) => asset.fontId).filter(Boolean));
  if (Array.isArray(system.assets?.fonts)) {
    nextAssets.fonts = system.assets.fonts.filter((font) => keptFontIds.has(font.id));
  }
  copy.designSystem = {
    activeLayoutId: system.activeLayoutId || "classic",
    colorDefaults: system.colorDefaults || {},
    fontDefaults: system.fontDefaults || {},
    themes: activeTheme ? [activeTheme] : [],
    layoutTemplates: Array.isArray(system.layoutTemplates)
      ? system.layoutTemplates.filter((template) => template.id === system.activeLayoutId && !template.builtIn)
      : [],
    assets: nextAssets,
  };
  return copy;
}

function getSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance;
  const config = window.RSVP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return null;
  supabaseClientInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClientInstance;
}

function clearStoredSupabaseAuth() {
  try {
    const projectRef = new URL(window.RSVP_CONFIG?.supabaseUrl || "").hostname.split(".")[0];
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if ((projectRef && key === `sb-${projectRef}-auth-token`) || (key?.startsWith("sb-") && key.endsWith("-auth-token"))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("[supabase auth cleanup]", error);
  }
}

function readLocalResponses() {
  return JSON.parse(localStorage.getItem(RSVP_LOCAL_KEY) || "[]");
}

function saveLocalResponse(response) {
  const responses = readLocalResponses();
  const id = crypto.randomUUID?.() || `preview-${Date.now()}`;
  responses.unshift({ ...response, id, created_at: new Date().toISOString() });
  localStorage.setItem(RSVP_LOCAL_KEY, JSON.stringify(responses));
}

function mergeInvitationData(fallback, saved) {
  if (Array.isArray(saved)) return saved;
  if (!saved || typeof saved !== "object") return saved ?? fallback;
  const merged = { ...(fallback || {}) };
  for (const [key, value] of Object.entries(saved)) {
    merged[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeInvitationData(fallback?.[key], value)
      : value;
  }
  return merged;
}

function weddingDisplayDateLongKo(value) {
  if (!value) return "";
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return "";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const day = weekdays[date.getDay()];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(date.getDate()).padStart(2, "0");
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const twelveHour = hour % 12 || 12;
  return `${year}. ${month}. ${dateOfMonth}. ${day}요일 ${period} ${twelveHour}시 ${minute}분`;
}

function accountRelationKey(relation = "") {
  if (relation.includes("아버")) return "father";
  if (relation.includes("어머")) return "mother";
  if (relation === "신랑") return "groom";
  if (relation === "신부") return "bride";
  return relation || "";
}

function normalizeInvitationData(fallback, saved, library = null) {
  const merged = mergeInvitationData(fallback, saved);
  const legacyTransport = new Set([
    "창원중앙역에서 호텔까지 차량으로 약 15분",
    "호텔 인근 정류장과 예식 당일 셔틀 운행 여부를 확인해 주세요.",
    "내비게이션에 호텔명 또는 주소를 입력해 주세요.",
  ]);
  merged.transport = (merged.transport || fallback.transport || []).map((item) => {
    if (!legacyTransport.has(item.text)) return item;
    const keyword = item.title.includes("버스") ? "버스" : item.title.includes("자가용") ? "자가용" : "지하철";
    return fallback.transport.find((fallbackItem) => fallbackItem.title.includes(keyword)) || item;
  });
  const savedHasAccounts = saved && Array.isArray(saved.accounts);
  const accounts = Array.isArray(merged.accounts) ? merged.accounts : [];
  const defaultAccounts = Array.isArray(fallback.accounts) ? fallback.accounts : [];
  const sameAccountRole = (account, defaultAccount) =>
    account.side === defaultAccount.side && accountRelationKey(account.relation) === accountRelationKey(defaultAccount.relation);
  if (savedHasAccounts) {
    return window.WEDDING_DESIGN.normalize({ ...merged, accounts }, library);
  }
  const orderedAccounts = defaultAccounts.map((defaultAccount) => ({
    ...defaultAccount,
    ...(accounts.find((account) => sameAccountRole(account, defaultAccount)) || {}),
  }));
  const customAccounts = accounts.filter((account) =>
    !defaultAccounts.some((defaultAccount) => sameAccountRole(account, defaultAccount)));
  return window.WEDDING_DESIGN.normalize({ ...merged, accounts: [...orderedAccounts, ...customAccounts] }, library);
}

const HANGUL_CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const HANGUL_JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const HANGUL_JONG = ["", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];

function romanizeHangul(value = "") {
  let out = "";
  for (const ch of String(value || "")) {
    const code = ch.codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const cho = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;
      out += HANGUL_CHO[cho] + HANGUL_JUNG[jung] + HANGUL_JONG[jong];
    } else {
      out += ch;
    }
  }
  return out;
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

// Supabase Storage 키는 ASCII만 허용하므로, 한글이 포함된 슬러그(기존 계정 포함)도
// 스토리지 경로를 만들 때는 항상 로마자로 변환해 "Invalid key" 오류를 방지한다.
function storageSlug(value = "") {
  return romanizeHangul(String(value || ""))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function fallbackSlug(seed = "") {
  return storageSlug(seed) || `card-${Date.now().toString(36)}`;
}

function normalizeRecoveryPhone(value = "") {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 20);
}

function getStorageSlug() {
  return storageSlug(getActiveInvitationSlug()) || "card";
}

function dateOnly(value = "") {
  return String(value || "").slice(0, 10);
}

function getUrlInvitationSlug() {
  if (window.__FORCE_CARD_SLUG) return normalizeSlug(window.__FORCE_CARD_SLUG);
  const params = new URLSearchParams(location.search);
  return normalizeSlug(params.get("card") || params.get("invitation") || "");
}

function setActiveInvitationSlug(slug) {
  activeInvitationSlug = normalizeSlug(slug) || DEFAULT_INVITATION_ID;
  return activeInvitationSlug;
}

function getActiveInvitationSlug() {
  return activeInvitationSlug || getUrlInvitationSlug() || DEFAULT_INVITATION_ID;
}

function invitationLocalKey(slug = getActiveInvitationSlug()) {
  return slug && slug !== DEFAULT_INVITATION_ID ? `${INVITATION_LOCAL_KEY}:${slug}` : INVITATION_LOCAL_KEY;
}

const isStoragePath = (value = "") => /^invitations\/[^/]+\//.test(String(value || ""));

function mediaPublicUrl(path = "") {
  const value = String(path || "");
  // 캐시버스트용 ?v= 쿼리는 객체 키에 포함되면 안 되므로 분리 후 결과 URL에 다시 붙입니다.
  const queryIndex = value.indexOf("?");
  const clean = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
  const query = queryIndex >= 0 ? value.slice(queryIndex) : "";
  if (!isStoragePath(clean)) return value;
  const client = getSupabaseClient();
  if (!client) return "";
  return `${client.storage.from("invitation-media").getPublicUrl(clean).data.publicUrl}${query}`;
}

function mediaRoleFromSlot(slot = "") {
  const value = String(slot || "");
  if (value === "hero-image") return { folder: "hero", filename: "hero.webp" };
  if (value === "ending-image") return { folder: "ending", filename: "ending.webp" };
  if (value === "meta-shareImage") return { folder: "share", filename: "og-image.webp" };
  const gallery = value.match(/^gallery-(\d+)$/);
  if (gallery) return { folder: "gallery", filename: `${String(gallery[1]).padStart(3, "0")}.webp` };
  return { folder: "design-assets", filename: `${value || "image"}-${Date.now()}.webp` };
}

function emptyMediaInvitation(fallback, { slug = "", groomName = "", brideName = "", groomBirthday = "", brideBirthday = "", weddingDate = "", weddingVenue = "", weddingHall = "", publicOpenDate = "", publicCloseDate = "" } = {}, library = null) {
  const next = normalizeInvitationData(fallback, JSON.parse(JSON.stringify(fallback)), library);
  next.hero = { ...(next.hero || {}), image: "", video: "", activeMedia: "image", introName: [groomName, brideName].filter(Boolean).join(" · "), introDate: "" };
  next.couple = {
    ...(next.couple || {}),
    groom: { ...(next.couple?.groom || {}), name: groomName || "", birthday: groomBirthday || "", parents: "", phone: "", photo: "", tags: [] },
    bride: { ...(next.couple?.bride || {}), name: brideName || "", birthday: brideBirthday || "", parents: "", phone: "", photo: "", tags: [] },
  };
  next.wedding = {
    ...(next.wedding || {}),
    date: weddingDate ? `${weddingDate}:00+09:00` : "",
    displayDate: weddingDisplayDateLongKo(weddingDate),
    displayDateFormat: "long_ko",
    displayDateCustom: "",
    venue: weddingVenue || "",
    hall: weddingHall || "",
    address: "",
    officialUrl: "",
    mapLinks: [],
  };
  next.accounts = (fallback.accounts || []).map((account) => ({
    side: account.side,
    relation: account.relation,
    name: account.relation === "신랑" ? groomName || "" : account.relation === "신부" ? brideName || "" : "",
    bank: "",
    number: "",
  }));
  next.gallery = Array.from({ length: 30 }, () => "");
  next.galleryThumbs = Array.from({ length: 30 }, () => "");
  next.transport = [];
  next.ending = { ...(next.ending || {}), image: "" };
  next.meta = {
    ...(next.meta || {}),
    title: [groomName, brideName].filter(Boolean).join(" ♥ ") + ([groomName, brideName].some(Boolean) ? " 결혼합니다" : ""),
    description: "",
    shareImage: "",
  };
  next.guestPhotos = { ...(next.guestPhotos || {}), eventDate: dateOnly(weddingDate), uploadSlug: slug || next.guestPhotos?.uploadSlug || "wedding-day" };
  next.publicPeriod = { ...(next.publicPeriod || {}), openDate: publicOpenDate || "", closeDate: publicCloseDate || "" };
  return window.WEDDING_DESIGN.normalize(next, library);
}

async function currentUserInvitationSite(client) {
  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await client
    .from("invitation_sites")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error?.code === "42P01") return null;
  if (error) throw error;
  return data;
}

async function getCurrentInvitationSite() {
  const client = getSupabaseClient();
  if (!client) return null;
  return currentUserInvitationSite(client);
}

async function ensureInvitationForCurrentUser(fallback = window.INVITATION_DATA, profile = {}) {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const existing = await currentUserInvitationSite(client);
  if (existing?.slug) {
    setActiveInvitationSlug(existing.slug);
    return existing;
  }
  const meta = user.user_metadata || {};
  const groomName = profile.groomName || meta.groom_name || "";
  const brideName = profile.brideName || meta.bride_name || "";
  const weddingDate = profile.weddingDate || meta.wedding_date || "";
  const weddingVenue = profile.weddingVenue || meta.wedding_venue || "";
  const recoveryName = profile.recoveryName || meta.recovery_name || groomName || brideName || "";
  const recoveryPhone = normalizeRecoveryPhone(profile.recoveryPhone || meta.recovery_phone || "");
  if (!groomName || !brideName || !weddingDate || !weddingVenue) return null;
  const slug = fallbackSlug(profile.cardSlug || meta.card_slug || `${groomName}-${brideName}` || user.email?.split("@")[0]);
  const title = [groomName, brideName].filter(Boolean).join(" · ") || user.email || "새 청첩장";
  const library = await loadDesignLibrary();
  const { data: defaultSettings } = await client
    .from("invitation_settings")
    .select("content")
    .eq("id", DEFAULT_INVITATION_ID)
    .maybeSingle();
  const baseContent = defaultSettings?.content ? normalizeInvitationData(fallback, defaultSettings.content, library) : fallback;
  const content = emptyMediaInvitation(baseContent, {
    slug,
    groomName,
    brideName,
    groomBirthday: profile.groomBirthday || meta.groom_birthday || "",
    brideBirthday: profile.brideBirthday || meta.bride_birthday || "",
    weddingDate,
    weddingVenue,
    weddingHall: profile.weddingHall || meta.wedding_hall || "",
    publicOpenDate: profile.publicOpenDate || meta.public_open_date || "",
    publicCloseDate: profile.publicCloseDate || meta.public_close_date || "",
  }, library);
  const { data: site, error: siteError } = await client
    .from("invitation_sites")
    .insert({ slug, owner_id: user.id, title, groom_name: groomName, bride_name: brideName, signup_email: user.email, recovery_name: recoveryName, recovery_phone: recoveryPhone })
    .select("*")
    .single();
  if (siteError) throw siteError;
  const { error: settingsError } = await client
    .from("invitation_settings")
    .upsert({ id: slug, content, updated_at: new Date().toISOString() });
  if (settingsError) throw settingsError;
  setActiveInvitationSlug(slug);
  return site;
}

async function submitAttendanceResponse(response) {
  const client = getSupabaseClient();
  const payload = { ...response, invitation_id: getActiveInvitationSlug() };
  if (!client) {
    saveLocalResponse(payload);
    return { isPreview: true };
  }

  const { error } = await client.from("attendance_responses").insert(payload);
  if (error) throw error;
  return { isPreview: false };
}

function readLocalGuestbookEntries() {
  return JSON.parse(localStorage.getItem(GUESTBOOK_LOCAL_KEY) || "[]");
}

async function loadGuestbookEntries() {
  const client = getSupabaseClient();
  if (!client) return readLocalGuestbookEntries();
  const { data, error } = await client
    .rpc("get_public_guestbook_entries", { invitation_slug: getActiveInvitationSlug() });
  if (error) throw error;
  return (data || []).map((entry) => ({ ...entry, hidden: false }));
}

async function loadAdminGuestbookEntries() {
  const client = getSupabaseClient();
  if (!client) return readLocalGuestbookEntries();
  const { data, error } = await client.from("guestbook_entries").select("*").eq("invitation_id", getActiveInvitationSlug()).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((entry) => ({ hidden: false, ...entry }));
}

async function setGuestbookEntryHidden(id, hidden) {
  const client = getSupabaseClient();
  if (!client) {
    const entries = readLocalGuestbookEntries().map((entry) => entry.id === id ? { ...entry, hidden } : entry);
    localStorage.setItem(GUESTBOOK_LOCAL_KEY, JSON.stringify(entries));
    return;
  }
  const { error } = await client.from("guestbook_entries").update({ hidden }).eq("id", id);
  if (error) throw error;
}

async function submitGuestbookEntry(entry) {
  const client = getSupabaseClient();
  const payload = { ...entry, invitation_id: getActiveInvitationSlug() };
  if (!client) {
    const entries = readLocalGuestbookEntries();
    entries.unshift({ ...payload, id: crypto.randomUUID?.() || `preview-${Date.now()}`, created_at: new Date().toISOString() });
    localStorage.setItem(GUESTBOOK_LOCAL_KEY, JSON.stringify(entries.slice(0, 30)));
    return { isPreview: true };
  }
  const { error } = await client.from("guestbook_entries").insert(payload);
  if (error) throw error;
  return { isPreview: false };
}

const INVITATION_CACHE_TTL = 60 * 60 * 1000; // 1시간 (밀리초)

function invitationCacheKey(slug) {
  return `wedding-inv-cache:${slug || DEFAULT_INVITATION_ID}`;
}

function readInvitationCache(slug) {
  try {
    const raw = localStorage.getItem(invitationCacheKey(slug));
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (!data || Date.now() - cachedAt > INVITATION_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeInvitationCache(slug, data) {
  try {
    localStorage.setItem(invitationCacheKey(slug), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (error) {
    console.warn("[invitation cache write]", error);
  }
}

function clearInvitationCache(slug) {
  try { localStorage.removeItem(invitationCacheKey(slug)); } catch (error) { console.warn("[invitation cache clear]", error); }
}

const DESIGN_LIBRARY_ID = "_design_library";
const DESIGN_LIBRARY_CACHE_KEY = "wedding-design-library-cache";
const DESIGN_LIBRARY_FIELDS = ["themes", "assets", "layoutTemplates", "deletedThemeIds", "deletedAssetIds", "colorDefaults", "fontDefaults", "aiSettings"];

function extractDesignLibrary(system = {}) {
  const library = {};
  DESIGN_LIBRARY_FIELDS.forEach((key) => { if (system[key] !== undefined) library[key] = system[key]; });
  return library;
}

function readDesignLibraryCache() {
  try {
    const raw = localStorage.getItem(DESIGN_LIBRARY_CACHE_KEY);
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (!data || Date.now() - cachedAt > INVITATION_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeDesignLibraryCache(data) {
  try { localStorage.setItem(DESIGN_LIBRARY_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() })); } catch (error) { console.warn("[design library cache write]", error); }
}

async function fetchDesignLibrary(client) {
  const { data, error } = await client.from("invitation_settings").select("content").eq("id", DESIGN_LIBRARY_ID).maybeSingle();
  if (!error && data?.content) return data.content;
  // _design_library가 아직 없으면 "main" 청첩장의 designSystem을 1회성 마이그레이션 소스로 사용
  const { data: mainData } = await client.from("invitation_settings").select("content").eq("id", DEFAULT_INVITATION_ID).maybeSingle();
  return mainData?.content?.designSystem ? extractDesignLibrary(mainData.content.designSystem) : null;
}

async function loadDesignLibrary() {
  const client = getSupabaseClient();
  if (!client) return readDesignLibraryCache();
  const cached = readDesignLibraryCache();
  if (cached) {
    fetchDesignLibrary(client).then((fresh) => { if (fresh) writeDesignLibraryCache(fresh); }).catch((error) => console.warn("[design library refresh]", error));
    return cached;
  }
  const fresh = await fetchDesignLibrary(client);
  if (fresh) writeDesignLibraryCache(fresh);
  return fresh;
}

async function fetchAndCacheInvitation(client, fallback, slug) {
  const { data, error } = await client
    .rpc("get_public_invitation", { invitation_slug: slug })
    .maybeSingle();
  if (error) {
    const status = error.code === "42883" || /function .*get_public_invitation/i.test(error.message || "")
      ? "setup_error"
      : "network_error";
    throw publicInvitationError(status, "청첩장을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  if (!data) throw publicInvitationError("not_found", "존재하지 않는 청첩장입니다.");
  if (data.status === "not_found") throw publicInvitationError("not_found", "존재하지 않는 청첩장입니다.");
  if (data.status === "disabled") throw publicInvitationError("disabled", "현재 공개되지 않은 청첩장입니다.");
  if (data.status === "empty" || isEmptyInvitationContent(data.content)) {
    throw publicInvitationError("empty", "청첩장 설정이 아직 완료되지 않았습니다.");
  }
  const publicContent = compactPublicDesignData(data.content);
  writeInvitationCache(slug, publicContent);
  return normalizeInvitationData(fallback, publicContent, null);
}

async function fetchOwnedInvitation(client, fallback, slug, library) {
  const { data, error } = await client
    .from("invitation_settings")
    .select("content")
    .eq("id", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data?.content || isEmptyInvitationContent(data.content)) {
    throw publicInvitationError("empty", "청첩장 설정이 아직 완료되지 않았습니다.");
  }
  return normalizeInvitationData(fallback, data.content, library);
}

async function loadInvitationData(fallback) {
  const client = getSupabaseClient();
  const urlSlug = getUrlInvitationSlug();
  if (!client) {
    if (urlSlug || !isLocalDevelopmentHost()) {
      throw publicInvitationError("network_error", "청첩장을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
    setActiveInvitationSlug(urlSlug || activeInvitationSlug || DEFAULT_INVITATION_ID);
    const saved = JSON.parse(localStorage.getItem(invitationLocalKey()) || "null");
    return normalizeInvitationData(fallback, saved);
  }
  // 로그인한 사용자가 있으면 소유한 사이트로 분기 (관리자 페이지용)
  const ownedSite = urlSlug ? null : await currentUserInvitationSite(client);
  const slug = setActiveInvitationSlug(urlSlug || ownedSite?.slug || DEFAULT_INVITATION_ID);
  if (urlSlug || !ownedSite?.slug) {
    try {
      return await fetchAndCacheInvitation(client, fallback, slug);
    } catch (error) {
      if (!urlSlug && isLocalDevelopmentHost()) return window.WEDDING_DESIGN.normalize(fallback);
      throw error;
    }
  }
  const library = await loadDesignLibrary();
  return fetchOwnedInvitation(client, fallback, slug, library);
}

async function loadSafeInvitationData(fallback = window.INVITATION_DATA) {
  try {
    const invitation = await loadInvitationData(fallback);
    return invitation && typeof invitation === "object" ? invitation : {};
  } catch {
    return fallback && typeof fallback === "object" ? fallback : {};
  }
}

async function saveInvitationData(content) {
  const client = getSupabaseClient();
  const slug = getActiveInvitationSlug();
  if (!client) {
    localStorage.setItem(invitationLocalKey(slug), JSON.stringify(content));
    return;
  }
  const { error } = await client
    .from("invitation_settings")
    .upsert({ id: slug, content, updated_at: new Date().toISOString() });
  if (error) throw error;
  clearInvitationCache(slug); // 저장 후 캐시 즉시 무효화
  const { error: siteError } = await client.from("invitation_sites").update({
    title: `${content.couple?.groom?.name || ""} · ${content.couple?.bride?.name || ""}`.trim() || "청첩장",
    groom_name: content.couple?.groom?.name || "",
    bride_name: content.couple?.bride?.name || "",
    updated_at: new Date().toISOString(),
  }).eq("slug", slug);
  if (siteError) throw siteError;
}

async function signUpInvitationAdmin({ email, loginId = "", password, groomName = "", brideName = "", groomBirthday = "", brideBirthday = "", weddingDate = "", weddingVenue = "", weddingHall = "", publicOpenDate = "", publicCloseDate = "", agreeTerms, agreePrivacy, agreeMarketing = false }) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  if (!agreeTerms || !agreePrivacy) throw new Error("필수 약관에 동의해 주세요.");
  const slug = groomName && brideName ? fallbackSlug(`${groomName}-${brideName}`) : "";
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "general_admin",
        login_id: loginId,
        groom_name: groomName,
        bride_name: brideName,
        groom_birthday: groomBirthday,
        bride_birthday: brideBirthday,
        wedding_date: weddingDate,
        wedding_venue: weddingVenue,
        wedding_hall: weddingHall,
        public_open_date: publicOpenDate,
        public_close_date: publicCloseDate,
        ...(slug ? { card_slug: slug } : {}),
        agree_terms: Boolean(agreeTerms),
        agree_privacy: Boolean(agreePrivacy),
        agree_marketing: Boolean(agreeMarketing),
      },
    },
  });
  if (error) throw error;
  if (!data.session) return { needsConfirmation: true, slug };
  const site = await ensureInvitationForCurrentUser();
  return { needsConfirmation: false, slug: site?.slug || slug };
}

async function findAdminLoginId({ recoveryName = "", recoveryPhone = "" } = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const { data, error } = await client
    .rpc("find_admin_login_id", {
      recovery_name_input: String(recoveryName || "").trim(),
      recovery_phone_input: normalizeRecoveryPhone(recoveryPhone),
    })
    .maybeSingle();
  if (error) throw error;
  return data?.masked_email || "";
}

async function optimizeInvitationImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
  }
  if (!("createImageBitmap" in window)) throw new Error("이 브라우저에서는 이미지 최적화를 지원하지 않습니다.");
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
    if (!blob) throw new Error("이미지를 WebP로 변환하지 못했습니다.");
    return blob;
  } catch {
    throw new Error("이미지를 최적화하지 못했습니다. JPG, PNG, WEBP 이미지를 다시 선택해 주세요.");
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("미리보기 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

async function createGalleryImageVariants(file) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
  }
  if (!("createImageBitmap" in window)) throw new Error("이 브라우저에서는 이미지 최적화를 지원하지 않습니다.");
  try {
    const bitmap = await createImageBitmap(file);
    const renderVariant = (maxDimension, quality) => {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    };
    const [display, thumb] = await Promise.all([renderVariant(1280, 0.78), renderVariant(480, 0.7)]);
    bitmap.close();
    if (!display || !thumb) throw new Error("이미지를 WebP로 변환하지 못했습니다.");
    return { display, thumb };
  } catch {
    throw new Error("이미지를 최적화하지 못했습니다. JPG, PNG, WEBP 이미지를 다시 선택해 주세요.");
  }
}

async function uploadInvitationImage(file, slot) {
  const client = getSupabaseClient();
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
    throw new Error("20MB 이하 이미지 파일만 업로드할 수 있습니다.");
  }
  const role = mediaRoleFromSlot(slot);
  if (role.folder === "gallery") {
    const { display, thumb } = await createGalleryImageVariants(file);
    if (!client) {
      const [path, thumbPath] = await Promise.all([blobToDataUrl(display), blobToDataUrl(thumb)]);
      return { path, thumbPath };
    }
    const base = role.filename.replace(/\.webp$/, "");
    const ts = Date.now();
    const path = `invitations/${getStorageSlug()}/${role.folder}/${base}-${ts}.webp`;
    const thumbPath = `invitations/${getStorageSlug()}/${role.folder}/${base}-${ts}-thumb.webp`;
    const [displayUpload, thumbUpload] = await Promise.all([
      client.storage.from("invitation-media").upload(path, display, { cacheControl: "31536000", contentType: "image/webp", upsert: true }),
      client.storage.from("invitation-media").upload(thumbPath, thumb, { cacheControl: "31536000", contentType: "image/webp", upsert: true }),
    ]);
    if (displayUpload.error) throw displayUpload.error;
    if (thumbUpload.error) throw thumbUpload.error;
    return { path, thumbPath };
  }
  const optimized = await optimizeInvitationImage(file);
  if (!client) return blobToDataUrl(optimized);
  // 슬롯당 같은 파일명(og-image.webp 등)을 upsert로 덮어써 Storage 용량이 누적되지 않게 합니다.
  // 대신 저장 경로 끝에 ?v=업로드시각 쿼리만 바꿔 CDN/카카오/브라우저 캐시를 무효화합니다.
  // 1년 캐시는 그대로라, egress(전송량)는 이미지가 실제로 바뀔 때만 1회 더 발생합니다.
  const path = `invitations/${getStorageSlug()}/${role.folder}/${role.filename}`;
  const { error } = await client.storage
    .from("invitation-media")
    .upload(path, optimized, { cacheControl: "31536000", contentType: "image/webp", upsert: true });
  if (error) throw error;
  return `${path}?v=${Date.now()}`;
}

async function uploadInvitationMedia(file, slot) {
  if (file.type.startsWith("image/")) return uploadInvitationImage(file, slot);
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type) || file.size > 50 * 1024 * 1024) {
    throw new Error("50MB 이하 MP4, WebM 또는 MOV 영상만 업로드할 수 있습니다.");
  }
  const extension = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const path = `invitations/${getStorageSlug()}/hero/hero-video.${extension}`;
  const { error } = await client.storage.from("invitation-media").upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: true });
  if (error) {
    if (/mime type|not supported/i.test(error.message || "")) {
      throw new Error("영상 MIME 정책이 적용되지 않았습니다. Supabase SQL Editor에서 supabase-guest-photo-policy-fix.sql을 다시 실행해 주세요.");
    }
    throw error;
  }
  return path;
}

async function uploadDesignAsset(file, slot = "asset") {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const fontTypes = ["font/woff", "font/woff2", "application/font-woff", "application/font-woff2", "application/x-font-woff", "application/x-font-woff2", "font/ttf", "font/otf", "application/x-font-ttf", "application/x-font-otf"];
  const inferredFontType = /\.(woff2?)$/i.test(file.name || "") ? `font/${file.name.split(".").pop().toLowerCase()}` : /\.(ttf|otf)$/i.test(file.name || "") ? `font/${file.name.split(".").pop().toLowerCase()}` : "";
  const contentType = file.type || inferredFontType;
  if (contentType === "image/svg+xml" || /\.svg$/i.test(file.name || "")) {
    throw new Error("보안을 위해 SVG 파일은 업로드할 수 없습니다. PNG, JPG 또는 WebP 파일로 변환해 주세요.");
  }
  const allowed = ["image/png", "image/webp", "image/jpeg", ...fontTypes];
  const isFont = fontTypes.includes(file.type) || /\.(woff2?|ttf|otf)$/i.test(file.name || "");
  const limit = isFont ? 4 * 1024 * 1024 : 2 * 1024 * 1024;
  if (!allowed.includes(contentType) || file.size > limit) {
    throw new Error("PNG/WebP/JPG는 2MB 이하, 폰트는 4MB 이하만 등록할 수 있습니다. SVG는 업로드할 수 없습니다.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `${slot}-${Date.now()}-${crypto.randomUUID?.() || "asset"}.${extension}`.replace(/[^a-z0-9가-힣._-]/gi, "-");
  const path = `invitations/${getStorageSlug()}/design-assets/${filename}`;
  const { error } = await client.storage.from("invitation-media").upload(path, file, { cacheControl: "31536000", contentType, upsert: true });
  if (error) throw error;
  return path;
}

function isGuestPhotoThumbPath(path = "") {
  return /--thumb\.webp$/i.test(String(path || ""));
}

function guestPhotoThumbPath(path = "") {
  const value = String(path || "");
  return value.replace(/(\.[^.\/]+)$/i, "--thumb.webp");
}

function isGuestImageFile(fileOrName = "") {
  const type = typeof fileOrName === "object" ? fileOrName.type || "" : "";
  const name = typeof fileOrName === "object" ? fileOrName.name || "" : String(fileOrName || "");
  return type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
}

function guestPhotoSize(photo = {}) {
  return Number(photo.metadata?.size || photo.metadata?.contentLength || photo.metadata?.content_length || photo.size || 0);
}

function canUseOriginalAsPreview(photo = {}) {
  return isGuestImageFile(photo.name || photo.path) && guestPhotoSize(photo) > 0 && guestPhotoSize(photo) <= 300 * 1024;
}

async function createGuestPhotoThumb(file) {
  if (file.size <= 300 * 1024 || !isGuestImageFile(file) || file.type === "image/svg+xml" || !("createImageBitmap" in window)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 360;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.58));
  } catch {
    return null;
  }
}

async function uploadGuestPhotos(files, onProgress = () => {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const session = await ensureGuestPhotoSession(client);
  const invitation = await loadSafeInvitationData();
  const uploadSlug = storageSlug(invitation.guestPhotos?.uploadSlug) || "wedding-day";
  const uploaded = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")) {
      throw new Error("보안을 위해 SVG 파일은 업로드할 수 없습니다. PNG, JPG, WebP 또는 지원되는 영상 파일을 선택해 주세요.");
    }
    const isSupported = file.type.startsWith("image/") || ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
    if (!isSupported || file.size > 50 * 1024 * 1024) {
      throw new Error("사진 또는 영상은 파일당 50MB 이하 이미지, MP4, WebM, MOV만 업로드할 수 있습니다.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${uploadSlug}/${session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${extension}`;
    const thumb = await createGuestPhotoThumb(file);
    const { error } = await client.storage
      .from("guest-photos")
      .upload(path, file, { cacheControl: "3600", contentType: file.type });
    if (error) {
      if (/row-level security|rls|mime type|not supported/i.test(error.message || "")) {
        throw new Error("사진·영상 업로드 권한 정책이 적용되지 않았습니다. Supabase SQL Editor에서 supabase-guest-photo-policy-fix.sql을 실행해 주세요.");
      }
      throw error;
    }
    if (thumb) {
      const { error: thumbError } = await client.storage
        .from("guest-photos")
        .upload(guestPhotoThumbPath(path), thumb, { cacheControl: "604800", contentType: "image/webp", upsert: true });
      if (thumbError) console.warn("하객 사진 썸네일 업로드 실패", thumbError);
    }
    uploaded.push(path);
    onProgress({ completed: index + 1, total: files.length, percent: Math.round(((index + 1) / files.length) * 100), path });
  }
  return uploaded;
}

async function ensureGuestPhotoSession(client) {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;
  const { data: signedIn, error } = await client.auth.signInAnonymously();
  if (error || !signedIn.session) {
    throw new Error("익명 파일 업로드 세션을 만들지 못했습니다. Supabase Authentication > Providers에서 Anonymous Sign-Ins가 활성화되어 있는지 확인해 주세요.");
  }
  return signedIn.session;
}

async function signedGuestPhotos(client, photos, expiresIn = 3600) {
  if (!photos.length) return [];
  const paths = photos.flatMap((photo) => photo.thumbPath ? [photo.path, photo.thumbPath] : [photo.path]);
  const { data, error } = await client.storage.from("guest-photos").createSignedUrls(paths, expiresIn);
  if (error) throw error;
  let index = 0;
  return photos.map((photo) => {
    const signedUrl = data[index]?.signedUrl || "";
    index += 1;
    const thumbSignedUrl = photo.thumbPath ? data[index]?.signedUrl || "" : canUseOriginalAsPreview(photo) ? signedUrl : "";
    if (photo.thumbPath) index += 1;
    return { ...photo, signedUrl, thumbSignedUrl };
  });
}

function pairGuestPhotoThumbs(files = []) {
  const thumbPaths = new Set(files.filter((file) => isGuestPhotoThumbPath(file.path)).map((file) => file.path));
  return files
    .filter((file) => !isGuestPhotoThumbPath(file.path))
    .map((photo) => {
      const thumbPath = guestPhotoThumbPath(photo.path);
      return thumbPaths.has(thumbPath) ? { ...photo, thumbPath } : photo;
    });
}

async function listOwnGuestPhotos() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const session = await ensureGuestPhotoSession(client);
  const invitation = await loadSafeInvitationData();
  const folder = `${storageSlug(invitation.guestPhotos?.uploadSlug) || "wedding-day"}/${session.user.id}`;
  const folders = [folder, session.user.id];
  const results = await Promise.all(folders.map(async (target) => {
    const { data: files, error } = await client.storage
      .from("guest-photos")
      .list(target, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return files.filter((file) => file.id).map((photo) => ({ ...photo, path: `${target}/${photo.name}` }));
  }));
  const photos = pairGuestPhotoThumbs(results.flat()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return signedGuestPhotos(client, photos);
}

async function listGuestPhotoFolder(client, folder = "") {
  const { data: entries, error } = await client.storage
    .from("guest-photos")
    .list(folder, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  const files = entries.filter((entry) => entry.id).map((entry) => ({ ...entry, path: folder ? `${folder}/${entry.name}` : entry.name }));
  const folders = entries.filter((entry) => !entry.id);
  const nested = await Promise.all(folders.map((entry) => listGuestPhotoFolder(client, folder ? `${folder}/${entry.name}` : entry.name)));
  return files.concat(...nested);
}

async function listGuestPhotos() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const invitation = await loadSafeInvitationData();
  const folder = storageSlug(invitation.guestPhotos?.uploadSlug || getActiveInvitationSlug()) || "wedding-day";
  const photos = pairGuestPhotoThumbs(await listGuestPhotoFolder(client, folder)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return signedGuestPhotos(client, photos, 30 * 24 * 60 * 60);
}

async function removeOwnGuestPhoto(path) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  await ensureGuestPhotoSession(client);
  const { error } = await client.storage.from("guest-photos").remove([path, guestPhotoThumbPath(path)]);
  if (error) throw error;
}

async function removeGuestPhoto(path) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase가 연결되지 않았습니다.");
  const { error } = await client.storage.from("guest-photos").remove([path, guestPhotoThumbPath(path)]);
  if (error) throw error;
}

window.RSVP_STORAGE = {
  getSupabaseClient,
  mediaPublicUrl,
  getActiveInvitationSlug,
  setActiveInvitationSlug,
  getCurrentInvitationSite,
  ensureInvitationForCurrentUser,
  signUpInvitationAdmin,
  findAdminLoginId,
  loadInvitationData,
  loadDesignLibrary,
  loadGuestbookEntries,
  loadAdminGuestbookEntries,
  readLocalResponses,
  saveInvitationData,
  submitAttendanceResponse,
  submitGuestbookEntry,
  setGuestbookEntryHidden,
  listGuestPhotos,
  listOwnGuestPhotos,
  removeGuestPhoto,
  removeOwnGuestPhoto,
  uploadGuestPhotos,
  uploadDesignAsset,
  uploadInvitationImage,
  uploadInvitationMedia,
};
