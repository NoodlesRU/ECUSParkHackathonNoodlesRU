import React from "react";

export default function AnalyzeButton({ onClick }) {
  return (
    <div className="analyze-button">
      {/* Triggers analysis using the current app input text. */}
      <button onClick={onClick}>Analyze Selection</button>
    </div>
  );
}