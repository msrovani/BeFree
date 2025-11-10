import React from 'react';

import { ActionDock } from '../components/ActionDock';
import { CirclePanel } from '../components/CirclePanel';
import { JarbasPanel } from '../components/JarbasPanel';
import { RadialFeed } from '../components/RadialFeed';
import { ReputationCard } from '../components/ReputationCard';
import { TopBar } from '../components/TopBar';

function EnergyLegend() {
  return (
    <dl className="energy-legend">
      <div>
        <dt>Guardian</dt>
        <dd style={{ background: 'var(--pulse-guardian)' }}>Cuidado coletivo</dd>
      </div>
      <div>
        <dt>Artesão</dt>
        <dd style={{ background: 'var(--pulse-artesao)' }}>Criação e arte viva</dd>
      </div>
      <div>
        <dt>Oráculo</dt>
        <dd style={{ background: 'var(--pulse-oraculo)' }}>Análise e visão</dd>
      </div>
      <div>
        <dt>Explorador</dt>
        <dd style={{ background: 'var(--pulse-explorador)' }}>Rede e expansão</dd>
      </div>
    </dl>
  );
}

export default function HomePage() {
  return (
    <main className="shell">
      <TopBar />
      <div className="layout">
        <div className="layout__feed">
          <RadialFeed />
          <EnergyLegend />
          <ActionDock />
        </div>
        <aside className="layout__sidebar">
          <JarbasPanel />
          <ReputationCard />
          <CirclePanel />
        </aside>
      </div>
    </main>
  );
}
