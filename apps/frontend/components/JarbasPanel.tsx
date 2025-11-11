'use client';

import React from 'react';

import { useJarbasPresence } from '../hooks/useJarbasPresence';
import type { JarbasInsight } from '../lib/demoData';
import type { JarbasPresence } from '../hooks/useJarbasPresence';

const MOOD_LABEL: Record<JarbasPresence['mood'], string> = {
  sereno: 'Sereno',
  vibrante: 'Vibrante',
  alerta: 'Alerta',
};

const STATUS_LABEL: Record<JarbasPresence['status'], string> = {
  escutando: 'Escutando',
  respondendo: 'Respondendo',
  ocioso: 'Ocioso',
};

const MOOD_HALO: Record<JarbasPresence['mood'], string> = {
  sereno: 'rgba(56, 189, 248, 0.45)',
  vibrante: 'rgba(139, 92, 246, 0.6)',
  alerta: 'rgba(251, 191, 36, 0.45)',
};

interface JarbasPanelProps {
  insights: JarbasInsight[];
}

export function JarbasPanel({ insights }: JarbasPanelProps) {
  const presence = useJarbasPresence(insights);

  return (
    <section className="jarbas">
      <span className="jarbas__aura" style={{ boxShadow: `0 0 70px ${MOOD_HALO[presence.mood]}` }} />
      <header className="jarbas__header">
        <div>
          <h2>JARBAS</h2>
          <p>
            IA pessoal sincronizada. Status: <strong>{STATUS_LABEL[presence.status]}</strong>
          </p>
        </div>
        <div className="jarbas__mood">
          <span className="pulse" style={{ '--pulse-activity': presence.activityLevel.toString() } as React.CSSProperties} />
          <span>{MOOD_LABEL[presence.mood]}</span>
        </div>
      </header>
      <ul className="jarbas__insights">
        {presence.insights.map((insight, index) => (
          <li
            key={insight.id}
            className={`jarbas__insight jarbas__insight--${insight.tone}`}
            style={{ '--insight-delay': `${index * 0.08}s` } as React.CSSProperties}
          >
            <h3>{insight.title}</h3>
            <p>{insight.detail}</p>
            {insight.action && <button type="button">{insight.action}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
