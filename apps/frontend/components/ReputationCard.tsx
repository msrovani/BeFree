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
          Média <strong>{metrics.average}</strong> · Pico <strong>{metrics.peak}</strong> · Piso <strong>{metrics.floor}</strong>
        </p>
        <span className="reputation-card__subtitle">Energia coletiva BFR · atualiza em tempo real</span>
      </header>
      <ul>
        {participants.map((participant) => {
          const earned = participant.earnedBFR.toFixed(2);
          return (
            <li key={participant.id}>
              <span className="reputation-card__avatar" style={{ background: participant.auraColor }} aria-hidden />
              <div className="reputation-card__body">
                <div className="reputation-card__header">
                  <strong>{participant.displayName}</strong>
                  <span className="reputation-card__highlight">{participant.highlight}</span>
                </div>
                <div className="reputation-card__stats">
                  <span className="reputation-card__rep">{participant.reputation} rep</span>
                  <span>{earned} BFR</span>
                  <span>{participant.streak}× sequência</span>
                </div>
                <div className="reputation-card__trail" role="meter" aria-valuenow={participant.reputation} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${Math.min(participant.reputation, 100)}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
