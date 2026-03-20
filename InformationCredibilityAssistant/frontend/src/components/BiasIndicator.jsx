import React from 'react';

export default function BiasIndicator({ level, score }) {
  // level can be: 'low', 'medium', 'high'
  const getIndicatorStyle = () => {
    if (level?.toLowerCase() === 'low') {
      return { color: '#4CAF50', bgColor: '#E8F5E9' };
    }

    const levelSeverity = level?.toLowerCase() === 'high'
      ? 2
      : level?.toLowerCase() === 'medium'
        ? 1
        : -1;

    const scoreSeverity = Number.isFinite(score)
      ? score < 50
        ? 2
        : score < 80
          ? 1
          : 0
      : -1;

    const severity = Math.max(levelSeverity, scoreSeverity);

    if (severity === 2) return { color: '#F44336', bgColor: '#FFEBEE' };
    if (severity === 1) return { color: '#FF9800', bgColor: '#FFF3E0' };
    if (severity === 0) return { color: '#4CAF50', bgColor: '#E8F5E9' };
    return { color: '#757575', bgColor: '#F5F5F5' };
  };

  const style = getIndicatorStyle();

  return (
    <div className="bias-indicator" style={{ backgroundColor: style.bgColor }}>
      <div className="bias-level">
        <span className="bias-dot" style={{ backgroundColor: style.color }}></span>
        <span className="bias-text" style={{ color: style.color }}>
          Bias Level: <strong>{level || 'Unknown'}</strong>
        </span>
      </div>
      <p className="bias-description">
        {level?.toLowerCase() === 'low' && 'This article appears to maintain neutrality with minimal bias.'}
        {level?.toLowerCase() === 'medium' && 'This article shows some bias. Review source credibility.'}
        {level?.toLowerCase() === 'high' && 'This article contains significant bias. Verify information independently.'}
      </p>
    </div>
  );
}
