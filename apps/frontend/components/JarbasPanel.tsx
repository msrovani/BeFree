'use client';

import { motion } from 'framer-motion';
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

interface JarbasPanelProps {
  insights: JarbasInsight[];
}

export function JarbasPanel({ insights }: JarbasPanelProps) {
  const presence = useJarbasPresence(insights);

  return (
    <section className="jarbas">
      <header className="jarbas__header">
        <div className="jarbas__identity">
          <div className="jarbas__avatar" aria-hidden>
            <motion.span
              className="jarbas__aura"
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
              style={{ '--jarbas-activity': presence.activityLevel.toString() } as React.CSSProperties}
            />
            <span className="jarbas__glyph">🧠</span>
          </div>
          <div>
            <h2>JARBAS</h2>
            <p>
              IA pessoal sincronizada. Status: <strong>{STATUS_LABEL[presence.status]}</strong>
            </p>
          </div>
        </div>
        <div className="jarbas__mood">
          <span className="pulse" style={{ '--pulse-activity': presence.activityLevel.toString() } as React.CSSProperties} />
          <span>{MOOD_LABEL[presence.mood]}</span>
        </div>
      </header>
      <ul className="jarbas__insights">
        {presence.insights.map((insight) => (
          <li key={insight.id} className={`jarbas__insight jarbas__insight--${insight.tone}`}>
            <h3>{insight.title}</h3>
            <p>{insight.detail}</p>
            {insight.action && (
              <button type="button" className="jarbas__action">
                {insight.action}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
