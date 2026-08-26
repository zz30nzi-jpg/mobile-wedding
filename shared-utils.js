(function () {
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const escapeLineHtml = (value = "") => escapeHtml(value).replace(/\n/g, "<br>");
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
  const parseNoticeRows = (text = "") => String(text).split("\n").map((line) => line.trim()).filter(Boolean).reduce((rows, line) => {
    const divider = line.indexOf(" · ");
    if (divider > 0) rows.push({ label: line.slice(0, divider).trim(), lines: [line.slice(divider + 3).trim()] });
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
