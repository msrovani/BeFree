import React from 'react';

import { useJarbasPresence } from '../hooks/useJarbasPresence';

const MOOD_LABEL: Record<ReturnType<typeof useJarbasPresence>['mood'], string> = {
  sereno: 'Sereno',
  vibrante: 'Vibrante',
  alerta: 'Alerta',
};

const STATUS_LABEL: Record<ReturnType<typeof useJarbasPresence>['status'], string> = {
  escutando: 'Escutando',
  respondendo: 'Respondendo',
  ocioso: 'Ocioso',
};

export function JarbasPanel() {
  const presence = useJarbasPresence();

  return (
    <section className="jarbas">
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
        {presence.insights.map((insight) => (
          <li key={insight.id} className={`jarbas__insight jarbas__insight--${insight.tone}`}>
            <h3>{insight.title}</h3>
            <p>{insight.detail}</p>
            {insight.action && <button type="button">{insight.action}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
