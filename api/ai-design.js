const API_URL = "https://api.openai.com/v1/responses";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://mobile-wedding-ecru.vercel.app",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
];

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(request, response) {
  const origin = request.headers.origin || "";
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Vary", "Origin");
  if (!origin) return true;
  if (!allowedOrigins().includes(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  return true;
}

const transportSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string", enum: ["셔틀버스", "버스", "지하철", "도보", "자가용"] },
          text: { type: "string" },
        },
        required: ["title", "text"],
        additionalProperties: false,
      },
    },
    caution: { type: "string" },
  },
  required: ["items", "caution"],
  additionalProperties: false,
};

const venueSchema = {
  type: "object",
  properties: {
    notices: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          text: { type: "string" },
        },
        required: ["title", "text"],
        additionalProperties: false,
      },
    },
    caution: { type: "string" },
  },
  required: ["notices", "caution"],
  additionalProperties: false,
};

function schemaFor(type) {
  if (type === "transportGuide") return transportSchema;
  if (type === "venueGuide") return venueSchema;
  return null;
}

function outputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text") return content.text;
      if (content.type === "refusal") throw new Error(content.refusal || "요청이 거절되었습니다.");
    }
  }
  throw new Error("AI 응답 본문이 없습니다.");
}

async function registeredOwner(request) {
  const authorization = request.headers?.authorization || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization } });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  const ownerResponse = await fetch(`${SUPABASE_URL}/rest/v1/invitation_sites?select=slug&owner_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  return ownerResponse.ok && (await ownerResponse.json()).length > 0;
}

function guidePrompt(type, context) {
  const settings = context.settings || {};
  const prompts = settings.prompts || {};
  const header = `${prompts.base || ""}
모바일 청첩장의 하객 안내 문구를 작성하세요.
예식장명: ${context.venue || ""}
홀 정보: ${context.hall || ""}
주소: ${context.address || ""}
공식홈페이지 URL: ${context.officialUrl || ""}
예식일시: ${context.date || ""}`;
  if (type === "transportGuide") {
    return `${header}
${prompts.transport || ""}
요구사항:
- 아래 5가지 교통수단 중 이 예식장에 실제로 해당하는 것만 2~3개를 선택하세요: "셔틀버스", "버스", "지하철", "도보", "자가용"
- 각 항목의 title은 반드시 위 5가지 중 하나와 정확히 같은 값으로 작성하세요.
- 각 항목의 text는 줄바꿈으로 구분된 2줄을 기본으로 작성하고, 안내가 더 필요하면 최대 4줄까지 줄을 추가하세요. 이모지나 아이콘은 넣지 마세요(화면에 자동으로 표시됩니다).
- 문장은 "~해 주세요", "~입니다" 같은 서술형 대신, 명사형으로 짧게 끝내세요. 예: "10~20분 간격 왕복(무료)", "정문 앞 하차", "도보 5분"
- 이동 경로는 "→"(편도) 또는 "↔"(구간/왕복) 기호로 짧게 표시하세요. 예: "OO역 1번 출구 → 도보 5분", "OO역↔예식장 정류장"
- 각 줄은 18자 안팎으로 작성하고, 정보량이 많은 경우에만 26자까지 허용하세요.
- "셔틀버스": 1번째 줄은 운행 간격(예: "10~20분 간격 왕복"), 2번째 줄은 탑승/하차 위치(예: "정문 앞 하차")
- "지하철": 1번째 줄은 가장 가까운 기차역/지하철역 이름과 하차(예: "OO역 하차"), 2번째 줄은 그 역에서 예식장까지 이동 방법 — 도보 20분 이내면 "도보 N분", 도보 20분을 넘으면 "버스, 택시 이용하여 예식장으로 이동"
- "버스": 1번째 줄은 기차역/지하철역↔예식장 인근 정류장 노선(예: "OO역↔OO호텔 정류장"), 2번째 줄은 그 노선에서 이용 가능한 버스 번호(예: "버스 100, 200, 305 이용"). 도보 20분 이내에 별도 버스정류장이 있으면 정류장 이름과 도보 이동 시간으로 적어도 됩니다.
- "도보": 1번째 줄은 출발 기준점 → 예식장 경로, 2번째 줄은 도보 소요시간
- "자가용": 1번째 줄은 주차장 위치와 이용 가능 구역(예: "지하주차장 지하 1~3층 이용 가능"), 2번째 줄은 주차 무료 시간 또는 정산 방식(예: "주차 3시간 무료")
- 정확한 역/정류장명, 버스 번호, 소요시간을 확실히 알 수 없으면 "확인 필요"라고 적으세요.
- 한국어로 작성하고 과장된 홍보 문구는 쓰지 마세요.`;
  }
  return `${header}
${prompts.venue || ""}
현재 안내사항: ${JSON.stringify(context.notices || [])}
요구사항:
- 항목은 2~3개만 작성하세요.
- 기본 안내사항은 연회장 위치, 주차장 위치, 주차비 정산 방식을 우선 포함하세요.
- 예식장 자체 주차장 외 야외/외부 주차장이 있을 수 있으므로, 확인이 필요한 내용은 "확인 필요"라고 적으세요.
- 본문은 줄글 한 덩어리가 아니라 2~3줄로 나누세요.
- 각 줄은 28자 안팎의 짧은 안내문으로 작성하세요.
- 제목은 "연회장 안내", "주차 안내", "주차 정산"처럼 목적이 바로 보이게 작성하세요.
- 위치나 조건은 괄호를 활용해 짧게 보충하세요. 예: 외부 주차장(확인 필요)
- 한 문장에 연회장, 주차장, 정산 방식을 모두 섞지 말고 항목을 분리하세요.
- 공식홈페이지 URL이 있으면 공식 안내 기준으로 작성하되, 내용을 직접 확인할 수 없으면 확인 필요라고 적으세요.
- 모르는 사실은 지어내지 말고 "확인 후 안내 예정"처럼 안전하게 작성하세요.
- 문장은 짧고 정중하게 작성하세요.`;
}

async function callOpenAI(prompt, responseSchema) {
  const openai = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      input: prompt,
      text: { format: { type: "json_schema", name: "wedding_guide_result", strict: true, schema: responseSchema } },
    }),
  });
  const payload = await openai.json();
  if (!openai.ok) {
    const error = new Error(payload.error?.message || "OpenAI API 호출에 실패했습니다.");
    error.retryable = openai.status === 429 || openai.status === 503 || /high demand|overloaded|rate|quota/i.test(error.message);
    throw error;
  }
  return JSON.parse(outputText(payload));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callOpenAIWithRetry(prompt, responseSchema) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await callOpenAI(prompt, responseSchema);
    } catch (error) {
      lastError = error;
      if (!error.retryable) throw error;
      await sleep(500 + attempt * 900);
    }
  }
  throw new Error(`OpenAI가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요. ${lastError?.message || ""}`.trim());
}

function isGeminiBusy(payload = {}) {
  const message = payload.error?.message || "";
  return /high demand|overloaded|quota|rate|429|503/i.test(message);
}

async function callGeminiModel(model, prompt, responseSchema) {
  const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: responseSchema },
    }),
  });
  const payload = await gemini.json();
  if (!gemini.ok) {
    const error = new Error(payload.error?.message || "Gemini API 호출에 실패했습니다.");
    error.retryable = gemini.status === 429 || gemini.status === 503 || isGeminiBusy(payload);
    throw error;
  }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
  if (!text) throw new Error("Gemini 응답 본문이 없습니다.");
  return JSON.parse(text);
}

async function callGemini(prompt, responseSchema) {
  const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const models = [...new Set([primary, "gemini-2.0-flash"])];
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await callGeminiModel(model, prompt, responseSchema);
      } catch (error) {
        lastError = error;
        if (!error.retryable) throw error;
        await sleep(450 + attempt * 700);
      }
    }
  }
  throw new Error(`Gemini가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요. ${lastError?.message || ""}`.trim());
}

// Claude(Anthropic) 구조화 출력은 minItems/maxItems 등 일부 JSON 스키마 제약을 지원하지 않으므로 제거한다.
function stripUnsupportedSchema(schema) {
  if (Array.isArray(schema)) return schema.map(stripUnsupportedSchema);
  if (schema && typeof schema === "object") {
    const unsupported = new Set(["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "multipleOf"]);
    const result = {};
    for (const [key, value] of Object.entries(schema)) {
      if (unsupported.has(key)) continue;
      result[key] = stripUnsupportedSchema(value);
    }
    return result;
  }
  return schema;
}

function claudeText(payload) {
  if (payload.stop_reason === "refusal") throw new Error(payload.stop_details?.explanation || "요청이 거절되었습니다.");
  for (const block of payload.content || []) {
    if (block.type === "text" && block.text) return block.text;
  }
  throw new Error("Claude 응답 본문이 없습니다.");
}

function isClaudeBusy(status, message = "") {
  return status === 429 || status === 503 || status === 529 || status >= 500 || /overloaded|high demand|rate|temporarily/i.test(message);
}

async function callClaudeModel(prompt, responseSchema) {
  const claude = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: stripUnsupportedSchema(responseSchema) } },
    }),
  });
  const payload = await claude.json();
  if (!claude.ok) {
    const error = new Error(payload.error?.message || "Claude API 호출에 실패했습니다.");
    error.retryable = isClaudeBusy(claude.status, error.message);
    throw error;
  }
  return JSON.parse(claudeText(payload));
}

async function callClaude(prompt, responseSchema) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await callClaudeModel(prompt, responseSchema);
    } catch (error) {
      lastError = error;
      if (!error.retryable) throw error;
      await sleep(450 + attempt * 700);
    }
  }
  throw new Error(`Claude가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요. ${lastError?.message || ""}`.trim());
}

const isClaudeProvider = (provider) => provider === "Claude" || provider === "Anthropic";

function providerConfig(provider) {
  if (isClaudeProvider(provider)) {
    return { configured: Boolean(ANTHROPIC_API_KEY), error: ANTHROPIC_API_KEY ? "" : "ANTHROPIC_API_KEY 환경변수를 등록해 주세요." };
  }
  if (provider === "Gemini") {
    return { configured: Boolean(GEMINI_API_KEY), error: GEMINI_API_KEY ? "" : "GEMINI_API_KEY 환경변수를 등록해 주세요." };
  }
  const ready = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  return { configured: ready, error: ready ? "" : "OPENAI_API_KEY와 OPENAI_MODEL 환경변수를 등록해 주세요." };
}

module.exports = async function aiDesign(request, response) {
  const corsAllowed = applyCors(request, response);
  if (request.method === "OPTIONS") return response.status(corsAllowed ? 204 : 403).end();
  if (!corsAllowed) return response.status(403).json({ error: "허용되지 않은 Origin입니다." });
  if (!await registeredOwner(request)) return response.status(401).json({ error: "일반관리자 로그인 후 이용해 주세요." });

  const provider = request.method === "POST" ? request.body?.provider || "Claude" : request.query?.provider || "Claude";
  if (request.method === "GET") {
    const { configured, error } = providerConfig(provider);
    return response.status(configured ? 200 : 503).json({ configured, provider, error });
  }
  if (request.method !== "POST") return response.status(405).json({ error: "지원하지 않는 요청입니다." });

  const { type = "", context = {} } = request.body || {};
  const responseSchema = schemaFor(type);
  if (!responseSchema) return response.status(400).json({ error: "지원하지 않는 AI 요청입니다." });
  const { configured, error: configError } = providerConfig(provider);
  if (!configured) return response.status(503).json({ error: configError });

  try {
    const prompt = guidePrompt(type, context);
    const result = isClaudeProvider(provider)
      ? await callClaude(prompt, responseSchema)
      : provider === "Gemini"
        ? await callGemini(prompt, responseSchema)
        : await callOpenAIWithRetry(prompt, responseSchema);
    const payload = { ...result, createdAt: new Date().toISOString() };
    if (process.env.AI_DEBUG_PROMPT === "true") payload.prompt = prompt;
    return response.status(200).json(payload);
  } catch (error) {
    return response.status(500).json({ error: error.message || "AI 응답 처리에 실패했습니다." });
  }
};
