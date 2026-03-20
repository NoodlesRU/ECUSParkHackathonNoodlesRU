// server.js
import express from "express";
import cors from "cors";
import { pipeline } from "@xenova/transformers";
import { buildSmartHighlights } from "./smarterHighlight.js"; // make sure this file exists

const app = express();
app.use(cors());
app.use(express.json());

let generator;
let modelInUse = null;
// Hard cap keeps local inference responsive for long pasted articles.
const MAX_ANALYZE_CHARS = Number(process.env.MAX_ANALYZE_CHARS || 6000);

const MODEL_CANDIDATES = [
  process.env.LOCAL_MODEL_ID,
  "Xenova/TinyLlama-1.1B-Chat-v1.0",
  "Xenova/gpt2"
].filter(Boolean);

// Try preferred model first, then fall back to lighter alternatives.
async function loadGeneratorWithFallback() {
  for (const modelId of MODEL_CANDIDATES) {
    try {
      console.log(`Loading local model: ${modelId}`);
      const loaded = await pipeline("text-generation", modelId);
      generator = loaded;
      modelInUse = modelId;
      console.log(`Local AI ready with model: ${modelId}`);
      return;
    } catch (err) {
      console.warn(`Failed to load model ${modelId}: ${err.message}`);
    }
  }

  throw new Error("Unable to load any local model candidate.");
}

// Normalize list-like outputs from either arrays or newline text.
function cleanBullets(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }

  return String(value)
    .split("\n")
    .map(l => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
}

// Filter out prompt-template lines if the model echoes instructions.
function isInstructionPlaceholder(item) {
  const text = String(item || "").trim().toLowerCase();
  if (!text) return true;

  return (
    /items?\s+per\s+array/.test(text) ||
    /short\s+bullet/.test(text) ||
    /no\s+markdown/.test(text) ||
    /no\s+extra\s+keys?/.test(text) ||
    /return\s+only\s+valid\s+json/.test(text)
  );
}

// Final cleanup pass for model list items before returning to UI.
function sanitizeModelBullets(items) {
  return cleanBullets(items)
    .map(item => item.replace(/^\*+\s*/, "").trim())
    .filter(item => item.length > 3)
    .filter(item => !isInstructionPlaceholder(item));
}

// Pull the first JSON object out of model output that may include extra text.
function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// Fallback section parser for non-JSON outputs (e.g., "Summary:" blocks).
function extractSection(text, names) {
  if (!text) return [];

  for (const name of names) {
    const pattern = new RegExp(`${name}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Za-z ]{2,}:|$)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      const items = cleanBullets(match[1]);
      if (items.length) return items;
    }
  }

  return [];
}

// Heuristic signals used when model structure is missing or noisy.
function heuristicCredibilitySignals(text) {
  if (!text) return [];
  const signals = [];

  if (/\baccording to\b/i.test(text)) signals.push("Attribution language appears (e.g., 'according to').");
  if (/\bsaid\b|\btold\b|\bspoke with\b/i.test(text)) signals.push("Named or quoted sources are referenced.");
  if (/\breport\b|\bbiography\b|\bTimes\b|\bjournalist\b|\bhistorian\b/i.test(text)) {
    signals.push("External reporting or expert background is mentioned.");
  }
  if (/\b\d{4}\b/.test(text)) signals.push("A specific year/date is present, which is verifiable.");
  if (/"[^"]+"/.test(text)) signals.push("Direct quotations are included and can be source-checked.");

  return [...new Set(signals)].slice(0, 5);
}

// Heuristic verification targets for claims likely to need fact checking.
function heuristicVerifyItems(text) {
  if (!text) return [];
  const sentenceLike = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const flagged = sentenceLike.filter(s =>
    /alleg|report|claimed|said|revealed|rape|abuse|shattered|first|one of the first/i.test(s)
  );

  return flagged.slice(0, 5);
}

// Shared sentence splitter used by heuristic summary/claim extraction.
function splitSentences(text) {
  if (!text) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Pick representative high-signal sentences as a backup summary.
function heuristicSummary(text) {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];

  const ranked = [...sentences].sort((a, b) => {
    const score = s => {
      let n = 0;
      if (/\b(according to|said|reported|revealed|alleg|claims?)\b/i.test(s)) n += 2;
      if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s)) n += 1;
      if (/\b\d{4}\b/.test(s)) n += 1;
      return n;
    };
    return score(b) - score(a);
  });

  const chosen = [];
  for (const sentence of ranked) {
    if (!chosen.includes(sentence)) chosen.push(sentence);
    if (chosen.length === 3) break;
  }

  return chosen;
}

// Extract likely factual claims as a fallback when model claims are empty.
function heuristicKeyClaims(text) {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];

  const claimy = sentences.filter(s =>
    /\b(alleg|claimed|said|revealed|reported|was|is|did|represents?|included?)\b/i.test(s)
  );

  const source = claimy.length ? claimy : sentences;
  return [...new Set(source)].slice(0, 4);
}

// Assign a human-readable reason to each highlighted phrase.
function inferHighlightReason(phrase, verifyItems = [], signals = []) {
  const value = String(phrase || "").trim();
  const lower = value.toLowerCase();

  if (!value) return "Potentially important claim to review.";

  const appearsInVerifyList = verifyItems.some(item => String(item || "").toLowerCase().includes(lower));
  if (appearsInVerifyList || /\b(verify|unclear|alleg|claimed|reported|revealed|said|told)\b/i.test(value)) {
    return "Contains a claim or uncertainty that should be independently verified.";
  }

  if (/\b(blockbuster|shattered|hagiography|outrage|disaster|massive|stunning)\b/i.test(value)) {
    return "Uses emotionally loaded language that may introduce bias.";
  }

  if (/\b(officials|sources|according to|one of the officials)\b/i.test(value)) {
    return "Relies on attribution that may be vague or not fully sourced.";
  }

  if (/\b\d{4}\b|\b\d+\b|\b(first|second|third|week|month|year)\b/i.test(value)) {
    return "Contains specific factual details that can be fact-checked.";
  }

  const mentionsCredibilitySignal = signals.some(item => {
    const itemLower = String(item || "").toLowerCase();
    return itemLower.includes("source") || itemLower.includes("report") || itemLower.includes("quotation");
  });
  if (mentionsCredibilitySignal) {
    return "Highlights source-related language worth checking for evidence and context.";
  }

  return "Potentially important claim to review for evidence and context.";
}

// Trim long submissions at sentence boundaries so output stays coherent.
function capAnalyzedText(inputText, maxChars) {
  const safeText = String(inputText || "");
  if (safeText.length <= maxChars) {
    return {
      analyzedText: safeText,
      truncated: false,
      stopIndex: safeText.length,
      totalChars: safeText.length,
      stopPreview: ""
    };
  }

  const candidate = safeText.slice(0, maxChars);
  const sentenceBreak = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("? "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("\n")
  );

  const stopIndex = sentenceBreak > Math.floor(maxChars * 0.6) ? sentenceBreak + 1 : maxChars;
  const analyzedText = safeText.slice(0, stopIndex).trimEnd();
  const stopPreview = analyzedText.slice(Math.max(0, analyzedText.length - 160));

  return {
    analyzedText,
    truncated: true,
    stopIndex,
    totalChars: safeText.length,
    stopPreview
  };
}

function deriveBiasLevel(text, flags = []) {
  const safeFlags = Array.isArray(flags) ? flags : [];
  if (!safeFlags.length) {
    return { level: "low", flaggedCount: 0, severeCount: 0 };
  }

  const severeCount = safeFlags.filter(flag =>
    /emotionally loaded|unsupported|uncertainty|vague|bias/i.test(String(flag?.reason || ""))
  ).length;
  const flaggedCount = safeFlags.length;

  if (severeCount >= 2 || flaggedCount >= 6) {
    return { level: "high", flaggedCount, severeCount };
  }
  if (severeCount >= 1 || flaggedCount >= 3) {
    return { level: "medium", flaggedCount, severeCount };
  }
  return { level: "low", flaggedCount, severeCount };
}

// Score credibility using simple, explainable heuristics.
function computeCredibilityScore({
  signals = [],
  verifyItems = [],
  keyClaims = [],
  text = "",
  highlights = [],
  biasLevel = "low"
}) {
  const safeSignals = Array.isArray(signals) ? signals : [];
  const safeVerifyItems = Array.isArray(verifyItems) ? verifyItems : [];
  const safeKeyClaims = Array.isArray(keyClaims) ? keyClaims : [];
  const safeHighlights = Array.isArray(highlights) ? highlights : [];

  const lowerText = String(text || "").toLowerCase();
  const uncertaintyCategories = [
    { name: "allegation", pattern: /\balleg(ed|ation|ations)?\b/ },
    { name: "claim", pattern: /\bclaims?\b/ },
    { name: "reportedly", pattern: /\breportedly\b/ },
    { name: "unclear", pattern: /\bunclear\b/ },
    { name: "attribution", pattern: /\baccording to\b/ },
    { name: "anonymous-source", pattern: /\b(sources?|officials?)\b/ }
  ];
  const matchedUncertaintyCategories = uncertaintyCategories.filter(item => item.pattern.test(lowerText));

  const severeHighlightCount = safeHighlights.filter(flag =>
    /emotionally loaded|unsupported|uncertainty|vague|bias/i.test(String(flag?.reason || ""))
  ).length;
  const regularHighlightCount = Math.max(0, safeHighlights.length - severeHighlightCount);

  // New formula: start neutral and move score up/down with evidence quality.
  const baseline = 50;
  const evidenceBoost = Math.min(32, safeKeyClaims.length * 8) + Math.min(30, safeSignals.length * 6);
  const verificationPenalty = Math.min(45, safeVerifyItems.length * 9);
  const highlightPenalty = Math.min(24, severeHighlightCount * 4 + regularHighlightCount * 2);
  const uncertaintyPenalty = Math.min(12, matchedUncertaintyCategories.length * 2);
  const biasPenalty = biasLevel === "high" ? 8 : biasLevel === "medium" ? 4 : 0;
  const sparseEvidencePenalty = safeKeyClaims.length + safeSignals.length <= 2 ? 12 : 0;

  const rawScore =
    baseline +
    evidenceBoost -
    verificationPenalty -
    highlightPenalty -
    uncertaintyPenalty -
    biasPenalty -
    sparseEvidencePenalty;

  const biasCap = biasLevel === "high" ? 59 : biasLevel === "medium" ? 79 : 100;
  const score = Math.max(0, Math.min(biasCap, Math.min(100, rawScore)));

  let level = "high";
  if (score < 50) level = "low";
  else if (score < 80) level = "medium";

  return {
    score,
    level,
    max: 100,
    factors: {
      baseline,
      signals: safeSignals.length,
      verifyItems: safeVerifyItems.length,
      keyClaims: safeKeyClaims.length,
      evidenceBoost,
      verificationPenalty,
      highlightPenalty,
      uncertaintyPenalty,
      biasPenalty,
      sparseEvidencePenalty,
      severeHighlightCount,
      biasCap
    }
  };
}

// Load local model when server starts
(async () => {
  try {
    await loadGeneratorWithFallback();
  } catch (err) {
    console.error("Model initialization failed:", err.message);
  }
})();

// Helper to build highlight flags
function buildHighlightFlags(text, phrases) {
  if (!text || !Array.isArray(phrases)) return [];
  const flags = [];
  for (const item of phrases) {
    let start = text.indexOf(item.phrase);
    if (start === -1) start = text.toLowerCase().indexOf(item.phrase.toLowerCase());
    if (start !== -1)
      flags.push({ start, end: start + item.phrase.length, reason: item.reason || "AI flagged" });
  }
  return flags;
}

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/model", (_req, res) => {
  res.json({
    loaded: Boolean(generator),
    model: modelInUse,
    candidates: MODEL_CANDIDATES
  });
});

// Analyze endpoint
app.post("/api/analyze", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });
  if (!generator) return res.status(503).json({ error: "AI model is still loading" });

  try {
    // Use the capped text for model inference; response includes truncation metadata.
    const capped = capAnalyzedText(text, MAX_ANALYZE_CHARS);
    const analysisText = capped.analyzedText;

    // Ask for strict JSON first; fall back to heuristics if model output is noisy.
    const prompt = `
Return ONLY valid JSON with this exact shape:
{
  "summary": ["..."],
  "keyClaims": ["..."],
  "credibilitySignals": ["..."],
  "thingsToVerify": ["..."],
  "highlightedText": ["..."]
}

Rules:
- 2-4 items per array
- short bullet-style strings
- no markdown
- no extra keys

Article:
"""${analysisText}"""
`;

    // Generate text
    const result = await generator(prompt, { max_new_tokens: 220, temperature: 0.3 });
    const aiText = result?.[0]?.generated_text || "";
    // Some models echo the prompt before the answer; remove that prefix.
    const continuation = aiText.startsWith(prompt) ? aiText.slice(prompt.length).trim() : aiText;

    // Prefer strict JSON parse, then section parsing, then regex-based heuristics.
    const parsed = extractJsonObject(continuation);

    const summaryFromModel = sanitizeModelBullets(parsed?.summary).length
      ? sanitizeModelBullets(parsed?.summary)
      : extractSection(continuation, ["Summary"]);

    const keyClaimsFromModel = sanitizeModelBullets(parsed?.keyClaims).length
      ? sanitizeModelBullets(parsed?.keyClaims)
      : extractSection(continuation, ["Key Claims", "Claims"]);

    const signalsFromModel = sanitizeModelBullets(parsed?.credibilitySignals);
    const signals = signalsFromModel.length
      ? signalsFromModel
      : heuristicCredibilitySignals(analysisText);

    const verifyItems = sanitizeModelBullets(parsed?.thingsToVerify).length
      ? sanitizeModelBullets(parsed?.thingsToVerify)
      : extractSection(continuation, ["Things to Verify", "Verify", "Needs Verification"]);

    const fallbackVerify = sanitizeModelBullets(verifyItems).length
      ? sanitizeModelBullets(verifyItems)
      : heuristicVerifyItems(analysisText);
    const fallbackSummary = sanitizeModelBullets(summaryFromModel).length
      ? sanitizeModelBullets(summaryFromModel)
      : heuristicSummary(analysisText);
    const fallbackKeyClaims = sanitizeModelBullets(keyClaimsFromModel).length
      ? sanitizeModelBullets(keyClaimsFromModel)
      : heuristicKeyClaims(analysisText);

    const highlightedPhrasesRaw = sanitizeModelBullets(parsed?.highlightedText).length
      ? sanitizeModelBullets(parsed?.highlightedText)
      : extractSection(continuation, ["Highlighted Text", "Highlights"]);

    const highlightedPhrasesSeed = highlightedPhrasesRaw.length
      ? highlightedPhrasesRaw
      : [...fallbackVerify, ...fallbackKeyClaims].slice(0, 8);

    const highlightedPhrases = highlightedPhrasesSeed
      .map(phrase => ({
        phrase,
        reason: inferHighlightReason(phrase, fallbackVerify, signals)
      }))
      .filter(p => p.phrase);

    // Build sentence-level flags used by the frontend highlighter component.
    const highlightedText = {
      text: analysisText,
      flags: buildSmartHighlights(analysisText, highlightedPhrases)
    };

    const warnings = [];
    if (capped.truncated) {
      warnings.push(
        `Analysis was limited to the first ${capped.stopIndex} of ${capped.totalChars} characters to keep local model processing stable. Stopped near: "${capped.stopPreview}"`
      );
    }

    const biasStats = deriveBiasLevel(highlightedText.text, highlightedText.flags);

    const credibility = computeCredibilityScore({
      signals,
      verifyItems: fallbackVerify,
      keyClaims: fallbackKeyClaims,
      text: analysisText,
      highlights: highlightedText.flags,
      biasLevel: biasStats.level
    });

    res.json({
      summary: fallbackSummary.length ? fallbackSummary : ["Model output could not be fully structured. Review source text directly."],
      keyClaims: fallbackKeyClaims,
      signals,
      verifyItems: fallbackVerify,
      credibility,
      biasLevel: biasStats.level,
      highlightedText,
      warnings,
      analysisLimit: {
        truncated: capped.truncated,
        maxChars: MAX_ANALYZE_CHARS,
        stopIndex: capped.stopIndex,
        totalChars: capped.totalChars
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Local AI failed", message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));