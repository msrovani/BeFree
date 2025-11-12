'use client';

import React, { useMemo, useState } from 'react';

import type { LiveCommunityData } from '../lib/demoData';
import { PersonalizationProvider } from '../hooks/usePersonalization';
import { ActionDock } from './ActionDock';
import { CirclePanel } from './CirclePanel';
import { JarbasPanel } from './JarbasPanel';
import { PersonalizationPanel } from './PersonalizationPanel';
import { RadialFeed } from './RadialFeed';
import { ReputationCard } from './ReputationCard';
import { TopBar } from './TopBar';
import { SensoryBridgeProvider, useSensoryBridge } from '../hooks/useSensoryBridge';

interface ExperienceShellProps {
  community: LiveCommunityData;
}

export function ExperienceShell({ community }: ExperienceShellProps) {
  return (
    <PersonalizationProvider>
      <SensoryBridgeProvider>
        <ExperienceContent community={community} />
      </SensoryBridgeProvider>
    </PersonalizationProvider>
  );
}

function ExperienceContent({ community }: ExperienceShellProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const pulses = useMemo(() => community.pulses, [community.pulses]);
  const sensory = useSensoryBridge();

  return (
    <main className="shell">
      <TopBar summary={community.summary} onOpenPreferences={() => setPreferencesOpen(true)} />
      <div className="layout">
        <div className="layout__feed">
          <RadialFeed pulses={pulses} />
          <EnergyLegend pulses={pulses} />
          <ActionDock
            onOpenPreferences={() => setPreferencesOpen(true)}
            onPulse={() => sensory.trigger('acao')}
          />
        </div>
        <aside className="layout__sidebar">
          <JarbasPanel
            insights={community.insights}
            persona={community.persona}
            memory={community.jarbasMemory}
            prompt={community.personaPrompt}
          />
          <ReputationCard participants={community.participants} />
          <CirclePanel circles={community.circles} />
        </aside>
      </div>
      <PersonalizationPanel
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        onPreviewTone={(event) => sensory.trigger(event)}
      />
    </main>
  );
}

const ROLE_METADATA: Record<
  LiveCommunityData['pulses'][number]['authorRole'],
  { label: string; description: string; color: string; icon: string }
> = {
  guardian: {
    label: 'Guardião',
    description: 'Cuidado coletivo',
    color: 'var(--pulse-guardian)',
    icon: '🛡️',
  },
  artesao: {
    label: 'Artesão',
    description: 'Criação viva',
    color: 'var(--pulse-artesao)',
    icon: '🎨',
  },
  oraculo: {
    label: 'Oráculo',
    description: 'Visão analítica',
    color: 'var(--pulse-oraculo)',
    icon: '🔭',
  },
  explorador: {
    label: 'Explorador',
    description: 'Rede e expansão',
    color: 'var(--pulse-explorador)',
    icon: '🛰️',
  },
};

function EnergyLegend({ pulses }: { pulses: LiveCommunityData['pulses'] }) {
  const distribution = Object.keys(ROLE_METADATA).reduce(
    (acc, role) => ({
      ...acc,
      [role]: { count: 0, energy: 0 },
    }),
    {} as Record<LiveCommunityData['pulses'][number]['authorRole'], { count: number; energy: number }>
  );

  pulses.forEach((pulse) => {
    const bucket = distribution[pulse.authorRole];
    bucket.count += 1;
    bucket.energy += pulse.energy;
  });

  return (
    <dl className="energy-legend">
      {(Object.entries(ROLE_METADATA) as Array<[
        LiveCommunityData['pulses'][number]['authorRole'],
        { label: string; description: string; color: string; icon: string }
      ]>).map(([role, meta]) => {
        const bucket = distribution[role];
        const averageEnergy = bucket.count === 0 ? 0 : bucket.energy / Math.max(bucket.count, 1);
        return (
          <div key={role} className="energy-legend__item">
            <span className="energy-legend__icon" style={{ background: meta.color }} aria-hidden>
              {meta.icon}
            </span>
            <div className="energy-legend__copy">
              <dt>{meta.label}</dt>
              <dd>
                <span>{meta.description}</span>
                <span>{bucket.count} pulsos</span>
                <span>energia {(averageEnergy * 100).toFixed(0)}%</span>
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
