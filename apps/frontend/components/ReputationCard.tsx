'use client';

import React from 'react';

import { useReputationMetrics } from '../hooks/useReputation';
import type { ParticipantProfile } from '../lib/demoData';

interface ReputationCardProps {
  participants: ParticipantProfile[];
}

export function ReputationCard({ participants }: ReputationCardProps) {
  const metrics = useReputationMetrics(participants);

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
        {participants.map((participant) => {
          const ratio = metrics.peak === 0 ? 0 : participant.reputation / metrics.peak;
          return (
            <li key={participant.id}>
              <span className="reputation-card__avatar" style={{ background: participant.auraColor }}>
                <span className="reputation-card__spark" aria-hidden />
              </span>
              <div>
                <strong>{participant.displayName}</strong>
                <span>{participant.highlight}</span>
                <div className="reputation-card__bar" role="presentation">
                  <span style={{ width: `${Math.min(100, Math.max(8, ratio * 100))}%` }} />
                </div>
                <span className="reputation-card__meta">
                  {participant.reputation} rep · {participant.earnedBFR.toFixed(2)} BFR · sequência {participant.streak}
                </span>
              </div>
              <span className="reputation-card__score" aria-label="Pontuação energética">
                +{Math.round(participant.reputation * 0.42)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
