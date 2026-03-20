import React from "react";

export default function ClipboardReader({
  setText,
  clipboardUsed,
  onClipboardSuccess,
}) {
  // Reads plain text from browser clipboard and injects it into the app input.
  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if(!text) {
        alert("Clipboard is empty. Please copy some text first.");
        return;
      }
      setText(text);
      onClipboardSuccess();
    } catch (err) {
      alert("Failed to read clipboard. Please copy text first.");
      console.error(err);
    }
  };

  return (
    <div className="clipboard-reader">
      <button
        className={clipboardUsed ? "clipboard-btn-active" : ""}
        onClick={readClipboard}
      >
        Use Copied Text
      </button>
    </div>
  );
}