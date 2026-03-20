import React from "react";
import "../styles/components.css";

export default function Spinner() {
  // Visible while backend inference is running.
  return <div className="spinner">Analyzing...</div>;
}