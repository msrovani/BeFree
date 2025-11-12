'use client';

import React from 'react';

import { useJarbasPresence } from '../hooks/useJarbasPresence';
import { useJarbasSensory } from '../hooks/useJarbasSensory';
import { usePersonalizationPreferences } from '../hooks/usePersonalization';
import { useSensoryBridge } from '../hooks/useSensoryBridge';
import type { JarbasInsight, JarbasPersonaSnapshot } from '../lib/demoData';
import type { JarbasPresence } from '../hooks/useJarbasPresence';
import type { JarbasMemoryState } from '../../../sdk/ai/jarbasPersona';

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

const TONE_ICON: Record<JarbasInsight['tone'], string> = {
  calmo: '🌌',
  empolgado: '⚡',
  alerta: '🛑',
};

interface JarbasPanelProps {
  insights: JarbasInsight[];
  persona: JarbasPersonaSnapshot;
  memory: JarbasMemoryState;
  prompt: string;
}

export function JarbasPanel({ insights, persona, memory, prompt }: JarbasPanelProps) {
  const presence = useJarbasPresence(insights);
  const { triggerEventTone } = useJarbasSensory(presence);
  const preferences = usePersonalizationPreferences();
  const sensoryBridge = useSensoryBridge();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    sensoryBridge.register(triggerEventTone);
    return () => {
      sensoryBridge.register(() => {});
    };
  }, [sensoryBridge, triggerEventTone]);

  const describeToggles = `${preferences.soundscape ? 'trilha ativa' : 'trilha desligada'} · ${
    preferences.tts === 'off' ? 'voz em silêncio' : 'voz ' + preferences.tts
  } · ${preferences.haptics ? 'háptica ligada' : 'háptica desligada'}`;

  const modes = React.useMemo(() => Object.keys(persona.advancedModes), [persona.advancedModes]);

  const handleCopyPrompt = React.useCallback(async () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      triggerEventTone('insight');
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Falha ao copiar prompt do Jarbas', error);
      setCopied(false);
    }
  }, [prompt, triggerEventTone]);

  return (
    <section className="jarbas">
      <header className="jarbas__header">
        <div className="jarbas__identity">
          <div className={`jarbas__avatar jarbas__avatar--${presence.mood}`} aria-hidden>
            <span
              className="jarbas__avatarAura"
              style={{ '--jarbas-activity': presence.activityLevel.toString() } as React.CSSProperties}
            />
            <span className="jarbas__avatarGlyph">🧠</span>
          </div>
          <div>
            <h2>{persona.name}</h2>
            <p>
              {persona.tagline} · {MOOD_LABEL[presence.mood]}
            </p>
          </div>
        </div>
        <div className="jarbas__status">
          <span className="jarbas__statusLabel">{STATUS_LABEL[presence.status]}</span>
          <span className="jarbas__activity">energia {Math.round(presence.activityLevel * 100)}%</span>
        </div>
      </header>
      <div className="jarbas__persona">
        <p className="jarbas__mission">{persona.mission}</p>
        <ul className="jarbas__traits" aria-label="Traços do Jarbas">
          {persona.traits.map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
        <div className="jarbas__commitments">
          <div>
            <strong>NUNCA</strong>
            <p>{persona.commitments.never.slice(0, 2).join(' · ')}</p>
          </div>
          <div>
            <strong>SEMPRE</strong>
            <p>{persona.commitments.always.slice(0, 2).join(' · ')}</p>
          </div>
        </div>
        <div className="jarbas__memory">
          <span>
            <strong>Contexto:</strong> {memory.context}
          </span>
          <span>
            <strong>Evolução:</strong> {memory.evolution}
          </span>
          <span>
            <strong>Preferências:</strong> {memory.preferences}
          </span>
        </div>
        <div className="jarbas__modes" aria-label="Modos avançados">
          {modes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
        <button type="button" className="jarbas__prompt" onClick={handleCopyPrompt}>
          {copied ? 'Prompt da persona copiado!' : 'Copiar prompt operacional'}
        </button>
      </div>
      <p className="jarbas__mantra">
        “A liberdade começa quando você fala — e é ouvido.” Compartilhe um pulse ou deixe que eu guie os próximos passos.
        <br />
        <span className="jarbas__prefs" aria-live="polite">
          {describeToggles}
        </span>
      </p>
      <ul className="jarbas__insights">
        {presence.insights.map((insight) => (
          <li key={insight.id} className={`jarbas__insight jarbas__insight--${insight.tone}`}>
            <div className="jarbas__insightIcon" aria-hidden>
              {TONE_ICON[insight.tone]}
            </div>
            <div className="jarbas__insightCopy">
              <h3>{insight.title}</h3>
              <p>{insight.detail}</p>
            </div>
            {insight.action && (
              <button
                type="button"
                className="jarbas__insightAction"
                onClick={() => triggerEventTone('insight')}
              >
                {insight.action}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
