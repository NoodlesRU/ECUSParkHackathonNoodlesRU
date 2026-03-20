import React from "react";
import HighlightText from "./HighlightText";

export default function ResultCard({ result }) {
  // Destructure all display sections from the backend response.
  const { summary, keyClaims, signals, verifyItems, highlightedText, warnings = [], analysisLimit } = result;
  const highlights = highlightedText.flags || [];

  return (
    <div className="result-card">
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