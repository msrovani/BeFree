import React from 'react';

import type { CircleSnapshot } from '../lib/demoData';

interface CirclePanelProps {
  circles: CircleSnapshot[];
}

export function CirclePanel({ circles }: CirclePanelProps) {
  return (
    <section className="circle-panel">
      <header>
        <h2>Círculos ativos</h2>
        <p>Sincronização P2P com provas de confiança e criptografia adaptativa</p>
      </header>
      <ul>
        {circles.map((circle) => (
          <li key={circle.id}>
            <div className="circle-panel__header">
              <div>
                <strong>{circle.title}</strong>
                <span>{circle.vibe}</span>
              </div>
              <span className="circle-panel__shield" aria-label="Estado de privacidade">
                {circle.isEncrypted ? '🔐' : '🌀'}
              </span>
            </div>
            <div className="circle-panel__meta">
              <span>{Math.round(circle.trustLevel * 100)}% confiança</span>
              <span>{circle.members} membrxs</span>
            </div>
            <div className="circle-panel__trust">
              <span style={{ width: `${Math.min(100, Math.max(10, circle.trustLevel * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
