import React from 'react';

import { ActionDock } from '../components/ActionDock';
import { CirclePanel } from '../components/CirclePanel';
import { JarbasPanel } from '../components/JarbasPanel';
import { RadialFeed } from '../components/RadialFeed';
import { ReputationCard } from '../components/ReputationCard';
import { TopBar } from '../components/TopBar';
import type { Pulse, PulseRole } from '../lib/demoData';
import { loadCommunitySnapshot } from '../lib/liveCommunity';

const ROLE_METADATA: Record<PulseRole, { label: string; description: string; color: string }> = {
  guardian: { label: 'Guardião', description: 'Cuidado coletivo', color: 'var(--pulse-guardian)' },
  artesao: { label: 'Artesão', description: 'Criação e arte viva', color: 'var(--pulse-artesao)' },
  oraculo: { label: 'Oráculo', description: 'Análise e visão', color: 'var(--pulse-oraculo)' },
  explorador: { label: 'Explorador', description: 'Rede e expansão', color: 'var(--pulse-explorador)' },
};

function EnergyLegend({ pulses }: { pulses: Pulse[] }) {
  const distribution = Object.keys(ROLE_METADATA).reduce(
    (acc, role) => ({
      ...acc,
      [role]: { count: 0, energy: 0 },
    }),
    {} as Record<PulseRole, { count: number; energy: number }>
  );

  pulses.forEach((pulse) => {
    const bucket = distribution[pulse.authorRole];
    bucket.count += 1;
    bucket.energy += pulse.energy;
  });

  return (
    <dl className="energy-legend">
      {(Object.entries(ROLE_METADATA) as Array<[PulseRole, { label: string; description: string; color: string }]>)
        .map(([role, meta]) => {
          const bucket = distribution[role];
          const averageEnergy = bucket.count === 0 ? 0 : bucket.energy / bucket.count;
          return (
            <div key={role}>
              <dt>{meta.label}</dt>
              <dd style={{ background: meta.color }}>
                {meta.description} · {bucket.count} pulsos · energia {(averageEnergy * 100).toFixed(0)}%
              </dd>
            </div>
          );
        })}
    </dl>
  );
}

export default async function HomePage() {
  const community = await loadCommunitySnapshot();

  return (
    <main className="shell">
      <TopBar summary={community.summary} />
      <div className="layout">
        <div className="layout__feed">
          <RadialFeed pulses={community.pulses} />
          <EnergyLegend pulses={community.pulses} />
          <ActionDock />
        </div>
        <aside className="layout__sidebar">
          <JarbasPanel insights={community.insights} />
          <ReputationCard participants={community.participants} />
          <CirclePanel circles={community.circles} />
        </aside>
      </div>
    </main>
  );
}
