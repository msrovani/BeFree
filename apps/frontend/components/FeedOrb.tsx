import { motion } from 'framer-motion';
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
  return `0 0 25px rgba(102, 233, 255, ${intensity})`;
}

export function FeedOrb({ pulse }: FeedOrbProps) {
  const rotation = `rotate(${pulse.angle}deg) translate(${pulse.radius}px) rotate(-${pulse.angle}deg)`;
  const auraColor = ROLE_COLORS[pulse.authorRole];
  const orbSize = 120 + Math.round(pulse.energy * 60);
  const highlightClass = pulse.aiAssisted ? 'feed-orb__body ai-assisted' : 'feed-orb__body';

  return (
    <motion.article
      className="feed-orb"
      style={{ transform: rotation }}
      animate={{ rotate: [0, 3, -3, 0] }}
      transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut', delay: pulse.energy }}
    >
      <motion.div
        className={highlightClass}
        style={{
          background: `linear-gradient(180deg, ${auraColor} 0%, rgba(9, 9, 11, 0.82) 100%)`,
          boxShadow: reputationToShadow(pulse.reputation),
          width: orbSize,
          height: orbSize,
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 6 + pulse.energy * 6, ease: 'easeInOut' }}
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
      </motion.div>
    </motion.article>
  );
}
