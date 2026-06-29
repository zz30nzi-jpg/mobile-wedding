const API_URL = "https://api.openai.com/v1/responses";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_MODEL = normalizeAnthropicModel(process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-haiku-4-5");
const ANTHROPIC_WEB_SEARCH_ENABLED = process.env.ANTHROPIC_WEB_SEARCH !== "false";
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
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string", enum: ["자가용", "버스", "지하철"] },
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
  const research = String(context.research || "").trim();
  const researchError = String(context.researchError || "").trim();
  const researchBlock = research
    ? `
조사된 참고정보:
${research}

위 참고정보를 우선 사용하세요. 참고정보에 없는 노선명, 버스 번호, 셔틀 시간, 주차 조건은 추측하지 말고 "확인 필요"로 남기세요.`
    : researchError
      ? `
조사 상태: ${researchError}
실제 노선명, 버스 번호, 셔틀 시간, 주차 조건을 단정하지 말고 확인 필요로 남기세요.`
      : "";
  const header = `${prompts.base || ""}
모바일 청첩장의 하객 안내 문구를 작성하세요.
예식장명: ${context.venue || ""}
홀 정보: ${context.hall || ""}
주소: ${context.address || ""}
공식홈페이지 URL: ${context.officialUrl || ""}
예식일시: ${context.date || ""}${researchBlock}`;
  if (type === "transportGuide") {
    return `${header}
${prompts.transport || ""}
요구사항:
- 항목은 반드시 3개를 생성하고 title은 이 순서와 정확히 같은 값으로 작성하세요: "자가용", "버스", "지하철"
- 각 항목의 text는 줄바꿈으로 구분된 2줄을 기본으로 작성하고, 안내가 더 필요하면 최대 4줄까지 줄을 추가하세요. 이모지나 아이콘은 넣지 마세요(화면에 자동으로 표시됩니다).
- 문장은 하객이 바로 이해할 수 있게 짧고 정중한 안내형으로 작성하세요. 명사형 단편만 나열하지 마세요.
- "자가용": 식장의 주차장 여부, 주차장 위치, 식장 내 주차장이 없거나 부족한 경우 별도/외부 주차장 여부를 작성하세요. 식장 공식홈페이지 또는 공식 안내 페이지 정보를 최우선으로 사용하고, 없으면 확인 필요로 남기세요.
- 먼저 식장 기준 도보 20분 이내에 버스정류장과 지하철역이 각각 있는지 판정하세요. 이 판정이 버스/지하철 안내의 기준입니다.
- 도보 20분 이내 버스정류장이 있고 지하철역은 없으면, "버스"에는 해당 정류장 이름과 정류장에서 식장까지 도보 N분을 적으세요. "지하철"에는 도보 20분을 넘는 인근 지하철역 이름, 그 역에서 위 버스정류장 또는 식장까지 타고 올 수 있는 버스 번호/타는 정류장, 지하철역에서 식장까지 택시 약 N분을 적으세요.
- 도보 20분 이내 지하철역이 있고 버스정류장은 없으면, "지하철"에는 해당 지하철역 호선/역명과 역에서 식장까지 도보 N분을 적으세요. "버스"에는 도보 20분을 넘는 인근 버스정류장 이름, 그 정류장에서 위 지하철역 또는 식장까지 타고 올 수 있는 버스 번호/타는 정류장, 정류장에서 식장까지 택시 약 N분을 적으세요.
- 도보 20분 이내 버스정류장과 지하철역이 모두 있으면, "버스"에는 해당 정류장 이름과 정류장에서 식장까지 도보 N분을 적고, "지하철"에는 해당 지하철역 호선/역명과 역에서 식장까지 도보 N분만 적으세요.
- 버스/지하철의 도보 20분 판단은 지도/공식 접근 안내/검색 결과에 근거하세요. 근거가 없으면 도보 가능하다고 단정하지 말고 확인 필요로 표시하세요.
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

function normalizeAnthropicModel(model = "") {
  const normalized = String(model || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^~+/, "")
    .trim();
  return normalized || "claude-haiku-4-5";
}

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

function parseJsonText(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("Claude 응답 본문이 없습니다.");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function claudeResult(payload) {
  if (payload.stop_reason === "refusal") throw new Error(payload.stop_details?.explanation || "요청이 거절되었습니다.");
  const textBlocks = [];
  for (const block of payload.content || []) {
    if (block.type === "tool_use" && block.name === "write_wedding_guide" && block.input) return block.input;
    if (block.type === "text" && block.text) textBlocks.push(block.text);
  }
  return parseJsonText(textBlocks.join("\n"));
}

function isClaudeBusy(status, message = "") {
  return status === 429 || status === 503 || status === 529 || status >= 500 || /overloaded|high demand|rate|temporarily/i.test(message);
}

function researchPrompt(type, context) {
  const target = `${context.venue || ""} ${context.hall || ""} ${context.address || ""}`.replace(/\s+/g, " ").trim();
  const official = context.officialUrl ? `\n공식홈페이지: ${context.officialUrl}` : "";
  const common = `다음 예식장의 하객 안내문 작성을 위한 사실 정보만 조사하세요.
예식장: ${target || "이름/주소 없음"}${official}

규칙:
- 검색 결과에서 확인한 정보와 확인하지 못한 정보를 분리하세요.
- 출처 페이지 이름이나 URL을 함께 적으세요.
- 확실하지 않은 내용은 추측하지 말고 "확인 필요"라고 적으세요.
- 한국어로 간결하게 정리하세요.`;
  if (type === "transportGuide") {
    return `${common}

필요한 정보:
- 식장 공식홈페이지 또는 공식 안내 페이지의 주차장 여부, 주차장 위치, 별도/외부 주차장 정보
- 식장 기준 도보 20분 이내 버스정류장 존재 여부, 정류장명, 도보 소요시간
- 식장 기준 도보 20분 이내 지하철역 존재 여부, 호선/역명, 도보 소요시간
- 도보 20분 이내 버스정류장만 있으면, 인근 지하철역에서 해당 정류장 또는 식장까지 오는 버스 번호/타는 정류장과 택시 소요시간
- 도보 20분 이내 지하철역만 있으면, 인근 버스정류장에서 해당 역 또는 식장까지 오는 버스 번호/타는 정류장과 택시 소요시간
- 두 가지 모두 도보 20분 이내이면, 각각의 이름과 도보 소요시간`;
  }
  return `${common}

필요한 정보:
- 연회장/피로연장 위치
- 주차장 위치
- 무료 주차 시간, 주차권, 차량번호 등록 등 정산 방식`;
}

function shouldResearch(type, context = {}) {
  if (!ANTHROPIC_WEB_SEARCH_ENABLED) return false;
  if (!["transportGuide", "venueGuide"].includes(type)) return false;
  return Boolean(context.venue || context.address || context.officialUrl);
}

async function callClaudeResearch(type, context) {
  if (!shouldResearch(type, context)) return { ...context };
  const claude = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: researchPrompt(type, context) }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: type === "transportGuide" ? 6 : 4 }],
    }),
  });
  const payload = await claude.json();
  if (!claude.ok) {
    const error = new Error(payload.error?.message || "Claude 검색 호출에 실패했습니다.");
    error.retryable = isClaudeBusy(claude.status, error.message);
    throw error;
  }
  const research = (payload.content || [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text.trim())
    .join("\n\n")
    .trim();
  return research ? { ...context, research } : { ...context, researchError: "검색 결과를 확인하지 못했습니다." };
}

async function callClaudeModel(prompt, responseSchema) {
  const claude = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      tools: [{
        name: "write_wedding_guide",
        description: "Return the wedding guest guide as structured JSON.",
        input_schema: stripUnsupportedSchema(responseSchema),
      }],
      tool_choice: { type: "tool", name: "write_wedding_guide" },
    }),
  });
  const payload = await claude.json();
  if (!claude.ok) {
    const error = new Error(payload.error?.message || "Claude API 호출에 실패했습니다.");
    error.retryable = isClaudeBusy(claude.status, error.message);
    throw error;
  }
  return claudeResult(payload);
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
    let promptContext = context;
    if (isClaudeProvider(provider)) {
      try {
        promptContext = await callClaudeResearch(type, context);
      } catch (researchError) {
        promptContext = { ...context, researchError: `실시간 검색 실패 - ${researchError.message || "검색 결과 없음"}` };
      }
    }
    const prompt = guidePrompt(type, promptContext);
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
