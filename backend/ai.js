const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash"
];
const RETRYABLE_PATTERNS = [
  /high demand/i,
  /try again later/i,
  /temporar/i,
  /overloaded/i,
  /unavailable/i,
  /resource exhausted/i,
  /rate limit/i,
  /quota/i
];

export async function generateSalesSummary({
  fileName,
  analysis,
  comparisonAnalysis,
  summaryStyle,
  explainInsights
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = buildPrompt({
    fileName,
    analysis,
    comparisonAnalysis,
    summaryStyle,
    explainInsights
  });
  const models = buildModelList(process.env.GEMINI_MODEL);
  const errors = [];

  for (const model of models) {
    try {
      return await requestWithRetry({ model, prompt });
    } catch (error) {
      errors.push(`${model}: ${error.message}`);

      if (!isRetryableMessage(error.message)) {
        throw error;
      }
    }
  }

  throw new Error(
    `Gemini is temporarily unavailable across fallback models. ${errors.join(" | ")}`
  );
}

function buildPrompt({
  fileName,
  analysis,
  comparisonAnalysis,
  summaryStyle,
  explainInsights
}) {
  const stylePrompts = {
    executive:
      "Write for a VP or founder. Make it direct, high-signal, and decision-oriented.",
    strategic:
      "Write for senior leadership. Emphasise strategy, competitive implications, and next-quarter moves.",
    marketing:
      "Write for a marketing leader. Focus on demand pockets, product momentum, and customer concentration.",
    operational:
      "Write for an operations leader. Focus on execution quality, exceptions, and process actions."
  };

  return [
    "You are an analyst creating a detailed business report from structured sales analytics.",
    "Return plain text only.",
    stylePrompts[summaryStyle] || stylePrompts.executive,
    "Use this exact structure with clear labels:",
    "Title:",
    "Report Style:",
    "Dataset Overview:",
    "Executive Narrative:",
    "Key Metrics:",
    "Growth Trend:",
    "Regional Performance:",
    "Product Performance:",
    "Operational Risks:",
    "Dataset Warning:",
    "Report Confidence:",
    "Estimated AI Cost:",
    "Recommended Actions:",
    explainInsights
      ? "Explainability: Add a 'Why this matters:' line after each major section."
      : "Explainability: Do not add reasoning callouts.",
    "Be concrete. Use the analytics provided below instead of inventing figures.",
    `Dataset file name: ${fileName}`,
    `Primary dataset analytics: ${JSON.stringify(analysis)}`,
    comparisonAnalysis
      ? `Comparison analytics: ${JSON.stringify(comparisonAnalysis)}`
      : "Comparison analytics: none"
  ].join("\n");
}

function buildModelList(preferredModel) {
  return [...new Set([preferredModel || "gemini-2.5-flash", ...FALLBACK_MODELS])];
}

async function requestWithRetry({ model, prompt }) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestSummary({ model, prompt });
    } catch (error) {
      lastError = error;

      if (!isRetryableMessage(error.message) || attempt === 3) {
        throw error;
      }

      await sleep(attempt * 1500);
    }
  }

  throw lastError || new Error("Gemini request failed");
}

async function requestSummary({ model, prompt }) {
  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 900
        }
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const apiMessage = payload?.error?.message || "Gemini request failed";
    throw new Error(apiMessage);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty summary");
  }

  return text;
}

function isRetryableMessage(message) {
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message || ""));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
