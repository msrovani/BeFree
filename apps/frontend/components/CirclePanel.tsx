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
        <p>Sincronização P2P com provas de confiança e aura compartilhada</p>
      </header>
      <ul>
        {circles.map((circle) => {
          const trustPercent = Math.round(circle.trustLevel * 100);
          return (
            <li key={circle.id}>
              <div className="circle-panel__avatar" aria-hidden>
                <span className={`circle-panel__lock ${circle.isEncrypted ? 'circle-panel__lock--closed' : ''}`}>
                  {circle.isEncrypted ? '🔒' : '🌐'}
                </span>
              </div>
              <div className="circle-panel__body">
                <strong>{circle.title}</strong>
                <span className="circle-panel__vibe">{circle.vibe}</span>
                <div className="circle-panel__meta">
                  <span>{trustPercent}% confiança</span>
                  <span>{circle.members} membrxs</span>
                  <span>{circle.isEncrypted ? 'cifrado' : 'aberto'}</span>
                </div>
                <div
                  className="circle-panel__meter"
                  role="meter"
                  aria-valuenow={trustPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${trustPercent}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
