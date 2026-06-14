/* AI guide service for the general admin editor. */
(function () {
window.createWeddingAIService = function createWeddingAIService() {
  const settings = (context = {}) => ({ ...(window.WEDDING_AI_SETTINGS?.() || {}), ...(context.settings || {}) });
  const isLocalPage = () => ["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:";
  const configuredEndpoint = () => window.RSVP_CONFIG?.aiEndpoint || "/api/ai-design";
  const normalizeEndpoint = (endpoint = "") => {
    const value = String(endpoint || "").trim();
    const fallback = isLocalPage() ? configuredEndpoint() : "/api/ai-design";
    if (!value || value === "undefined" || value === "null") return fallback;
    try {
      const url = new URL(value, window.location.origin);
      if (url.pathname === "/api/ai-design") {
        if (url.origin !== window.location.origin) return url.href;
        return isLocalPage() ? configuredEndpoint() : `/api/ai-design${url.search}`;
      }
    } catch {}
    return fallback;
  };
  const storedAccessToken = () => {
    try {
      const projectRef = new URL(window.RSVP_CONFIG?.supabaseUrl || "").hostname.split(".")[0];
      const keys = projectRef ? [`sb-${projectRef}-auth-token`] : [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("sb-") && key.endsWith("-auth-token") && !keys.includes(key)) keys.push(key);
      }
      for (const key of keys) {
        const session = JSON.parse(localStorage.getItem(key) || "null");
        const token = session?.access_token || session?.currentSession?.access_token;
        if (token) return token;
      }
    } catch {}
    return "";
  };
  const authHeaders = async () => {
    const client = window.RSVP_STORAGE?.getSupabaseClient?.();
    try {
      const { data } = client ? await client.auth.getSession() : { data: {} };
      if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` };
    } catch {}
    const token = storedAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  const result = (type, context = {}, extras = {}) => ({
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    createdAt: new Date().toISOString(),
    instruction: context.instruction || "",
    ...extras,
  });
  const normalizeGuideText = (value = "", maxLines = 3) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.includes("\n")) return text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, maxLines).join("\n");
    return text
      .replace(/\s+/g, " ")
      .replace(/(다\.|요\.|니다\.|[.!?。])\s+/g, "$1\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxLines)
      .join("\n");
  };
  const normalizeGuideItems = (items = [], maxLines = 3) => items.map((item) => ({
    ...item,
    title: String(item.title || "").trim(),
    text: normalizeGuideText(item.text, maxLines),
  })).filter((item) => item.title || item.text);
  const request = async (type, context, mock) => {
    const current = settings(context);
    if (current.mockMode !== false) return mock();
    const endpoint = normalizeEndpoint(current.endpoint);
    let response;
    const fallback = (message) => ({
      ...mock(),
      fallbackReason: message || "AI 서버 호출에 실패해 임시 초안을 사용했습니다.",
    });
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ type, provider: current.provider || "Gemini", context }),
      });
    } catch (error) {
      return fallback(`AI 서버에 연결하지 못해 임시 초안을 사용했습니다. (${error.message || "Failed to fetch"})`);
    }
    const rawText = await response.text().catch(() => "");
    let payload = {};
    try { payload = rawText ? JSON.parse(rawText) : {}; } catch {}
    if (!response.ok && /혼잡|high demand|overloaded|temporarily|일시/i.test(payload.error || "")) {
      return { ...mock(), fallbackReason: payload.error || "AI 서버가 일시적으로 혼잡해 임시 결과를 사용했습니다." };
    }
    if (!response.ok) {
      console.error("AI 요청 실패", { endpoint, status: response.status, vercelId: response.headers.get("x-vercel-id"), body: rawText.slice(0, 500) });
      const detail = payload.error || (rawText && !rawText.trim().startsWith("<") ? rawText.slice(0, 200) : "") || response.statusText || "";
      return fallback(detail ? `AI 서버 호출에 실패했습니다. (${response.status}) ${detail}` : `AI 서버 호출에 실패했습니다. (${response.status})`);
    }
    return { ...payload, id: payload.id || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, createdAt: payload.createdAt || new Date().toISOString() };
  };
  const generateTransportGuide = async (context = {}) => request("transportGuide", context, () => result("transportGuide", context, {
    items: [
      { title: "지하철", text: `가까운 역(확인 필요)에서 하차해 주세요.\n역에서 예식장까지 도보 또는 택시로 이동해 주세요.` },
      { title: "버스", text: `이용 가능한 버스 번호(확인 필요)와 정류장을 확인해 주세요.\n정류장에서 예식장까지 도보로 이동해 주세요.` },
      { title: "자가용", text: `${context.venue || "예식장"} 주소를 내비게이션에 입력해 주세요.\n주차장 위치와 이용 방법은 예식장 안내를 확인해 주세요.` },
    ],
    caution: "Mock Mode 결과입니다.",
  }));
  const generateVenueGuide = async (context = {}) => request("venueGuide", context, () => result("venueGuide", context, {
    notices: [
      { title: "연회장 안내", text: "연회장 위치는 예식장 안내 데스크에서 확인해 주세요.\n식사 이용 시간과 층수는 확정 후 안내해 주세요." },
      { title: "주차 안내", text: "예식장 내/외부 주차장 위치를 확인해 주세요.\n야외 주차장이 있는 경우 동선 안내가 필요합니다." },
      { title: "주차 정산", text: "무료 주차 시간과 정산 방식은 확인 필요합니다.\n주차권 또는 차량번호 등록 여부를 안내해 주세요." },
    ],
    caution: "Mock Mode 결과입니다.",
  }));
  const wrap = (service, key, maxLines = 3) => async (context = {}) => {
    const response = await service(context);
    if (key === "items") return { ...response, items: normalizeGuideItems(response.items || [], maxLines) };
    return { ...response, notices: normalizeGuideItems(response.notices || [], maxLines) };
  };
  return {
    generateTransportGuide: wrap(generateTransportGuide, "items", 4),
    generateVenueGuide: wrap(generateVenueGuide, "notices"),
  };
};
})();

