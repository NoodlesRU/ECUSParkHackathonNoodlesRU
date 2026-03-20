import React, { useState } from "react";
import Header from "./components/Header";
import ClipboardReader from "./components/ClipboardReader";
import AnalyzeButton from "./components/AnalyzeButton";
import Spinner from "./components/Spinner";
import ResultCard from "./components/ResultCard";
import { analyzeArticle } from "./services/api";

export default function App() {
  const [text, setText] = useState("");
  // Tracks whether clipboard import was used so UI can show button state.
  const [usedClipboardButton, setUsedClipboardButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Sends current text to backend and stores the structured response.
  const handleAnalyze = async () => {
    if (!text) return;
    setLoading(true);
    const response = await analyzeArticle(text);
    setResult(response);
    setLoading(false);
  };

  const handleClearResults = () => {
    // Reset both input and analysis state for a fresh run.
    setResult(null);
    setText("");
    setUsedClipboardButton(false);
  };

  return (
    <div className="app-container">
      <Header />
      <div className="action-buttons">
        <ClipboardReader
          setText={setText}
          clipboardUsed={usedClipboardButton}
          onClipboardSuccess={() => setUsedClipboardButton(true)}
        />
        <AnalyzeButton onClick={handleAnalyze} />
        <button onClick={handleClearResults} disabled={loading || !result}>
          Clear Results
        </button>
      </div>
      {loading && <Spinner />}
      {result && <ResultCard result={result} />}
    </div>
  );
}