(function () {
  const defaultOrder = ["invitation", "about-us", "wedding-day", "photo-interlude", "location", "information", "gallery", "wedding-snap", "attendance", "account", "guestbook"];
  const labels = {
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
  const titleKeys = {
    invitation: "invitation",
    "about-us": "aboutUs",
    "wedding-day": "weddingDay",
    location: "location",
    gallery: "gallery",
    "wedding-snap": "weddingSnap",
    information: "information",
    attendance: "attendance",
    account: "account",
    guestbook: "guestbook",
  };
  const defaultSettings = {
    preWedding: [...defaultOrder],
    weddingDay: [...defaultOrder],
  };
  const ids = [...defaultOrder];

  function normalizeOrder(items = [], options = {}) {
    const appendMissing = Boolean(options.appendMissing);
    const selected = items.filter((item, index) => ids.includes(item) && items.indexOf(item) === index);
    const withMissing = appendMissing ? [...selected, ...defaultOrder.filter((id) => !selected.includes(id))] : [...selected];
    const photoIndex = withMissing.indexOf("photo-interlude");
    const locationIndex = withMissing.indexOf("location");
    const weddingIndex = withMissing.indexOf("wedding-day");
    const looksLikeLegacyDefault = photoIndex > locationIndex && weddingIndex !== -1 && locationIndex !== -1;
    if (!looksLikeLegacyDefault) return withMissing;
    const moved = withMissing.filter((id) => id !== "photo-interlude");
    moved.splice(moved.indexOf("wedding-day") + 1, 0, "photo-interlude");
    return moved;
  }

  function parseOrder(value = "") {
    return normalizeOrder(String(value || "").split("\n")
      .map((item) => item.trim())
      .filter((item, index, items) => ids.includes(item) && items.indexOf(item) === index));
  }

  window.WEDDING_SECTIONS = {
    ids,
    labels,
    titleKeys,
    defaultOrder,
    defaultSettings,
    normalizeOrder,
    parseOrder,
  };
})();
