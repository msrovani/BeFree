import React from 'react';

import type { PositionedPulse } from '../hooks/usePulseLayout';

const ROLE_COLORS: Record<PositionedPulse['authorRole'], string> = {
  guardian: 'var(--pulse-guardian)',
  artesao: 'var(--pulse-artesao)',
  oraculo: 'var(--pulse-oraculo)',
  explorador: 'var(--pulse-explorador)',
};

const SENTIMENT_LABEL: Record<PositionedPulse['sentiment'], string> = {
  positivo: 'Fluxo acolhedor',
  neutro: 'Ressonância neutra',
  alerta: 'Sinal de cuidado',
};

const SENTIMENT_ICON: Record<PositionedPulse['sentiment'], string> = {
  positivo: '🌱',
  neutro: '🔄',
  alerta: '⚠️',
};

interface FeedOrbProps {
  pulse: PositionedPulse;
}

export function FeedOrb({ pulse }: FeedOrbProps) {
  const rotation = `rotate(${pulse.angle}deg) translate(${pulse.radius}px) rotate(-${pulse.angle}deg)`;
  const orbSize = 140 + Math.round(pulse.energy * 80);
  const auraColor = ROLE_COLORS[pulse.authorRole];
  const energyPercent = Math.round(pulse.energy * 100);
  const reputationBadge = pulse.reputation >= 80 ? 'alta' : pulse.reputation >= 50 ? 'estável' : 'em ascensão';

  return (
    <article
      className={`feed-orb feed-orb--${pulse.sentiment}`}
      style={{ transform: rotation }}
      data-role={pulse.authorRole}
      data-origin={pulse.origin}
      data-sentiment={pulse.sentiment}
    >
      <div className="feed-orb__aura" style={{ '--orb-color': auraColor } as React.CSSProperties} aria-hidden />
      <div
        className={`feed-orb__body ${pulse.aiAssisted ? 'feed-orb__body--ai' : ''}`}
        style={{ '--orb-color': auraColor, '--orb-size': `${orbSize}px` } as React.CSSProperties}
      >
        <header className="feed-orb__header">
          <span className="feed-orb__sentiment" title={SENTIMENT_LABEL[pulse.sentiment]} aria-hidden>
            {SENTIMENT_ICON[pulse.sentiment]}
          </span>
          <div className="feed-orb__author">
            <strong>{pulse.author}</strong>
            <span>{pulse.tags.join(' · ')}</span>
          </div>
          <time dateTime={pulse.capturedAt}>{new Date(pulse.capturedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
        </header>
        <p className="feed-orb__summary">{pulse.summary}</p>
        <footer className="feed-orb__footer">
          <span className="badge">rep {pulse.reputation} · {reputationBadge}</span>
          <span className="badge">energia {energyPercent}%</span>
          {pulse.aiAssisted && <span className="badge ai">assistido por Jarbas</span>}
          {pulse.sourceDid && <span className="badge source">DID {pulse.sourceDid.slice(-6)}</span>}
        </footer>
      </div>
    </article>
  );
}
