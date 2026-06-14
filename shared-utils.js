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
    { label: "지하철", icon: "🚇", lines: ["🚆", "📍"] },
    { label: "도보", icon: "🚶", lines: ["🚶", "📍"] },
    { label: "자가용", icon: "🚗", lines: ["🛣️", "🅿️"] },
  ];
  const normalizeTransportTitle = (title = "") => {
    const value = String(title || "");
    if (value.includes("셔틀")) return "셔틀버스";
    if (value.includes("지하철") || value.includes("기차") || value.includes("전철") || value.includes("KTX")) return "지하철";
    if (value.includes("도보") || value.includes("걷기")) return "도보";
    if (value.includes("자가용") || value.includes("주차") || value.includes("차량")) return "자가용";
    return "버스";
  };

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
  };
})();
