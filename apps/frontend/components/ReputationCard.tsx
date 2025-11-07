import React from 'react';

import { useReputationMetrics } from '../hooks/useReputation';
import { participants } from '../lib/demoData';

export function ReputationCard() {
  const metrics = useReputationMetrics();

  return (
    <section className="reputation-card">
      <header>
        <h2>Vibração de reputação</h2>
        <p>
          Média <strong>{metrics.average}</strong> · Pico <strong>{metrics.peak}</strong> · Piso{' '}
          <strong>{metrics.floor}</strong>
        </p>
      </header>
      <ul>
        {participants.map((participant) => (
          <li key={participant.id}>
            <span className="reputation-card__avatar" style={{ background: participant.auraColor }} />
            <div>
              <strong>{participant.displayName}</strong>
              <span>{participant.highlight}</span>
              <span className="reputation-card__meta">
                {participant.reputation} rep · {participant.earnedBFR} BFR · sequência {participant.streak}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
