(function () {
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const escapeLineHtml = (value = "") => escapeHtml(value).replace(/\n/g, "<br>");
  // 초대 문구의 **글자** 표기를 굵게 렌더링 (escape 이후 적용)
  const emphasisHtml = (value = "") => escapeHtml(value).replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  const formatDate = (value) => value ? new Date(value).toLocaleString("ko-KR") : "";
  const formatBytes = (bytes = 0) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };
  const dateInputToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const dateOnly = (value = "") => String(value || "").slice(0, 10);
  const addDays = (dateValue = "", days = 0) => {
    if (!dateValue) return "";
    const date = new Date(`${dateValue}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
  };

  const TRANSPORT_TYPES = [
    { label: "셔틀버스", icon: "🚌", lines: ["⏰", "📍"] },
    { label: "버스", icon: "🚍", lines: ["🚏", "📍"] },
    { label: "지하철", icon: "🚇", lines: ["🚇", "📍"] },
    { label: "기차", icon: "🚆", lines: ["🚆", "📍"] },
    { label: "도보", icon: "🚶", lines: ["🚶", "📍"] },
    { label: "자가용", icon: "🚗", lines: ["🛣️", "🅿️"] },
  ];
  const normalizeTransportTitle = (title = "") => {
    const value = String(title || "");
    if (value.includes("셔틀")) return "셔틀버스";
    // 기차/KTX/SRT/철도는 지하철과 별도 카테고리로 분리합니다.
    if (/KTX|SRT|기차|열차|철도|고속철/i.test(value)) return "기차";
    if (value.includes("지하철") || value.includes("전철") || value.includes("메트로") || value.includes("호선")) return "지하철";
    if (value.includes("도보") || value.includes("걷기")) return "도보";
    if (value.includes("자가용") || value.includes("주차") || value.includes("차량")) return "자가용";
    return "버스";
  };
  const normalizeTransportLines = (item = {}) => {
    if (Array.isArray(item.lines) && item.lines.length) {
      return item.lines.map((line) => ({ icon: line?.icon || "", text: line?.text || "" }));
    }
    const type = TRANSPORT_TYPES.find((entry) => entry.label === normalizeTransportTitle(item.title)) || TRANSPORT_TYPES[0];
    return String(item.text || "").split("\n").map((line) => line.trim()).filter(Boolean).map((text, index) => ({
      icon: type.lines[index] || type.lines[type.lines.length - 1],
      text,
    }));
  };

  // 식장 안내 본문: "라벨 · 내용" 줄이 새 행을 열고, 구분자 없는 줄은 앞 행에 이어 붙습니다.
  // 관리자 항목 편집기가 쓰는 두 형식: "라벨 ·"(설명 없는 항목), "· 내용"(이름 없는 항목)
  const parseNoticeRows = (text = "") => String(text).split("\n").map((line) => line.trim()).filter(Boolean).reduce((rows, line) => {
    const divider = line.indexOf(" · ");
    if (divider > 0) rows.push({ label: line.slice(0, divider).trim(), lines: [line.slice(divider + 3).trim()] });
    else if (line.endsWith(" ·")) rows.push({ label: line.slice(0, -2).trim(), lines: [] });
    else if (line.startsWith("· ")) rows.push({ label: "", lines: [line.slice(2).trim()] });
    else if (rows.length) rows[rows.length - 1].lines.push(line);
    else rows.push({ label: "", lines: [line] });
    return rows;
  }, []);
  const noticeRowsHtml = (notice = {}) => parseNoticeRows(notice.text).map((row, index) => `
    <div class="information-row">
      <span class="information-num">${index + 1}</span>
      <p>${row.label ? `<b>${escapeHtml(row.label)}</b>` : ""}${escapeLineHtml(row.lines.join("\n"))}</p>
    </div>`).join("");

  window.WEDDING_UTILS = {
    escapeHtml,
    escapeLineHtml,
    emphasisHtml,
    formatDate,
    formatBytes,
    dateInputToday,
    dateOnly,
    addDays,
    TRANSPORT_TYPES,
    normalizeTransportTitle,
    normalizeTransportLines,
    parseNoticeRows,
    noticeRowsHtml,
  };
})();

// 봉투 진입화면: 모양·색 계산과 마크업. 청첩장(app.js)과 관리자 진입화면 편집기 미리보기(admin.js)가 같이 씀.
// unit: 청첩장은 화면 너비(vw), 관리자 미리보기는 미리보기 틀 너비(cqw) 기준으로 그림
(function () {
  const { escapeHtml } = window.WEDDING_UTILS;
  // 봉투·실링·박 색. 기본값(브라운·아이보리 봉투, 버건디 실링, 자동 박) 외에는 관리자에서 직접 고른 색을 씀
  const ENVELOPE_COLORS = { brown: "#412d24", beige: "#f5efe4", white: "#fbfaf7", black: "#1f1d1e", sky: "#d3e4f3", pink: "#f6d3dc" };
  const SEAL_DEFAULT = "#53141f";
  const SEAL_COLORS = { burgundy: SEAL_DEFAULT, beige: "#d8c3a8", brown: "#5a3627", navy: "#1f2b4d", black: "#1c1b1b", white: "#f2eee7", sky: "#8fb6dc", pink: "#dd8fa1" };
  // 진입화면 국문 글꼴: 청첩장이 이미 불러오는 한글 글꼴 안에서만 고름(추가 내려받기 없음)
  // style="..." 속성 안에 들어가므로 작은따옴표로 감쌈
  const KO_FONTS = { dodum: "'Gowun Dodum'", batang: "'Gowun Batang'", myeongjo: "'Nanum Myeongjo'", notoserif: "'Noto Serif KR'" };
  const koFont = (key) => KO_FONTS[key] || "";
  const FOIL_COLORS = { beige: "#c2ad93", gold: "#cfa65e", silver: "#c9c9c6" };
  // 위 덮개 끝(실링 자리) 높이(%)와, 실링을 아래 덮개 평평한 윗변에 걸치도록 끝보다 올리는 정도(너비 단위). styles.css .envelope-seal top과 같게 유지
  const TIP = 68;
  const SEAL_LIFT = 9;

  const hexColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim() : fallback;
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (hex) => { const [r, g, b] = rgbOf(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  function colors(design = {}) {
    const envelope = design.envelopeColor === "custom"
      ? hexColor(design.envelopeCustomColor, ENVELOPE_COLORS.brown)
      : ENVELOPE_COLORS[design.envelopeColor] || ENVELOPE_COLORS.brown;
    const seal = design.sealColor === "custom" ? hexColor(design.sealCustomColor, SEAL_DEFAULT) : SEAL_COLORS[design.sealColor] || SEAL_DEFAULT;
    // 봉투 밝기로 문구를 음각(어두운 봉투)·양각(밝은 봉투) 중 어느 쪽으로 그릴지 정함
    const tone = luminance(envelope) > 0.5 ? "light" : "dark";
    // 문구는 박 색을 고르지 않고 항상 봉투 색에 맞춘 음각(어두운 봉투)·양각(밝은 봉투)으로 그림.
    // 예전에 저장된 foilColor 값은 무시함
    const foil = null;
    // 실링 질감을 그대로 overlay로 섞으면 아주 어둡거나 아주 밝은 색에서 하트 음각이 묻힘.
    // dark(버건디·남색·브라운): hard-light, matte(블랙 계열): 밝게 올린 무광, pale(흰색·베이지처럼 채도 낮은 밝은 색): 하트 홈에만 그늘을 한 겹 더함
    const [r, g, b] = rgbOf(seal);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const sealLight = luminance(seal);
    const sealTone = sealLight < 0.12 ? (chroma < 24 ? "matte" : "dark") : sealLight > 0.4 && chroma < 64 ? "pale" : "light";
    return { envelope, seal, tone, sealTone, foil };
  }

  // 가장자리에서 꼭짓점까지 직선, 꼭짓점 근처는 2차 곡선으로 둥글린 V자. direction 1: 아래로 뾰족(위 덮개)
  function vEdge(unit, slope, radius, apexY, direction, apexOffset = 0) {
    const point = (dx, dy) => `${(50 + dx).toFixed(2)}% calc(${apexY}% + ${(dy * direction + apexOffset).toFixed(2)}${unit})`;
    const points = [point(-50, -50 * slope)];
    for (let i = 0; i <= 14; i += 1) {
      const t = i / 14;
      const x = (1 - t) * (1 - t) * -radius + t * t * radius;
      const y = (1 - t) * (1 - t) * (-radius * slope) + 2 * (1 - t) * t * (radius * slope * 0.35) + t * t * (-radius * slope);
      points.push(point(x, y));
    }
    points.push(point(50, -50 * slope));
    return points;
  }

  // 위 덮개: 양옆 중간에서 시작해 실링 자리(가운데)로 모이고, 끝은 둥글게
  const flapClip = (unit) => `polygon(0 0, 100% 0, ${vEdge(unit, 0.62, 11, TIP, 1, -SEAL_LIFT + 3).reverse().join(", ")})`;

  // 아래 덮개: 어깨가 둥근 언덕 모양. 양옆 가장자리(실링 높이)에서 올라가 윗변은 실링 바로 위에서 평평하게 이어짐.
  // 닫혔을 땐 위 덮개가 윗변을 덮어 양옆에서 올라가는 선만 보이고, 열리면 실링이 걸친 둥근 윗변이 드러남
  function bottomClip(unit) {
    const point = ([x, offset]) => `${x.toFixed(2)}% calc(${TIP}% + ${offset.toFixed(2)}${unit})`;
    const rise = 12;
    const shoulderX = rise / 0.62;
    const radius = 7;
    const length = Math.hypot(shoulderX, rise);
    const corner = (cx, inX, inY) => {
      // 들어오는 방향(inX, inY)과 수평으로 나가는 방향 사이를 2차 곡선으로 둥글림
      const start = [cx - inX * radius, -rise - inY * radius];
      const end = [cx + (inX > 0 ? radius : -radius), -rise];
      const out = [];
      for (let i = 0; i <= 8; i += 1) {
        const t = i / 8;
        out.push([(1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * cx + t * t * end[0], (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * -rise + t * t * end[1]]);
      }
      return out;
    };
    const left = corner(shoulderX, shoulderX / length, -rise / length);
    const right = corner(100 - shoulderX, -shoulderX / length, -rise / length).reverse();
    return `polygon(0 100%, ${[[0, 0], ...left, ...right, [100, 0]].map(point).join(", ")}, 100% 100%)`;
  }

  // 양옆 날개: 가장자리 중간쯤에서 시작해 아래 덮개 윗변 뒤로 모임 → 열렸을 때 넓은 V자 입구가 됨
  function sideClip(unit, side) {
    const apex = `50% calc(${TIP}% - 14${unit})`;
    const start = `calc(${TIP}% - 49${unit})`;
    return side === "left" ? `polygon(0 ${start}, ${apex}, 0 100%)` : `polygon(100% ${start}, ${apex}, 100% 100%)`;
  }

  // attrs: 봉투 바깥 요소(.invitation-intro.envelope-intro)에 붙일 속성, stage: 그 안의 봉투
  // to: 받는 분 이름(개인 링크 ?to=). 비어 있으면 그 줄을 그리지 않아 원래 봉투 문구만 보임
  function render({ script = "", name = "", date = "", to = "", design = {}, unit = "vw" } = {}) {
    const c = colors(design);
    const vars = [`--env-color:${c.envelope}`, `--seal-color:${c.seal}`, `--env-u:1${unit}`];
    // pale 실링 그늘: 흰색은 옅게(0.25), 샌드 베이지처럼 조금 진한 색은 0.3
    if (c.sealTone === "pale") vars.push(`--seal-shade:${luminance(c.seal) > 0.75 ? 0.25 : 0.3}`);
    if (koFont(design.koFont)) vars.push(`--intro-ko-font:${koFont(design.koFont)}`);
    if (c.foil) vars.push(`--env-foil-a:${c.foil.a}`, `--env-foil-b:${c.foil.b}`);
    // 박 색 자동이면 종이와 같은 톤으로 눌린 음각(무광), 박 색을 고르면 금속 박
    const attrs = `data-intro-style="envelope" data-env-tone="${c.tone}" data-seal-tone="${c.sealTone}" data-env-foil="${c.foil ? "metal" : "deboss"}" style="${vars.join(";")}"`;
    const stage = `
      <div class="envelope-stage" role="button" tabindex="0" aria-label="청첩장 열기" data-envelope-open${to ? " data-has-to" : ""}>
        <div class="envelope-inside"></div>
        <div class="envelope-pocket">
          <i class="envelope-side envelope-side-left" style="clip-path:${sideClip(unit, "left")}"></i><i class="envelope-side envelope-side-right" style="clip-path:${sideClip(unit, "right")}"></i>
          <span class="envelope-bottom-wrap"><i class="envelope-bottom" style="clip-path:${bottomClip(unit)}"></i></span>
          ${to ? `<div class="envelope-copy envelope-copy-to-wrap"><p class="envelope-copy-to" data-envelope-to>to. ${escapeHtml(to)}</p></div>` : ""}
        </div>
        <div class="envelope-flap-group">
          <div class="envelope-flap-shadow">
            <i class="envelope-flap" style="clip-path:${flapClip(unit)}"></i>
          </div>
          <div class="envelope-copy">
            <p class="envelope-copy-script" data-envelope-script>${escapeHtml(script || "Save the date")}</p>
            <p class="envelope-copy-lead" data-intro-name data-envelope-name>${escapeHtml(name)}</p>
            <p class="envelope-copy-date" data-envelope-date>${escapeHtml(date)}</p>
          </div>
        </div>
        <div class="envelope-light"></div>
        <span class="envelope-seal" aria-hidden="true"><i></i></span>
        <p class="envelope-hint">터치하여 열어주세요</p>
      </div>`;
    return { attrs, stage, colors: c };
  }

  window.ENVELOPE_INTRO = { render, colors, koFont, ENVELOPE_COLORS, SEAL_DEFAULT, SEAL_COLORS, FOIL_COLORS };
})();
