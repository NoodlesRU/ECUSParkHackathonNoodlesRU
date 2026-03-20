import React from "react";
import "../styles/components.css";

export default function HighlightText({ text, highlights }) {
  if (!highlights || highlights.length === 0) return <p>{text}</p>;

  // Build alternating plain-text and highlighted spans from index ranges.
  const parts = [];
  let lastIndex = 0;

  highlights.forEach((hl, index) => {
    const { start, end } = hl;
    // Append untouched text before each highlighted segment.
    if (lastIndex < start) parts.push(text.slice(lastIndex, start));
    parts.push(
      <span key={index} className="highlight" title={hl.reason}>
        {text.slice(start, end)}
      </span>
    );
    lastIndex = end;
  });

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <p>{parts}</p>;
}