import React, { useState } from "react";
import Header from "./components/Header";
import TextInput from "./components/TextInput";
import ClipboardReader from "./components/ClipboardReader";
import AnalyzeButton from "./components/AnalyzeButton";
import Spinner from "./components/Spinner";
import ResultCard from "./components/ResultCard";
import { analyzeArticle } from "./services/api";
import "./styles/components.css";

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
      <div className="workspace-layout">
        <section className="workspace-panel input-panel">
          <div className="panel-header">
            <h2>Original Text</h2>
            <p>Paste content to analyze credibility, bias, and claims.</p>
          </div>

          <TextInput
            value={text}
            onChange={setText}
            disabled={loading}
            placeholder="Paste article text here..."
          />

          <div className="action-buttons">
            <ClipboardReader
              setText={setText}
              clipboardUsed={usedClipboardButton}
              onClipboardSuccess={() => setUsedClipboardButton(true)}
            />
            <AnalyzeButton onClick={handleAnalyze} />
            <button onClick={handleClearResults} disabled={loading || (!result && !text)}>
              Clear
            </button>
          </div>
        </section>

        <section className="workspace-panel analysis-panel">
          <div className="panel-header">
            <h2>Analysis Panel</h2>
            <p>See credibility score, bias level, highlights, and verification targets.</p>
          </div>

          {loading && <Spinner />}
          {!loading && !result && (
            <p className="analysis-empty">Run analysis to view results here.</p>
          )}
          {result && <ResultCard result={result} />}
        </section>
      </div>
    </div>
  );
}