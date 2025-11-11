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
        <p>Sincronização P2P com provas de confiança</p>
      </header>
      <ul>
        {circles.map((circle) => (
          <li key={circle.id}>
            <div>
              <strong>{circle.title}</strong>
              <span>{circle.vibe}</span>
            </div>
            <div className="circle-panel__meta">
              <span>{Math.round(circle.trustLevel * 100)}% confiança</span>
              <span>{circle.members} membrxs</span>
              <span>{circle.isEncrypted ? '🔐 cifrado' : '🌀 aberto'}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
