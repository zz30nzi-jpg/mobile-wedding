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

  window.WEDDING_UTILS = {
    escapeHtml,
    escapeLineHtml,
    formatDate,
    formatBytes,
    dateInputToday,
    dateOnly,
    addDays,
  };
})();
