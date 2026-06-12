const API_URL = "https://api.openai.com/v1/responses";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://djjspxgkdinimcpkdxme.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_j3ve_B6RZyZqREX6IdQc3Q_gMXGuNA_";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

const transportSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 2,
      maxItems: 4,
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
- 가장 가까운 기차역/지하철역 기준 경로를 1개 이상 작성하세요.
- 가장 가까운 버스정류장 기준 경로를 1개 이상 작성하세요.
- 차량, 버스, 지하철/기차, 도보 소요시간을 알 수 있는 범위에서 간결히 작성하세요.
- 도보는 20분 이하일 때만 적고, 확실하지 않은 정보는 확인 필요라고 적으세요.
- 한국어로 작성하고 제목과 본문으로 나누세요.`;
  }
  return `${header}
${prompts.venue || ""}
현재 안내사항: ${JSON.stringify(context.notices || [])}
요구사항:
- 주차, 식사/연회, 홀 위치/이동 등 하객에게 필요한 안내를 2~3개로 정리하세요.
- 기본 안내사항은 주차 안내와 식사 안내를 포함하세요.
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

module.exports = async function aiDesign(request, response) {
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Vary", "Origin");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (!await registeredOwner(request)) return response.status(401).json({ error: "일반관리자 로그인 후 이용해 주세요." });

  const provider = request.method === "POST" ? request.body?.provider || "Gemini" : request.query?.provider || "Gemini";
  if (request.method === "GET") {
    const configured = provider === "Gemini" ? Boolean(GEMINI_API_KEY) : Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
    return response.status(configured ? 200 : 503).json({ configured, provider, error: configured ? "" : provider === "Gemini" ? "GEMINI_API_KEY 환경변수를 등록해 주세요." : "OPENAI_API_KEY와 OPENAI_MODEL 환경변수를 등록해 주세요." });
  }
  if (request.method !== "POST") return response.status(405).json({ error: "지원하지 않는 요청입니다." });

  const { type = "", context = {} } = request.body || {};
  const responseSchema = schemaFor(type);
  if (!responseSchema) return response.status(400).json({ error: "지원하지 않는 AI 요청입니다." });
  if (provider === "Gemini" && !GEMINI_API_KEY) return response.status(503).json({ error: "GEMINI_API_KEY 환경변수를 등록해 주세요." });
  if (provider !== "Gemini" && !process.env.OPENAI_API_KEY) return response.status(503).json({ error: "OPENAI_API_KEY 환경변수를 등록해 주세요." });
  if (provider !== "Gemini" && !process.env.OPENAI_MODEL) return response.status(503).json({ error: "OPENAI_MODEL 환경변수를 등록해 주세요." });

  try {
    const prompt = guidePrompt(type, context);
    const result = provider === "Gemini" ? await callGemini(prompt, responseSchema) : await callOpenAIWithRetry(prompt, responseSchema);
    return response.status(200).json({ ...result, prompt, createdAt: new Date().toISOString() });
  } catch (error) {
    return response.status(500).json({ error: error.message || "AI 응답 처리에 실패했습니다." });
  }
};
