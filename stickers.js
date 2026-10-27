(function () {
  // Hand-drawn line stickers. Stroked with currentColor so CSS `color` tints them.
  const svg = (body, extra = "") => `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  // Crayon look: every stroke is drawn twice, slightly offset, like a waxy double line.
  const crayon = (body) => svg(`<g stroke-width="1.7" opacity="0.92">${body}</g><g stroke-width="1.2" opacity="0.55" transform="translate(0.7 0.5) rotate(0.4 60 60)">${body}</g>`);
  const ring = (cx, cy, count, petal, rotate = 0) => Array.from({ length: count }, (_, index) =>
    `<path d="${petal}" transform="translate(${cx} ${cy}) rotate(${rotate + (360 / count) * index})"/>`).join("");

  const list = [
    {
      id: "heart_hug",
      name: "하트 뒤에 숨은 우리",
      svg: svg(`
        <path d="M60 27C53 12 31 7 24 23C18 40 34 58 60 80C86 58 103 41 96 23C89 7 67 12 60 27Z"/>
        <path d="M24 31C18 30 16 34 20 36C16 37 16 41 20 42C17 44 19 47 24 45"/>
        <path d="M96 31C102 30 104 34 100 36C104 37 104 41 100 42C103 44 101 47 96 45"/>
        <path d="M40 62Q44 65 47 67L47 103L41 103Z" fill="currentColor"/>
        <path d="M50 70Q53 73 56 75L57 103L51 103Z" fill="currentColor"/>
        <path d="M41 105L47 105L47 109L35 109Q36 106 41 105Z" fill="currentColor"/>
        <path d="M51 105L57 105L57 109L45 109Q46 106 51 105Z" fill="currentColor"/>
        <path d="M63 79Q60 91 61 98Q66 102 72 99Q78 103 84 99Q90 102 96 97Q94 79 83 59"/>
        <path d="M70 84L69 93M77 79L77 91M84 73L87 89" stroke-width="1.6"/>
        <path d="M74 100L74 107M83 100L83 107"/>
        <path d="M70 110L74 106L76 110ZM79 110L83 106L85 110Z" fill="currentColor" stroke-width="1.4"/>
        <path d="M104 12C102 8 97 9 98 13C98 16 102 18 104 20C106 18 110 16 110 13C111 9 106 8 104 12Z" stroke-width="1.8"/>
        <path d="M14 14L17 18M10 22L15 22" stroke-width="1.6"/>`),
    },
    {
      id: "flower_hand",
      name: "꽃 세 송이",
      svg: svg(`
        <path d="M58 70L49 42M62 70L62 34M66 70L77 46"/>
        ${ring(48, 38, 4, "M0 0C-5 -4 -5 -11 0 -11C5 -11 5 -4 0 0", 20)}
        ${ring(62, 29, 5, "M0 0C-5 -4 -4 -10 0 -10C4 -10 5 -4 0 0", 0)}
        ${ring(78, 42, 4, "M0 0C-5 -4 -5 -11 0 -11C5 -11 5 -4 0 0", -15)}
        <path d="M55 52C49 50 45 53 44 57C49 58 53 56 55 52Z" stroke-width="1.8"/>
        <path d="M36 110C38 97 40 85 46 77C50 71 54 67 58 68C60 70 59 74 56 77"/>
        <path d="M57 72C65 68 75 69 75 73C75 77 65 77 58 77"/>
        <path d="M58 77C66 76 77 77 77 81C77 85 66 85 58 84"/>
        <path d="M58 84C66 84 76 85 75 89C74 92 65 92 58 91"/>
        <path d="M58 91C64 91 72 92 70 95C68 98 62 97 58 96"/>
        <path d="M56 77L58 96L61 110"/>
        <path d="M64 97L66 109M69 97L72 107"/>`),
    },
    {
      id: "daisy_hand",
      name: "데이지 한 송이",
      svg: svg(`
        ${ring(72, 30, 7, "M0 -3C-5 -9 -4 -16 0 -17C4 -16 5 -9 0 -3", 8)}
        <circle cx="72" cy="30" r="2.2"/>
        <path d="M71 34C70 44 68 54 66 64"/>
        <path d="M69 49C75 44 82 45 86 42C81 39 73 42 69 49Z" stroke-width="1.8"/>
        <path d="M12 77C26 75 38 72 49 66"/>
        <path d="M12 93C28 92 42 92 56 92"/>
        <path d="M49 66C54 60 64 60 68 64C74 66 74 72 70 74C75 76 75 82 70 83C74 85 73 91 67 91L56 92"/>
        <path d="M61 75L69 74M61 83L69 83" stroke-width="1.8"/>
        <path d="M64 92L60 110"/>`),
    },
    {
      id: "rings",
      name: "반짝이는 반지",
      svg: svg(`
        <path d="M45 42C31 43 24 57 27 71C31 86 49 93 62 85C71 79 75 66 71 55C68 47 61 41 51 41.5" stroke-width="2"/>
        <path d="M47.5 46.5C37 48 31 59 33.5 70C36.5 81 49.5 87 58.5 81C66 76 68.5 66 65.5 57C63.5 51 58.5 46.5 51 46" stroke-width="1.6"/>
        <path d="M32 31.5L39.5 25L50.5 27.5L53 33.5L45.5 44Z" stroke-width="1.8"/>
        <path d="M32 31.5L53 33.5M39.5 25L41.5 32.5L45.5 44M50.5 27.5L46 32.8M41.5 32.5L36 29" stroke-width="1.3"/>
        <path d="M73.5 62C87.5 60.5 98 72 96.5 84.5C95 96.5 81 102.5 70.5 96.5C60.5 90.5 58 77 64 68.5C66.5 65 69 63 72 62.3" stroke-width="2"/>
        <path d="M73 66.5C84.5 65.5 92 74.5 91 84C89.5 93 79.5 97.5 71.5 92.5C64 88 62 78.5 66.5 71" stroke-width="1.6"/>
        <path d="M66 12L66.5 26M59.5 19.5L73 18.8" stroke-width="1.5"/>
        <path d="M39 13L44.5 20M44.5 13L39 20.5M37.5 16.8L46.5 16.5" stroke-width="1.4"/>
        <path d="M14 47L19.5 53M19.8 46.5L13.8 53.5M12.5 50L21 50.2" stroke-width="1.4"/>
        <path d="M23 93L28 101M28.5 93L22.5 101.5M21.5 97L30 97.2" stroke-width="1.5"/>
        <circle cx="58" cy="35" r="1" fill="currentColor" stroke="none"/>
        <circle cx="74" cy="31" r="0.8" fill="currentColor" stroke="none"/>
        <circle cx="26" cy="64" r="1" fill="currentColor" stroke="none"/>
        <circle cx="21" cy="75" r="0.8" fill="currentColor" stroke="none"/>`),
    },
    {
      id: "heart_buddies",
      name: "하트 친구들",
      svg: svg(`
        <path d="M36.5 55C33.5 46.5 22 46 21.5 56.5C21 64.5 29.5 70.5 36 79C42 70.5 50.5 64 50 54.5C49.5 46 38.5 46.5 36.8 54.5"/>
        <circle cx="31.8" cy="58" r="1.1" fill="currentColor" stroke="none"/>
        <circle cx="40" cy="57.6" r="1.1" fill="currentColor" stroke="none"/>
        <path d="M32.5 62.5C33.5 68.5 40 68 40.2 61.8" stroke-width="2"/>
        <path d="M36 79L31.5 92.5L35.5 93M36.2 79.5L39.5 92L44 91.6" stroke-width="2.1"/>
        <path d="M22.5 60.5L10 61.2L10.3 64.5" stroke-width="2.1"/>
        <path d="M48.8 58C53.5 51 57 43.5 59.8 37" stroke-width="2.1"/>
        <path d="M84.3 50.5C81.5 42 70.2 41.6 69.8 52.2C69.4 60.4 77.8 66.3 84.2 74.6C90.4 66.2 98.6 59.8 98.2 50.4C97.8 41.8 86.8 42.4 84.6 50.4"/>
        <circle cx="80" cy="54" r="1.1" fill="currentColor" stroke="none"/>
        <circle cx="88.2" cy="53.8" r="1.1" fill="currentColor" stroke="none"/>
        <path d="M80.6 58.6C81.4 64.4 87.8 64 88 57.8" stroke-width="2"/>
        <path d="M84.2 74.6L80.2 88.4L84.5 88.8M84.6 75L86.4 88L91.2 87.6" stroke-width="2.1"/>
        <path d="M97.4 55.8L110.6 53.8L110.8 57" stroke-width="2.1"/>
        <path d="M71.2 54.4C67 48.2 63 42.2 60.4 37" stroke-width="2.1"/>
        <path d="M60.2 34.6C57.2 31 54.8 27.8 56.2 24.8C57.6 22.2 60 23.2 60.4 26C61 22.8 64.2 22 65.2 24.6C66.4 27.8 62.8 31 60.4 34.2" stroke-width="2"/>`),
    },
    {
      id: "cartoon_couple",
      name: "웃는 신랑신부",
      svg: svg(`
        <path d="M30 30.5C29.6 24.6 31.2 21.4 38 21.6C44.8 21.8 46.4 24.8 46.2 30.6Z" fill="currentColor"/>
        <path d="M26.4 31C32.8 33.2 43.4 33.2 50 30.6" stroke-width="2.6"/>
        <path d="M29 37C28.4 47.4 33 51.2 38.4 51C44 50.8 48 47 47.4 36.6"/>
        <path d="M27.6 35.4C28.8 33.8 30.2 34.2 30.8 35.6M48.4 35.2C47.4 33.8 46 34 45.4 35.4" stroke-width="1.6"/>
        <path d="M32.4 38.4L35.4 37.6M41.2 37.6L44.2 38.4" stroke-width="1.4"/>
        <circle cx="34.2" cy="40.8" r="1.1" fill="currentColor" stroke="none"/>
        <circle cx="42.2" cy="40.8" r="1.1" fill="currentColor" stroke="none"/>
        <path d="M33.8 44.8C36 49.4 41.2 49.2 42.8 44.6C39.8 45.6 36.8 45.6 33.8 44.8Z" stroke-width="1.6"/>
        <path d="M33 53.2L38.2 55.6L33 58ZM43.4 53.2L38.2 55.6L43.4 58Z" stroke-width="1.6"/>
        <path d="M38.2 57.6L38.4 80.6"/>
        <path d="M38.4 80.6C34.4 88.4 33.4 96.4 33.6 103.6M38.4 80.6C42.4 88.6 43.4 96.4 43.2 103.6"/>
        <ellipse cx="31.4" cy="106" rx="3.8" ry="2.8"/>
        <ellipse cx="45.4" cy="106" rx="3.8" ry="2.8"/>
        <path d="M38.2 60C30.6 59.4 24.6 55.4 20.6 49.6"/>
        <path d="M17.8 47.6C15.6 45 13.2 42.4 14.6 40.4C16 38.6 17.8 39.6 18.2 41.4C18.8 39.4 21.4 39 22 41C22.8 43.4 20 45.6 17.8 47.6Z" stroke-width="1.8"/>
        <path d="M38.4 60.4C45.6 65.6 52 72.8 56.2 78.4"/>
        <circle cx="58.6" cy="80.4" r="3.2" stroke-width="1.8"/>
        <path d="M75.6 35.6C74.6 30.2 79.8 28.2 81 32.4C82.2 28.2 87.6 30.4 85.4 35.6" stroke-width="1.8"/>
        <path d="M71.6 43.4C70.8 49.6 74.8 53.6 80.2 53.4C85.6 53.2 89.4 49.2 88.4 42.8C87.4 36.4 82.8 34.6 79.4 34.8C75 35.2 72.2 38.4 71.6 43.4"/>
        <path d="M72.2 40.6C75.4 41.2 77.8 39.4 79 37.2C80.6 39.4 84 40.8 87.8 40.2" stroke-width="1.5"/>
        <path d="M88.4 39C96.4 42.6 100.6 52.4 98.6 62.6C94.4 61 90.6 58.4 88.4 54.4" stroke-width="1.8"/>
        <circle cx="77.2" cy="44.6" r="1.1" fill="currentColor" stroke="none"/>
        <circle cx="83.6" cy="44.6" r="1.1" fill="currentColor" stroke="none"/>
        <path d="M77.2 48.6C79 52.4 82.6 52.4 84.2 48.4" stroke-width="1.6"/>
        <path d="M76.2 54.4L75.8 66.2M84.4 54.4L84.8 66.2M75.2 66.4C78.4 67.4 82 67.4 85.4 66.2"/>
        <path d="M75.2 66.4C70.4 76 66.2 86 66 94.4C74.4 97.6 86.2 97.6 94.8 94.2C94.4 86 90.4 76 85.4 66.2"/>
        <path d="M77.4 96.4L77.2 103.4M84.4 96.4L84.6 103.4M73.6 104.2C75.6 103.4 78 103.4 80 104.2M81 104.2C83 103.4 85.4 103.4 87.4 104.2" stroke-width="1.8"/>
        <path d="M76 57.4C70.2 64.8 64.8 73.8 61 79.2"/>
        <path d="M84.6 57.4C88.4 62.6 92 66.2 94.6 68.2"/>
        <path d="M95.4 68.4C93.8 66.4 95.4 64.2 97.4 65.2C98.8 66.2 97.6 68 96.4 67.2M100.6 66.4C100.2 64.2 102.8 63.6 103.4 65.6C103.8 67.4 101.6 67.8 101.2 66.6M97.2 72.8C96 70.8 98 69 99.6 70.4C100.8 71.6 99.4 73.2 98.4 72.2M102.4 71.6C102.2 69.6 104.8 69.4 105 71.4C105.2 73 103.2 73.2 102.8 72" stroke-width="1.4"/>`),
    },
    {
      id: "crayon_couple",
      name: "크레용 신랑신부",
      svg: crayon(`
        <path d="M60.2 22.4C57.6 18.8 52.6 15.8 52.8 12.6C53 9.4 57.6 8.8 60 12.4C62 8.6 66.8 9.2 67 12.6C67.2 16 62.6 18.8 60.2 22.4Z"/>
        <path d="M30.4 23.6L41.8 23.2L42.2 33.8L30.2 34Z"/>
        <path d="M32 25.5L32.2 32.6M34.2 24.6L34.4 33.2M36.4 24.4L36.6 33.4M38.6 24.4L38.8 33.4M40.6 24.6L40.8 33.2"/>
        <path d="M26 34.6C32.6 34 39.4 34 46.4 34.4"/>
        <path d="M36.2 34.8C31.2 35 28.2 38.6 28.4 42.6C28.6 47 32.2 50 36.4 49.8C40.6 49.6 44 46.6 43.8 42.2C43.6 38 40.6 34.8 36.2 34.8"/>
        <path d="M31 51.2L41.6 51L42.4 72.2L30.2 72.4Z"/>
        <path d="M32.4 53L32.2 70.8M34.6 52.4L34.6 71.4M36.8 52.2L36.8 71.4M39 52.2L39.2 71.4M41 52.6L41.4 71.2"/>
        <path d="M33.2 72.4L32 96.6M39.6 72.2L40.6 96.4"/>
        <path d="M31.2 54.4L24 70.6M41.6 54.6L58.6 66.4"/>
        <path d="M84.2 34.6C79.2 34.8 76.2 38.4 76.4 42.4C76.6 46.8 80.2 49.8 84.4 49.6C88.6 49.4 92 46.4 91.8 42C91.6 37.8 88.6 34.6 84.2 34.6"/>
        <path d="M78.4 36.8C81.6 34.2 86.6 33.8 90.2 36.6"/>
        <path d="M80.6 35.4L81.4 33.2M84.2 34.6L84.6 32.2M87.6 35L88.6 32.8"/>
        <path d="M89.4 36C97 37.4 102 45 103.4 54C104.4 60.2 104.8 64.8 104 68.6"/>
        <path d="M104 68.6C102.2 66.8 100.8 68.2 99.4 66.4C98 64.8 96.6 66 95.4 64C94.2 62.2 93 62.8 92 60.4"/>
        <path d="M92 60.4C90.8 55.2 90.4 49.6 90.8 43.8"/>
        <path d="M93.2 40.6C95.8 46.6 97.2 54 97.6 62.4M96.6 39.4C99.6 45.4 100.8 53 101.2 64.6"/>
        <path d="M84 50.2L70 96.2C79.4 97 89 97 98.2 96.2L84.6 50.2"/>
        <path d="M81 56.2L61.6 66.6M87.4 56.4L95.6 70.4"/>
        <path d="M80.4 96.6L80.2 102.6M88.2 96.6L88.4 102.4"/>`),
    },
    {
      id: "tiny_couple",
      name: "작은 신랑신부",
      svg: svg(`
        <path d="M38.4 98C37.4 85 36.6 72 38 63C39.6 54 46 49.6 52.6 50C59 50.6 62.4 56.6 62.2 65L62.6 97.6" stroke-width="2"/>
        <path d="M38.4 98C36.4 97.8 34.4 98.6 32.8 99.6C38 99 46 98.8 54 99C64 99.2 76 98.8 86.4 99.2" stroke-width="2"/>
        <path d="M51.2 55.2C47 55 45 58.8 45.2 62.4C45.4 66.2 48 69 51.4 68.8C54.8 68.6 57.2 65.6 56.8 61.8C56.4 58.2 54.4 55.2 50.6 55.4" stroke-width="1.9"/>
        <g transform="translate(0 4)"><path d="M45.2 77.4C44 75.2 46.4 73.4 48 74.8C49.2 76 48 77.8 46.6 77.2M50.6 76.2C50 73.8 52.8 73 53.6 75C54.2 76.8 52 77.6 51.2 76.4M48 81.2C46.8 79 49.2 77.6 50.6 79C51.6 80.2 50.2 81.8 48.8 81.2" stroke-width="1.5"/>
        <path d="M45.6 81C43.4 81.2 42 82.8 41.4 84.8C43.6 84.6 45 83.2 45.6 81M54.2 78.6C56.8 78.4 58.4 79.8 59.4 81.8C57 82.2 55.2 81 54.2 78.6" stroke-width="1.4"/></g>
        <path d="M70.4 34.4L81.6 33.8L82 44L70.2 44.2Z" fill="currentColor" stroke-width="1.6"/>
        <path d="M65.8 44.8C72.4 44.2 79.6 44.2 86.4 44.6" stroke-width="2.4"/>
        <path d="M76.2 45.4C72.2 45.4 69.4 48.4 69.6 52.2C69.8 56 72.8 58.8 76.6 58.6C80.4 58.4 83 55.4 82.8 51.6C82.6 48 80 45.4 76.4 45.4" stroke-width="1.9"/>
        <path d="M71.4 60.6L76 63.2L71.2 65.8ZM80.8 60.4L76 63.2L81 65.8Z" fill="currentColor" stroke-width="1.3"/>
        <path d="M71.2 62.2C68.4 62.4 66.4 64.4 66.2 67.4L66.4 98.6M80.8 62C83.8 62.2 85.8 64.2 86 67.2L85.8 98.8" stroke-width="2"/>
        <path d="M76 72L76.2 72.4M76.2 79.2L76.4 79.6M76.2 86.4L76.4 86.8" stroke-width="2.8"/>`),
    },
  ];

  const colors = [
    { id: "", label: "테마색" },
    { id: "#7b1f24", label: "버건디" },
    { id: "#b8323a", label: "레드" },
    { id: "#2a2623", label: "블랙" },
    { id: "#8b877c", label: "웜그레이" },
  ];

  const clamp = (value, fallback, min, max) => {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  };

  // x: 스티커 가운데의 가로 위치(섹션 너비의 %).
  // top: 섹션 맨 위에서 스티커 가운데까지의 거리(px). 섹션 안 토글을 열거나 방명록이 늘어나 섹션이 길어져도 제자리에 있게 함.
  // y: 예전 방식(섹션 높이의 %). top이 없는 예전 스티커만 씀(처음 그릴 때 px로 바꿔 고정, app.js).
  function normalize(item = {}) {
    return {
      id: String(item.id || `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
      sticker: list.some((entry) => entry.id === item.sticker) ? item.sticker : list[0].id,
      section: String(item.section || "invitation"),
      x: Math.round(clamp(item.x, 82, 0, 100) * 10) / 10,
      y: Math.round(clamp(item.y, 12, 0, 100) * 10) / 10,
      top: item.top == null || item.top === "" || !Number.isFinite(Number(item.top)) ? null : Math.round(clamp(item.top, 0, 0, 20000)),
      size: clamp(item.size, 84, 28, 240),
      rotate: clamp(item.rotate, 0, -180, 180),
      color: /^#[0-9a-f]{6}$/i.test(String(item.color || "")) ? String(item.color).toLowerCase() : "",
    };
  }

  function markup(item) {
    const sticker = list.find((entry) => entry.id === item.sticker);
    if (!sticker) return "";
    const style = `left:${item.x}%;top:${item.top == null ? `${item.y}%` : `${item.top}px`};--sticker-size:${item.size}px;--sticker-rotate:${item.rotate}deg;${item.color ? `--sticker-color:${item.color};` : ""}`;
    return `<span class="invitation-sticker" data-sticker-id="${item.id}" style="${style}">${sticker.svg}</span>`;
  }

  window.WEDDING_STICKERS = { list, colors, normalize, markup };
})();
