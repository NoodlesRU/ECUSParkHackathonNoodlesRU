import React from 'react';

export default function TextInput({ value, onChange, placeholder, disabled }) {
  return (
    <div className="text-input-container">
      <textarea
        className="text-input"
        value={value}
        // Lift textarea state up to parent so analysis controls stay centralized.
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Paste article text or URL here..."}
        disabled={disabled}
        rows={8}
      />
    </div>
  );
}
