// smarterHighlight.js
export function buildSmartHighlights(text, phrases) {
  if (!text || !Array.isArray(phrases)) return [];

  // Normalize text before comparison to make matching punctuation/case tolerant.
  const normalize = value =>
    String(value || "")
      .toLowerCase()
      .replace(/\.\.\./g, " ")
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Token overlap allows fuzzy sentence-level matching for paraphrased model output.
  const hasTokenOverlap = (a, b) => {
    const aTokens = normalize(a).split(" ").filter(t => t.length > 3);
    const bTokens = new Set(normalize(b).split(" ").filter(t => t.length > 3));
    if (!aTokens.length || !bTokens.size) return false;

    let overlap = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) overlap += 1;
    }

    const ratio = overlap / Math.min(aTokens.length, bTokens.size);
    return ratio >= 0.55;
  };

  const flags = [];
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text]; // split into sentences
  let searchFrom = 0;

  for (const sentence of sentences) {
    const sentenceNorm = normalize(sentence);
    const start = text.indexOf(sentence, searchFrom);
    if (start === -1) continue;
    const end = start + sentence.length;
    searchFrom = end;

    let matchedReason = null;

    for (const item of phrases) {
      if (!item?.phrase) continue;

      const phraseNorm = normalize(item.phrase);
      // Direct string match first, then fuzzy token overlap as fallback.
      const directMatch = sentenceNorm.includes(phraseNorm) || phraseNorm.includes(sentenceNorm);
      const fuzzyMatch = !directMatch && hasTokenOverlap(sentence, item.phrase);

      if (directMatch || fuzzyMatch) {
        matchedReason = item.reason || "Needs verification";
        break;
      }
    }

    if (matchedReason) {
      const duplicate = flags.some(f => f.start === start && f.end === end);
      if (!duplicate) {
        flags.push({ start, end, reason: matchedReason });
      }
    }
  }

  return flags;
}