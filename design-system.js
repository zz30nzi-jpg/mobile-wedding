(function () {
  const palette = (background, card, ink, muted, accent, line, extras = {}) => ({ background, card, ink, muted, accent, line, ...extras });
  const builtInThemes = [
    { id: "beige", name: "베이지", type: "color", enabled: true, palette: palette("#f8f5f1", "#fffdfb", "#453d38", "#83766e", "#a88270", "rgba(148,117,101,0.2)", { side: "#eee8e1", button: "#f4e9e2", label: "#947565" }) },
    { id: "sky", name: "하늘색", type: "color", enabled: true, palette: palette("#f7fbfd", "#fdfeff", "#46555d", "#7f929b", "#83adbf", "rgba(131,173,191,0.2)", { side: "#eff7fa", button: "#e4f2f7", label: "#6c8baf" }) },
    { id: "pink", name: "핑크", type: "color", enabled: true, palette: palette("#fff8fa", "#fffdfd", "#594a50", "#947d86", "#bd879a", "rgba(189,135,154,0.2)", { side: "#fdf0f4", button: "#f9e5eb", label: "#a87587" }) },
    { id: "gray", name: "연한 회색", type: "color", enabled: true, palette: palette("#f7f8f9", "#ffffff", "#4d5358", "#858d93", "#929da4", "rgba(130,140,147,0.2)", { side: "#edf0f2", button: "#edf0f2", label: "#737d84" }) },
    { id: "black", name: "블랙", type: "color", enabled: true, palette: palette("#202529", "#2a3035", "#f1f4f5", "#b2bec4", "#a6b9c2", "rgba(203,216,222,0.2)", { side: "#15191c", button: "#354047", label: "#c3d1d7" }) },
    { id: "white", name: "화이트", type: "color", enabled: true, palette: palette("#ffffff", "#ffffff", "#454b50", "#848b90", "#92999e", "rgba(120,128,133,0.18)", { side: "#f7f7f7", button: "#f6f7f7", label: "#70777c" }) },
    { id: "green", name: "그린", type: "color", enabled: true, palette: palette("#f6f9f4", "#fcfdfb", "#424f40", "#778574", "#5b7853", "rgba(91,120,83,0.2)", { side: "#edf3ea", button: "#e3ede0", label: "#5b7853" }) },
    { id: "about_time", name: "어바웃타임", type: "movie", concept: "어바웃타임", mood: "따뜻하고 빈티지한 필름 무드", enabled: true, heroDecoration: "frame_heart", heroTextTheme: "editorial_left", palette: palette("#f7f0e7", "#fffaf4", "#463a34", "#88776e", "#8d3440", "rgba(125,38,51,0.2)", { side: "#e9ddd1", button: "#fbf1e8", label: "#8d3440" }) },
    { id: "la_la_land", name: "라라랜드", type: "movie", concept: "라라랜드", mood: "밤하늘과 골드 포인트의 시네마 무드", enabled: true, heroDecoration: "frame_inset", heroTextTheme: "editorial_left", palette: palette("#faf4e8", "#fffaf0", "#27305a", "#6f7190", "#62478e", "rgba(64,57,116,0.18)", { side: "#171839", button: "#fff9e9", label: "#74559e" }) },
    { id: "spirited_away", name: "센과 치히로 무드", type: "movie", concept: "숲과 바람", mood: "차분한 자연과 동화 같은 무드", enabled: true, heroDecoration: "frame_heart", heroTextTheme: "minimal_center", palette: palette("#f4f0df", "#fbf7ea", "#37463f", "#718076", "#56725d", "rgba(86,114,93,0.18)", { side: "#dce3cf", button: "#f8f4e5", label: "#667c61" }) },
    { id: "you_are_the_apple", name: "그 시절, 우리가 좋아했던 소녀 무드", type: "movie", concept: "청춘 영화", mood: "밝고 담백한 필름 무드", enabled: true, heroDecoration: "text_marriage", heroTextTheme: "editorial_left", palette: palette("#f7f3e8", "#fffaf0", "#3e5267", "#7d8d98", "#537c91", "rgba(83,124,145,0.18)", { side: "#e6eee9", button: "#fffaf0", label: "#5f8799" }) },
  ];
  const builtInAssets = {
    frames: [
      { id: "none", name: "꾸밈 없음", mode: "overlay" },
      { id: "text_marriage", name: "저희 결혼합니다 문구", mode: "overlay" },
      { id: "frame_heart", name: "손그림 하트 (러브 두들)", mode: "overlay" },
      { id: "frame_arch", name: "아치 프레임 (달빛 서약)", mode: "outer" },
      { id: "frame_inset", name: "임베드 사진 (벨벳 나이트)", mode: "outer" },
    ],
    textThemes: [
      { id: "default_center", name: "기본형 (가운데 정렬)", layout: "default", align: "center", shadow: true, boxEnabled: false, nameSize: 34, dateSize: 12 },
      { id: "editorial_left", name: "포스터 좌측형", layout: "poster-left", align: "left", shadow: true, boxEnabled: false, nameSize: 46, dateSize: 13 },
      { id: "minimal_center", name: "중앙 오버레이형", layout: "center", align: "center", shadow: false, boxEnabled: false, opacity: 0.82, blendMode: "screen", nameSize: 35, dateSize: 12 },
    ],
    fonts: [
      { id: "noto-serif-kr", name: "Noto Serif KR", family: "Noto Serif KR", source: "Google Fonts", license: "SIL Open Font License", commercialFree: true },
      { id: "noto-sans-kr", name: "Noto Sans KR", family: "Noto Sans KR", source: "Google Fonts", license: "SIL Open Font License", commercialFree: true },
      { id: "gowun-batang", name: "Gowun Batang", family: "Gowun Batang", source: "Google Fonts", license: "SIL Open Font License", commercialFree: true },
      { id: "gowun-dodum", name: "Gowun Dodum", family: "Gowun Dodum", source: "Google Fonts", license: "SIL Open Font License", commercialFree: true },
      { id: "cormorant-garamond", name: "Cormorant Garamond", family: "Cormorant Garamond", source: "Google Fonts", license: "SIL Open Font License", commercialFree: true },
    ],
    sectionIcons: [],
    backgrounds: [],
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const legacyTextThemeIds = ["auto", "classic", "caption_card"];
  const migrateTextThemeId = (id) => id === "auto" ? "default_center" : (["classic", "caption_card"].includes(id) ? "editorial_left" : id);
  const mergeUnique = (defaults, saved = []) => [...defaults.map((item) => ({ ...item, ...(saved.find((savedItem) => savedItem.id === item.id) || {}) })), ...saved.filter((item) => !defaults.some((fallback) => fallback.id === item.id))];
  const themePresetId = (appearance = {}) => appearance.movieConcept && appearance.movieConcept !== "none" ? appearance.movieConcept : (appearance.theme || "sky");
  const cssString = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const mediaUrl = (value = "") => window.RSVP_STORAGE?.mediaPublicUrl?.(value) || value || "";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const hexToRgb = (value = "") => {
    const hex = String(value || "").trim();
    const full = hex.match(/^#([0-9a-f]{6})$/i)?.[1];
    const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const normalized = full || (short ? short.slice(1).map((item) => item + item).join("") : "");
    if (!normalized) return null;
    return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
  };
  const rgbToHex = (rgb) => `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  const mixColor = (from, to, ratio) => {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    if (!a || !b) return from || to;
    return rgbToHex(a.map((value, index) => value + (b[index] - value) * ratio));
  };
  const luminance = (value) => {
    const rgb = hexToRgb(value);
    if (!rgb) return 1;
    const channel = rgb.map((item) => {
      const v = item / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
  };
  const contrastColor = (background, dark = "#2f2824", light = "#ffffff") => {
    const bg = luminance(background);
    const darkContrast = (Math.max(bg, luminance(dark)) + 0.05) / (Math.min(bg, luminance(dark)) + 0.05);
    const lightContrast = (Math.max(bg, luminance(light)) + 0.05) / (Math.min(bg, luminance(light)) + 0.05);
    return darkContrast >= lightContrast ? dark : light;
  };
  const normalizedPalette = (palette = {}) => {
    const background = palette.background || "#f7fbfd";
    const card = palette.card || "#ffffff";
    const ink = palette.ink || "#46555d";
    const accent = palette.accent || "#83adbf";
    const side = palette.side || mixColor(background, "#ffffff", luminance(background) > 0.86 ? 0.34 : 0.16);
    let button = palette.button || mixColor(card, accent, 0.14);
    if (hexToRgb(button) && Math.abs(luminance(button) - luminance(background)) < 0.055) {
      button = luminance(background) > 0.72 ? mixColor(accent, "#ffffff", 0.72) : mixColor(accent, "#000000", 0.22);
    }
    if (hexToRgb(button) && luminance(button) > 0.93) button = mixColor(button, accent, 0.16);
    const buttonText = contrastColor(button, ink, "#ffffff");
    const primaryText = contrastColor(accent, ink, "#ffffff");
    const introBackground = side || background;
    const introName = contrastColor(introBackground, ink, "#ffffff");
    const introSubText = introName === "#ffffff" ? "rgba(255,255,255,0.78)" : mixColor(introName, background, 0.34);
    const introShadow = introName === "#ffffff" ? "0 1px 10px rgba(0,0,0,0.32)" : `0 1px 0 ${mixColor(card, background, 0.28)}`;
    return { ...palette, background, card, ink, accent, side, button, buttonText, primaryText, introName, introSubText, introShadow };
  };

  function ensureFontFace(font = {}) {
    if (!font.url || !font.family || !document?.head) return;
    const id = `design-font-${String(font.id || font.family).replace(/[^a-z0-9_-]/gi, "-")}`;
    if (document.getElementById(id)) return;
    const extension = String(font.url).split("?")[0].split(".").pop()?.toLowerCase();
    const format = extension === "woff2" ? "woff2" : extension === "woff" ? "woff" : extension === "otf" ? "opentype" : "truetype";
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@font-face{font-family:"${cssString(font.family)}";src:url("${cssString(mediaUrl(font.url))}") format("${format}");font-display:swap;}`;
    document.head.appendChild(style);
  }

  function normalize(data = {}, library = null) {
    data.appearance ||= {};
    data.designSystem ||= {};
    const system = data.designSystem;
    const catalog = library && typeof library === "object" ? library : system;
    system.deletedThemeIds = Array.isArray(catalog.deletedThemeIds) ? catalog.deletedThemeIds : [];
    system.deletedAssetIds = Array.isArray(catalog.deletedAssetIds) ? catalog.deletedAssetIds : [];
    system.themes = mergeUnique(clone(builtInThemes), Array.isArray(catalog.themes) ? catalog.themes : [])
      .filter((theme) => !system.deletedThemeIds.includes(theme.id));
    system.themes.forEach((theme) => { theme.heroTextTheme = migrateTextThemeId(theme.heroTextTheme); });
    const catalogAssets = catalog.assets || {};
    system.assets = {};
    Object.keys(builtInAssets).forEach((key) => {
      system.assets[key] = mergeUnique(clone(builtInAssets[key]), Array.isArray(catalogAssets[key]) ? catalogAssets[key] : [])
        .filter((asset) => !system.deletedAssetIds.includes(asset.id));
    });
    system.assets.textThemes = system.assets.textThemes.filter((asset) => !legacyTextThemeIds.includes(asset.id));
    // Color presets always use the neutral invitation defaults. Movie presets
    // may still provide their own frame and text layout.
    system.colorDefaults = { heroDecoration: "none", heroTextTheme: "default_center", ...(catalog.colorDefaults || {}) };
    system.fontDefaults = {
      englishTitle: "cormorant-garamond",
      koreanTitle: "noto-serif-kr",
      koreanBody: "noto-serif-kr",
      subTitle: "gowun-batang",
      subText: "noto-sans-kr",
      ...(catalog.fontDefaults || {}),
    };
    const defaultPrompts = {
      base: "고급 모바일 청첩장 디자인 시스템을 만든다. 결과는 과하게 장식적이지 않고, 모바일 세로 화면에서 읽기 쉬워야 한다. 메인 사진을 가리지 않는 프레임, 한국어 이름과 날짜가 잘 보이는 문구 구조, 섹션 사이를 부드럽게 이어주는 작은 아이콘을 우선한다. 색상은 한 가지 색만 반복하지 말고 배경, 카드, 본문, 보조 글자, 포인트, 라인이 서로 구분되게 제안한다.",
      colorTheme: "컬러테마는 색상값 추천에 집중한다. 배경, 카드, 본문 글자, 보조 글자, 포인트, 라인 색상을 모바일 청첩장에 맞게 제안한다.",
      movieTheme: "영화테마는 사용자의 문장 속 장면, 계절, 감정, 시대감, 질감에서 색감 조합, 폰트, 메인 이미지 꾸밈, 메인 문구 테마, 섹션 아이콘, 갤러리 프레임, 버튼 모양을 함께 제안한다.",
      frameAsset: "메인이미지꾸밈은 사진 가장자리 또는 바깥을 보조하며 인물 얼굴을 가리지 않는다. 사진 위 오버레이 또는 바깥 프레임으로 쓸 수 있게 단순하고 고급스럽게 제안한다.",
      textThemeAsset: "메인문구테마는 이름과 날짜의 위계, 정렬, 폰트, 그림자, 박스 여부를 제안한다. 상업적 무료 폰트만 사용한다.",
      iconAsset: "섹션아이콘은 작고 단순하며 단색 또는 2색으로 쓴다. 참고 레퍼런스 이미지는 분위기와 구조만 참고하고 그대로 복제하지 않는다.",
      transport: "예식장 기준 자가용, 버스, 지하철 3가지를 기본으로 안내한다. 자가용은 식장 공식 안내를 우선해 주차장 위치와 외부 주차장 여부를 확인한다. 버스/지하철은 먼저 식장 도보 20분 이내에 버스정류장과 철도역이 각각 있는지 판정한다. 철도역은 지하철역을 우선하고, 지하철역이 없으면 기차역/KTX역/일반철도역으로 대체한다. 둘 다 있으면 각 이름과 도보 시간을 적고, 하나만 있으면 가까운 접근수단은 이름과 도보 시간을, 다른 접근수단은 그 지점에서 가까운 접근수단 또는 식장까지 이어지는 버스 번호/타는 정류장과 택시 시간을 함께 적는다. 불확실한 정보는 확인 필요라고 표시한다.",
      venue: "식장 공식홈페이지나 공식 안내 정보를 우선한다고 가정하고, 모르는 사실은 지어내지 않는다. 기본 안내사항은 주차와 식사다. 식사 안내에는 식권 받는 곳과 연회장 위치를 포함하고, 주차 안내에는 주차권 받는 곳, 주차권 필요 여부, 여러 주차장이 있으면 가능한 주차장을 정리한다.",
    };
    system.aiSettings = { enabled: true, provider: "Claude", model: "server-managed", endpoint: "/api/ai-design", removeWhiteBackground: true, whiteTolerance: 24, convertSvg: false, savePng: true, prompts: defaultPrompts, referenceImages: "", ...(catalog.aiSettings || {}), provider: "Claude", mockMode: false };
    system.aiSettings.prompts = { ...defaultPrompts, ...(system.aiSettings.prompts || {}) };
    const builtInLayouts = [
      { id: "classic", name: "클래식", description: "세로 스크롤 카드형. 히어로 사진 전체, 섹션별 깔끔한 구분.", previewBg: "#f7f0e7", previewAccent: "#8d3440", builtIn: true },
      { id: "editorial_red", name: "스칼렛 데이", description: "딥레드 + 흑백 사진. 잡지형 큰 타이포·폴라로이드 프로필 구도.", previewBg: "#f8f3ec", previewAccent: "#c41230", baseLayout: "editorial", builtIn: true },
      { id: "garden_doodle", name: "러브 두들", description: "초록 낙서 프레임 + 하트 사진. 손그림 감성의 사랑스러운 결혼식.", previewBg: "#eef2eb", previewAccent: "#c23b2a", baseLayout: "classic", builtIn: true },
      { id: "navy_arch", name: "달빛 서약", description: "파란 배경 + 아치 사진. 단정하고 품격 있는 커플의 웨딩.", previewBg: "#f5f7fa", previewAccent: "#1a2456", baseLayout: "arch", builtIn: true },
      { id: "cream_organic", name: "봄날 연가", description: "크림 + 라벤더 아치 패널. 둥글고 부드러운 봄 웨딩 무드.", previewBg: "#faf8f4", previewAccent: "#7c6d9a", baseLayout: "classic", builtIn: true },
      { id: "crimson_silk", name: "벨벳 나이트", description: "진홍 다크 히어로 + 크림 본문. 연인의 열정을 담은 스플릿 구조.", previewBg: "#f8f2ec", previewAccent: "#8b1a2f", baseLayout: "split", builtIn: true },
    ];
    // built-in 항목은 항상 최신 코드 기준으로 덮어씀. 사용자가 직접 만든 커스텀(AI) 레이아웃만 Supabase에서 유지.
    const savedCustomLayouts = (Array.isArray(catalog.layoutTemplates) ? catalog.layoutTemplates : []).filter((t) => !t.builtIn);
    system.layoutTemplates = mergeUnique(builtInLayouts, savedCustomLayouts);
    system.activeLayoutId = system.activeLayoutId || "classic";
    const legacyCustom = !data.appearance.design && ((data.appearance.heroDecoration && data.appearance.heroDecoration !== "none") || (data.appearance.heroTextTheme && data.appearance.heroTextTheme !== "auto"));
    const previousDesign = data.appearance.design;
    data.appearance.design = {
      presetId: themePresetId(data.appearance),
      ...(previousDesign || {}),
      heroDecoration: previousDesign
        ? (previousDesign.customEnabled === false ? "inherit" : previousDesign.heroDecoration || "inherit")
        : (legacyCustom ? data.appearance.heroDecoration : "inherit"),
      heroTextTheme: previousDesign
        ? (previousDesign.customEnabled === false ? "inherit" : previousDesign.heroTextTheme || "inherit")
        : (legacyCustom ? data.appearance.heroTextTheme : "inherit"),
    };
    data.appearance.design.heroTextTheme = migrateTextThemeId(data.appearance.design.heroTextTheme);
    delete data.appearance.design.customEnabled;
    data.accounts = Array.isArray(data.accounts) ? data.accounts.map((account) => ({ ...account, personName: account.personName || account.name || "", name: account.name || account.personName || "", relation: account.relation || "" })) : [];
    data.galleryDisplayMode = data.galleryDisplayMode === "original" ? "original" : "portrait";
    data.hero ||= {};
    data.hero.activeMedia = data.hero.activeMedia === "video" && data.hero.video ? "video" : "image";
    data.guestPhotos = {
      eventDate: data.wedding?.date || "",
      previewVisible: true,
      uploadSlug: "wedding-day",
      manageDescription: "이 휴대폰에서 보낸 사진과 영상을 확인하거나 삭제할 수 있습니다.",
      modalGuideTitle: "여러분의 사진첩이 우리 앨범이 됩니다.",
      modalGuideText: "1. 두 사람의 설렘 가득한 스냅\n2. 멋진 입장 & 환한 행진\n3. 가족·친구와의 찰칵 한 컷\n4. 당신의 시선으로 포착한 장면들",
      modalGuideFootnote: "작은 한 컷이 우리에게 큰 선물이 돼요.",
      ...(data.guestPhotos || {}),
    };
    data.rsvp = { modalGuide: "기차표와 숙소 준비를 위해 필요한 정보입니다.", ...(data.rsvp || {}) };
    data.publicPeriod = {
      openDate: "",
      closeDate: "",
      ...(data.publicPeriod || {}),
    };
    data.adminDefaults = {
      ...(data.adminDefaults || {}),
      heroFields: Array.isArray(data.adminDefaults?.heroFields) && data.adminDefaults.heroFields.length
        ? data.adminDefaults.heroFields
        : ["eyebrow", "names", "date"],
      signupFields: Array.isArray(data.adminDefaults?.signupFields) && data.adminDefaults.signupFields.length
        ? data.adminDefaults.signupFields
        : ["groomName", "brideName", "groomBirthday", "brideBirthday", "weddingDate", "weddingVenue", "weddingHall"],
      fieldLabels: {
        groomName: "신랑 이름",
        brideName: "신부 이름",
        venue: "식장 이름",
        address: "주소",
        ...(data.adminDefaults?.fieldLabels || {}),
      },
    };
    const sectionTitles = {
      invitation: { en: "Invitation", ko: "" },
      aboutUs: { en: "About Us", ko: "저희를 소개합니다" },
      weddingDay: { en: "Wedding Day", ko: "" },
      location: { en: "Location", ko: "오시는 길" },
      gallery: { en: "Gallery", ko: "갤러리" },
      information: { en: "Information", ko: "식장 안내" },
      attendance: { en: "Rsvp", ko: "참석 의사 전달" },
      weddingSnap: { en: "Guest Album", ko: "함께만드는 웨딩스냅" },
      account: { en: "Account", ko: "마음 전하는 곳" },
      guestbook: { en: "Guestbook", ko: "축하 메시지" },
    };
    data.sectionTitles = Object.fromEntries(Object.entries(sectionTitles).map(([key, value]) => [key, { ...value, ...(data.sectionTitles?.[key] || {}) }]));
    data.sectionDescriptions = {
      attendance: "신랑, 신부에게 참석의사를\n미리 전달할 수 있어요.",
      weddingSnap: "오늘의 추억은 여러분의 한 장에서 완성돼요!",
      account: "참석이 어려우신 분들을 위해\n계좌번호를 안내해 드립니다.",
      guestbook: "따뜻한 마음을 짧게 남겨 주세요.",
      ...(data.sectionDescriptions || {}),
    };
    return data;
  }

  const heartFramePath = "M1003.093 184.675c-25.849-65.573-79.989-95.277-149.221-81.281-30.358 6.146-57.611 19.656-83.676 35.888-42.185 26.28-77.034 60.568-107.87 99.15-33.202 41.511-61.886 86.052-87.769 132.456-10.155 18.215-20.489 36.318-30.738 54.477-2.521-.571-5.052-1.15-7.573-1.703.94-15.605 1.862-31.21 2.844-46.806 2.615-41.791-4.982-81.795-20.372-120.603-21.148-53.298-87.082-100.768-164.718-67.462-14.473 6.203-28.287 14.669-41.108 23.894-56.438 40.696-87.694 98.57-106.953 163.385-22.626 76.042-27.636 153.609-15.329 232.232 8.659 55.314 23.31 108.895 42.741 161.285 40.304 108.655 94.304 210.574 152.58 310.398 2.002 3.424 4 6.914 6.343 10.094 8.069 10.993 16.816 13.191 26.864 4.875 12.19-10.076 23.932-20.91 34.629-32.566 55.6-60.54 111.135-121.154 166.084-182.303 70.896-78.877 141.699-157.837 211.642-237.564 56.282-64.119 101.18-136.072 139.79-211.955 26.831-52.737 41.987-108.73 44.467-167.941 1.114-26.822-2.74-52.812-12.657-77.95z";
  function heartFrameIconUrl(strokeWidth) {
    const sw = Math.max(0.5, Number(strokeWidth) || 3);
    const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='180 95 845 1010'%3E%3Cpath d='${heartFramePath}' fill='none' stroke='%23ffffff' stroke-width='${sw}' stroke-linejoin='round' stroke-linecap='round'/%3E%3C/svg%3E`;
    return `url("data:image/svg+xml,${svg}")`;
  }

  function resolve(data = {}) {
    normalize(data);
    const design = data.appearance.design;
    const theme = data.designSystem.themes.find((item) => item.id === design.presetId && item.enabled !== false)
      || data.designSystem.themes.find((item) => item.id === "sky");
    const base = theme.type === "movie"
      ? { heroDecoration: theme.heroDecoration || "none", heroTextTheme: migrateTextThemeId(theme.heroTextTheme || "default_center") }
      : { heroDecoration: data.designSystem.colorDefaults.heroDecoration || "none", heroTextTheme: migrateTextThemeId(data.designSystem.colorDefaults.heroTextTheme || "default_center") };
    // navy_arch(달빛서약)·cream_organic(봄날연가)는 자체 메인이미지 장식(진주 웨이브/크림 가장자리)을 갖고 있어
    // 영화 테마의 하트 프레임 등을 그대로 물려받으면(inherit) 의도하지 않은 하트 모양이 겹쳐 보인다.
    const ownsHeroDecoration = ["navy_arch", "cream_organic"].includes(data.designSystem?.activeLayoutId);
    const heroDecoration = design.heroDecoration && design.heroDecoration !== "inherit"
      ? design.heroDecoration
      : (ownsHeroDecoration ? "none" : base.heroDecoration);
    const heroTextTheme = design.heroTextTheme && design.heroTextTheme !== "inherit" ? design.heroTextTheme : base.heroTextTheme;
    return {
      theme,
      palette: theme.palette || {},
      heroDecoration,
      heroTextTheme,
      heroDecorationAsset: (() => {
        const asset = data.designSystem.assets.frames.find((item) => item.id === heroDecoration);
        return asset ? { ...asset, tintColor: design.heroDecorationTint || asset.tintColor || "#ffffff" } : asset;
      })(),
      heroTextThemeAsset: (() => {
        const asset = data.designSystem.assets.textThemes.find((item) => item.id === heroTextTheme);
        const font = data.designSystem.assets.fonts.find((item) => item.id === asset?.fontId);
        return asset ? { ...asset, font, xPercent: design.heroTextXPercent ?? asset.xPercent, yPercent: design.heroTextYPercent ?? asset.yPercent } : asset;
      })(),
      sectionIcon: theme.type === "movie"
        ? (data.designSystem.assets.sectionIcons.find((item) => item.id === theme.sectionIcon)?.url || (/^https?:|^data:|^invitations\//.test(theme.sectionIcon || "") ? theme.sectionIcon : ""))
        : "",
      backgroundDecoration: theme.type === "movie"
        ? (data.designSystem.assets.backgrounds.find((item) => item.id === theme.backgroundDecoration)?.url || (/^https?:|^data:|^invitations\//.test(theme.backgroundDecoration || "") ? theme.backgroundDecoration : ""))
        : "",
    };
  }

  function apply(data = {}) {
    const resolved = resolve(data);
    const root = document.body;
    const appliedPalette = normalizedPalette(resolved.palette);
    root.dataset.theme = resolved.theme.type === "color" && builtInThemes.some((item) => item.id === resolved.theme.id) ? resolved.theme.id : "sky";
    root.dataset.movieConcept = resolved.theme.type === "movie" ? resolved.theme.id : "none";
    if (data.designSystem?.activeLayoutId) root.dataset.layout = data.designSystem.activeLayoutId;
    root.dataset.heroDecoration = resolved.heroDecorationAsset?.heroDecoration || resolved.heroDecoration || "none";
    root.dataset.heroTextTheme = resolved.heroTextTheme || "auto";
    root.dataset.heroTextLayout = resolved.heroTextThemeAsset?.layout || "default";
    root.classList?.toggle("has-custom-hero-decoration", Boolean(resolved.heroDecorationAsset?.url));
    root.classList?.toggle("custom-decoration-outer", resolved.heroDecorationAsset?.mode === "outer");
    root.classList?.toggle("has-custom-hero-text-theme", Boolean(resolved.heroTextThemeAsset && !builtInAssets.textThemes.some((item) => item.id === resolved.heroTextThemeAsset.id)));
    root.classList?.toggle("custom-hero-no-shadow", resolved.heroTextThemeAsset?.shadow === false);
    root.classList?.toggle("custom-hero-box", Boolean(resolved.heroTextThemeAsset?.boxEnabled));
    root.classList?.toggle("hide-hero-eyebrow", data.appearance.design.heroEyebrowEnabled === false);
    root.classList?.toggle("hide-hero-names", data.appearance.design.heroNamesEnabled === false);
    root.classList?.toggle("hide-hero-date", data.appearance.design.heroDateEnabled === false);
    root.classList?.toggle("custom-hero-positioned", Number.isFinite(Number(resolved.heroTextThemeAsset?.xPercent)) && Number.isFinite(Number(resolved.heroTextThemeAsset?.yPercent)));
    root.classList?.toggle("has-custom-background-decoration", Boolean(resolved.backgroundDecoration));
    const vars = {
      background: ["--paper", "--hero-bg", "--media-start"],
      side: ["--body-bg", "--admin-bg"],
      card: ["--card", "--surface", "--input-bg", "--button-hover"],
      ink: ["--ink", "--copy"],
      muted: ["--muted"],
      accent: ["--accent-dark", "--save", "--save-hover"],
      button: ["--accent", "--nav-button", "--nav-hover", "--media-end", "--button-hover"],
      buttonText: ["--button-text", "--nav-button-text"],
      primaryText: ["--primary-button-text"],
      introName: ["--intro-name-color"],
      introSubText: ["--intro-sub-color"],
      introShadow: ["--intro-text-shadow"],
      label: ["--label", "--nav-text", "--location-chip-text"],
      line: ["--line", "--nav-border"],
    };
    Object.entries(vars).forEach(([key, cssVars]) => appliedPalette[key] && cssVars.forEach((cssVar) => root.style.setProperty(cssVar, appliedPalette[key])));
    if (!appliedPalette.side && appliedPalette.background) root.style.setProperty("--body-bg", `color-mix(in srgb, ${appliedPalette.background} 72%, #ffffff)`);
    root.style.setProperty("--nav-bg", `color-mix(in srgb, ${appliedPalette.card} 94%, transparent)`);
    root.style.setProperty("--soft-bg", `color-mix(in srgb, ${appliedPalette.background} 86%, transparent)`);
    root.style.setProperty("--panel-bg", `color-mix(in srgb, ${appliedPalette.card} 72%, transparent)`);
    root.style.setProperty("--light-panel", `color-mix(in srgb, ${appliedPalette.card} 78%, transparent)`);
    root.style.setProperty("--design-background-decoration", resolved.backgroundDecoration ? `url("${mediaUrl(resolved.backgroundDecoration)}")` : "none");
    root.style.setProperty("--design-section-icon", resolved.sectionIcon ? `url("${mediaUrl(resolved.sectionIcon)}")` : "var(--section-divider)");
    root.style.setProperty("--hero-decoration-size", String((Number(data.appearance.design?.heroDecorationSize) || 100) / 100));
    root.style.setProperty("--hero-decoration-y", `${Number(data.appearance.design?.heroDecorationYPercent ?? 0) || 0}px`);
    root.style.setProperty("--hero-decoration-tint", data.appearance.design?.heroDecorationTint || "#ffffff");
    root.style.setProperty("--heart-frame-icon", heartFrameIconUrl(data.appearance.design?.heroDecorationStrokeWidth));
    root.style.setProperty("--custom-hero-decoration", resolved.heroDecorationAsset?.url ? `url("${mediaUrl(resolved.heroDecorationAsset.url)}")` : "none");
    root.style.setProperty("--custom-decoration-opacity", String(resolved.heroDecorationAsset?.opacity ?? 1));
    root.style.setProperty("--custom-decoration-blend-mode", resolved.heroDecorationAsset?.blendMode || "normal");
    root.style.setProperty("--custom-decoration-position", `${resolved.heroDecorationAsset?.xPercent ?? 50}% ${resolved.heroDecorationAsset?.yPercent ?? 50}%`);
    root.style.setProperty("--custom-decoration-size", `${resolved.heroDecorationAsset?.sizePercent ?? 100}% auto`);
    root.style.setProperty("--custom-decoration-tint", resolved.heroDecorationAsset?.tintColor || "transparent");
    root.style.setProperty("--custom-outer-scale", String(Math.max(0.2, Math.min(1.4, Number(resolved.heroDecorationAsset?.sizePercent ?? 100) / 100))));
    root.style.setProperty("--custom-hero-align", resolved.heroTextThemeAsset?.align || "center");
    root.style.setProperty("--custom-hero-name-size", `${resolved.heroTextThemeAsset?.nameSize || 34}px`);
    root.style.setProperty("--custom-hero-date-size", `${resolved.heroTextThemeAsset?.dateSize || 12}px`);
    root.style.setProperty("--custom-hero-opacity", String(resolved.heroTextThemeAsset?.opacity ?? 1));
    root.style.setProperty("--custom-hero-blend-mode", resolved.heroTextThemeAsset?.blendMode || "normal");
    root.style.setProperty("--custom-hero-x", `${resolved.heroTextThemeAsset?.xPercent ?? 50}%`);
    root.style.setProperty("--custom-hero-y", `${resolved.heroTextThemeAsset?.yPercent ?? 76}%`);
    root.style.setProperty("--custom-hero-width", `${resolved.heroTextThemeAsset?.widthPercent ?? 88}%`);
    root.style.setProperty("--custom-hero-gap", `${resolved.heroTextThemeAsset?.gap ?? 5}px`);
    root.style.setProperty("--custom-hero-eyebrow-name-gap", `${resolved.heroTextThemeAsset?.eyebrowNameGap ?? resolved.heroTextThemeAsset?.gap ?? 5}px`);
    root.style.setProperty("--custom-hero-name-date-gap", `${resolved.heroTextThemeAsset?.nameDateGap ?? resolved.heroTextThemeAsset?.gap ?? 5}px`);
    root.style.setProperty("--custom-hero-eyebrow-size", `${resolved.heroTextThemeAsset?.eyebrowSize ?? 10}px`);
    root.style.setProperty("--custom-hero-shadow-opacity", String(resolved.heroTextThemeAsset?.shadowOpacity ?? (resolved.heroTextThemeAsset?.shadow === false ? 0 : 0.34)));
    root.style.setProperty("--custom-hero-shadow-blur", `${resolved.heroTextThemeAsset?.shadowBlur ?? 8}px`);
    root.style.setProperty("--custom-hero-card-color", resolved.heroTextThemeAsset?.cardColor || "#ffffff");
    root.style.setProperty("--custom-hero-card-opacity", String(resolved.heroTextThemeAsset?.cardBackgroundEnabled === false ? 0 : resolved.heroTextThemeAsset?.cardOpacity ?? 0.82));
    root.style.setProperty("--custom-hero-card-border-color", resolved.heroTextThemeAsset?.cardBorderColor || "#ffffff");
    root.style.setProperty("--custom-hero-card-border-width", `${resolved.heroTextThemeAsset?.cardBorderEnabled === false ? 0 : resolved.heroTextThemeAsset?.cardBorderWidth ?? 0}px`);
    root.style.setProperty("--custom-hero-card-border-style", resolved.heroTextThemeAsset?.cardBorderStyle || "solid");
    root.style.setProperty("--custom-hero-card-radius", `${resolved.heroTextThemeAsset?.cardRadius ?? 8}px`);
    if (resolved.heroTextThemeAsset?.font) ensureFontFace(resolved.heroTextThemeAsset.font);
    const heroFontFamily = resolved.heroTextThemeAsset?.font?.family || "Cormorant Garamond";
    root.style.setProperty("--custom-hero-font-family", `"${cssString(heroFontFamily)}", "Noto Serif KR", serif`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(root).getPropertyValue("--body-bg").trim());
    return resolved;
  }

  const TEXT_STYLE_SECTION_ID = Object.fromEntries(Object.entries(window.WEDDING_SECTIONS?.titleKeys || { invitation: "invitation", "about-us": "aboutUs", "wedding-day": "weddingDay", location: "location", gallery: "gallery", "wedding-snap": "weddingSnap", information: "information", attendance: "attendance", account: "account", guestbook: "guestbook" }).map(([id, key]) => [key, id]));

  function textStyleSelector(name) {
    if (name === "hero.eyebrow") return ".hero-eyebrow";
    if (name === "coupleNames") return ".hero-names";
    if (name === "wedding.displayDateCustom") return ".hero-date";
    if (name === "wedding.venue") return ".location-venue";
    if (name === "wedding.hall") return ".location-hall";
    if (name === "wedding.address") return ".location-address";
    if (name === "sectionDescriptions.weddingSnap") return "#wedding-snap .subtle";
    if (name === "sectionDescriptions.attendance") return "#attendance .subtle";
    if (name === "sectionDescriptions.account") return "#account .subtle";
    if (name === "sectionDescriptions.guestbook") return "#guestbook .subtle";
    if (name === "ending.text") return ".ending-content .preserve";
    if (name === "invitation.paragraphs") return ".invitation-copy-group";
    const titleMatch = /^sectionTitles\.(.+)\.(en|ko)$/.exec(name);
    if (titleMatch) {
      const sectionId = TEXT_STYLE_SECTION_ID[titleMatch[1]];
      if (!sectionId) return null;
      return `#${sectionId} .${titleMatch[2] === "en" ? "section-label" : "section-title"}`;
    }
    return null;
  }

  function applyTextStyles(data, root = document) {
    const styles = data?.textStyles || {};
    Object.entries(styles).forEach(([name, style]) => {
      const selector = textStyleSelector(name);
      if (!selector || !style) return;
      root.querySelectorAll(selector).forEach((element) => {
        if (style.fontSize) element.style.setProperty("font-size", `${style.fontSize}px`, "important");
        if (style.offsetY) {
          element.style.setProperty("transform", `translateY(${style.offsetY}px)`, "important");
          element.style.setProperty("position", "relative", "important");
          element.style.setProperty("z-index", "18", "important");
        }
      });
    });
  }

  window.WEDDING_DESIGN = { builtInThemes, builtInAssets, normalize, resolve, apply, applyTextStyles };
})();
