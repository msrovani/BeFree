import React from 'react';

import type { PositionedPulse } from '../hooks/usePulseLayout';

const ROLE_COLORS: Record<PositionedPulse['authorRole'], string> = {
  guardian: 'var(--pulse-guardian)',
  artesao: 'var(--pulse-artesao)',
  oraculo: 'var(--pulse-oraculo)',
  explorador: 'var(--pulse-explorador)',
};

const SENTIMENT_ICONS: Record<PositionedPulse['sentiment'], string> = {
  positivo: '🌱',
  neutro: '🔄',
  alerta: '⚠️',
};

interface FeedOrbProps {
  pulse: PositionedPulse;
}

function reputationToShadow(score: number) {
  const intensity = Math.min(0.45 + score / 200, 0.85);
  return `0 0 28px rgba(56, 189, 248, ${intensity})`;
}

export function FeedOrb({ pulse }: FeedOrbProps) {
  const rotation = `rotate(${pulse.angle}deg) translate(${pulse.radius}px) rotate(-${pulse.angle}deg)`;
  const auraColor = ROLE_COLORS[pulse.authorRole];
  const orbSize = 120 + Math.round(pulse.energy * 60);
  const highlightClass = pulse.aiAssisted ? 'feed-orb__body ai-assisted' : 'feed-orb__body';
  const animationDelay = `${(pulse.radius % 5) * 0.3}s`;

  return (
    <article
      className="feed-orb"
      style={{ transform: rotation, '--orb-delay': animationDelay } as React.CSSProperties}
    >
      <div
        className={highlightClass}
        style={{
          background: `linear-gradient(180deg, ${auraColor} 0%, rgba(11, 21, 35, 0.75) 100%)`,
          boxShadow: reputationToShadow(pulse.reputation),
          width: orbSize,
          height: orbSize,
        }}
      >
        <header className="feed-orb__header">
          <span className="feed-orb__role" aria-hidden>
            {SENTIMENT_ICONS[pulse.sentiment]}
          </span>
          <div>
            <strong>{pulse.author}</strong>
            <span>{pulse.tags.join(' · ')}</span>
          </div>
        </header>
        <p className="feed-orb__summary">{pulse.summary}</p>
        <footer className="feed-orb__footer">
          <span className="badge">Rep {pulse.reputation}</span>
          <span className="badge">Energia {(pulse.energy * 100).toFixed(0)}%</span>
          {pulse.aiAssisted && <span className="badge ai">assistido por Jarbas</span>}
        </footer>
      </div>
    </article>
  );
}
