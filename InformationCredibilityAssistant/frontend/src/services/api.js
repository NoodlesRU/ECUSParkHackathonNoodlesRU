export async function analyzeArticle(text) {
  if (!text) return null;

  // Normalized response shape keeps UI rendering predictable on failures.
  const fallback = message => ({
    error: message,
    summary: [message],
    keyClaims: [],
    signals: [],
    verifyItems: [],
    highlightedText: { text, flags: [] },
  });

  try {
    // Frontend uses Vite proxy, so /api/analyze maps to backend during dev.
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      // If JSON parse fails, include plain-text body when available for debugging.
      const rawBody = await response.text().catch(() => "");
      const baseMessage = response.ok
        ? "Received an invalid response from the backend"
        : `Backend request failed (${response.status})`;
      return fallback(rawBody || baseMessage);
    }

    if (!response.ok) {
      // Backend-provided error takes precedence over generic HTTP fallback.
      const message = data?.error || `Backend request failed (${response.status})`;
      return fallback(message);
    }

    return data;
  } catch (err) {
    console.error("API error:", err);

    const message =
      err instanceof TypeError
        ? "Cannot reach backend API. Make sure backend is running on http://localhost:5000"
        : err.message || "Error analyzing text";

    return fallback(message);
  }
}