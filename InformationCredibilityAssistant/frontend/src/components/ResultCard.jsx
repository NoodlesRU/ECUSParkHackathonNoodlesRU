import React from "react";
import HighlightText from "./HighlightText";
import BiasIndicator from "./BiasIndicator";

export default function ResultCard({ result }) {
  // Destructure all display sections from the backend response.
  const {
    summary,
    keyClaims,
    signals,
    verifyItems,
    highlightedText,
    warnings = [],
    analysisLimit,
    credibility,
    biasLevel: providedBiasLevel,
  } = result;
  const highlights = highlightedText.flags || [];

  const getBiasLevel = () => {
    if (typeof providedBiasLevel === "string" && providedBiasLevel.trim()) {
      return providedBiasLevel;
    }

    if (!highlights.length) return "low";

    const severeCount = highlights.filter(flag =>
      /emotionally loaded|unsupported|uncertainty|vague|bias/i.test(String(flag?.reason || ""))
    ).length;

    if (severeCount >= 2 || highlights.length >= 6) return "high";
    if (severeCount >= 1 || highlights.length >= 3) return "medium";
    return "low";
  };

  const biasLevel = getBiasLevel();
  const biasCapForFallback =
    biasLevel === "high"
      ? 59
      : biasLevel === "medium"
        ? 79
        : 100;

  const derivedCredibility = (() => {
    const baseline = 50;
    const evidenceBoost = Math.min(32, keyClaims.length * 8) + Math.min(30, signals.length * 6);
    const verificationPenalty = Math.min(45, verifyItems.length * 9);
    const sparseEvidencePenalty = keyClaims.length + signals.length <= 2 ? 12 : 0;
    const score = baseline + evidenceBoost - verificationPenalty - sparseEvidencePenalty;
    const clamped = Math.max(0, Math.min(biasCapForFallback, Math.min(100, score)));
    if (clamped < 50) {
      return {
        score: clamped,
        level: "low",
        max: 100,
        factors: { baseline, evidenceBoost, verificationPenalty, sparseEvidencePenalty, biasCap: biasCapForFallback }
      };
    }
    if (clamped < 80) {
      return {
        score: clamped,
        level: "medium",
        max: 100,
        factors: { baseline, evidenceBoost, verificationPenalty, sparseEvidencePenalty, biasCap: biasCapForFallback }
      };
    }
    return {
      score: clamped,
      level: "high",
      max: 100,
      factors: { baseline, evidenceBoost, verificationPenalty, sparseEvidencePenalty, biasCap: biasCapForFallback }
    };
  })();

  const credibilityView = credibility || derivedCredibility;
  const credibilityFactors = credibilityView.factors || {
    baseline: 50,
    signals: signals.length,
    verifyItems: verifyItems.length,
    keyClaims: keyClaims.length,
    evidenceBoost: 0,
    verificationPenalty: 0,
    highlightPenalty: 0,
    uncertaintyPenalty: 0,
    biasPenalty: 0,
    sparseEvidencePenalty: 0,
    biasCap: 100,
  };
  const scoreTooltip = `Score starts at neutral ${credibilityFactors.baseline}. Evidence boost is +8 x key claims (${credibilityFactors.keyClaims}) and +6 x credibility signals (${credibilityFactors.signals}), capped (current boost ${credibilityFactors.evidenceBoost}). Penalties: -9 x items to verify (${credibilityFactors.verifyItems}), highlight risk (${credibilityFactors.highlightPenalty}), uncertainty categories (${credibilityFactors.uncertaintyPenalty}), bias level (${credibilityFactors.biasPenalty}), and sparse evidence (${credibilityFactors.sparseEvidencePenalty}). Bias cap is ${credibilityFactors.biasCap} (high bias max 59, medium bias max 79). Final score is clamped accordingly.`;
  const scoreLevelClass =
    credibilityView.level === "high"
      ? "credibility-high"
      : credibilityView.level === "medium"
        ? "credibility-medium"
        : "credibility-low";

  return (
    <div className="result-card">
      <BiasIndicator level={biasLevel} score={credibilityView.score} />

      <section className={`credibility-card ${scoreLevelClass}`}>
        <h2>
          Credibility Score
          <span className="tooltip-wrap">
            <span
              className="help-icon"
              title="How credibility score is calculated"
              aria-label="How credibility score is calculated"
            >
              ?
            </span>
            <span className="tooltip-panel" role="tooltip">
              {scoreTooltip}
            </span>
          </span>
        </h2>
        <p className="credibility-value">
          {credibilityView.score} / {credibilityView.max || 100}
        </p>
        <p className="credibility-meta">
          Neutral-baseline model: evidence boosts score, risk indicators reduce it.
        </p>
      </section>

      {warnings.length > 0 && (
        <section className="warning-box">
          <h2>Analysis Warning</h2>
          <ul>{warnings.map((item, i) => <li key={i}>{item}</li>)}</ul>
          {analysisLimit?.truncated && (
            <p className="warning-meta">
              Read through character {analysisLimit.stopIndex} of {analysisLimit.totalChars} (limit: {analysisLimit.maxChars}).
            </p>
          )}
        </section>
      )}

      <section>
        <h2>Summary</h2>
        <ul>{summary.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </section>

      <section>
        <h2>Key Claims</h2>
        <ul>{keyClaims.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </section>

      <section>
        <h2>Credibility Signals</h2>
        <ul>{signals.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </section>

      <section>
        <h2>Things to Verify</h2>
        <ul>{verifyItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </section>

      <section>
        <h2>
          Highlighted Text
          {/* Tooltip explains what the highlight system is flagging. */}
          <span
            className="help-icon"
            title="Highlighted words or phrases may contain bias, loaded language, unsupported claims, or details that need verification. Hover over highlighted text for the specific reason."
            aria-label="What is highlighted"
          >
            ?
          </span>
        </h2>
        <HighlightText text={highlightedText.text} highlights={highlights} />
      </section>
    </div>
  );
}