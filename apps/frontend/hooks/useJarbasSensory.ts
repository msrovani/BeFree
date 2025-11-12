'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { JarbasPresence } from './useJarbasPresence';
import { usePersonalizationPreferences } from './usePersonalization';

interface AmbientContext {
  context: AudioContext;
  bedOsc: OscillatorNode;
  bedGain: GainNode;
}

const STATUS_FREQUENCY: Record<JarbasPresence['status'], number> = {
  escutando: 128,
  respondendo: 216,
  ocioso: 92,
};

const MOOD_GAIN: Record<JarbasPresence['mood'], number> = {
  sereno: 0.16,
  vibrante: 0.22,
  alerta: 0.18,
};

const EVENT_FREQUENCY: Record<'insight' | 'acao' | 'recompensa', number> = {
  insight: 420,
  acao: 540,
  recompensa: 660,
};

const createAmbient = (): AmbientContext | null => {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
    return null;
  }

  const context = new AudioContext();
  const bedGain = context.createGain();
  const bedOsc = context.createOscillator();

  bedGain.gain.value = 0;
  bedGain.connect(context.destination);

  bedOsc.type = 'sine';
  bedOsc.frequency.value = STATUS_FREQUENCY.escutando;
  bedOsc.connect(bedGain);
  bedOsc.start();

  return { context, bedGain, bedOsc };
};

const applyAmbientDynamics = (
  ambient: AmbientContext | null,
  presence: JarbasPresence,
  volumeMode: 'suave' | 'imersivo'
) => {
  if (!ambient) return;
  const now = ambient.context.currentTime;
  const targetGain = MOOD_GAIN[presence.mood] * (volumeMode === 'imersivo' ? 1.5 : 1);
  ambient.bedGain.gain.cancelScheduledValues(now);
  ambient.bedGain.gain.setTargetAtTime(targetGain, now, 0.75);

  const frequency = STATUS_FREQUENCY[presence.status] * (1 + presence.activityLevel / 4);
  ambient.bedOsc.frequency.cancelScheduledValues(now);
  ambient.bedOsc.frequency.setTargetAtTime(frequency, now, 1.1);
};

export function useJarbasSensory(presence: JarbasPresence) {
  const preferences = usePersonalizationPreferences();
  const ambientRef = useRef<AmbientContext | null>(null);
  const unlockRef = useRef<() => void>();
  const lastStatusRef = useRef(presence.status);
  const lastInsightRef = useRef<string | null>(null);

  const teardownAmbient = useCallback(() => {
    if (unlockRef.current) {
      document.removeEventListener('pointerdown', unlockRef.current);
      unlockRef.current = undefined;
    }
    if (ambientRef.current) {
      ambientRef.current.context.close().catch(() => undefined);
      ambientRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!preferences.soundscape) {
      teardownAmbient();
      return () => {};
    }

    if (!ambientRef.current) {
      ambientRef.current = createAmbient();
      if (ambientRef.current && ambientRef.current.context.state === 'suspended') {
        const unlock = () => {
          ambientRef.current?.context.resume().catch(() => undefined);
        };
        unlockRef.current = unlock;
        document.addEventListener('pointerdown', unlock, { once: true });
      }
    }

    return () => {
      teardownAmbient();
    };
  }, [preferences.soundscape, teardownAmbient]);

  useEffect(() => {
    applyAmbientDynamics(ambientRef.current, presence, preferences.ambientVolume);
  }, [presence, preferences.ambientVolume]);

  useEffect(() => {
    if (!preferences.haptics || typeof window === 'undefined') return;
    if (!('vibrate' in navigator)) return;
    if (presence.status === lastStatusRef.current) return;

    const pattern =
      presence.status === 'respondendo'
        ? [10, 35, 10]
        : presence.status === 'escutando'
          ? [12]
          : [5, 10, 5];

    navigator.vibrate(pattern);
    lastStatusRef.current = presence.status;
  }, [presence.status, preferences.haptics]);

  useEffect(() => {
    if (preferences.tts === 'off') return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (presence.insights.length === 0) return;

    const highlight = presence.insights[0];
    if (!highlight) return;

    const text = `${highlight.title}. ${highlight.detail}`;
    if (text === lastInsightRef.current) return;

    if (preferences.tts === 'respostas' && presence.status !== 'respondendo') {
      return;
    }

    lastInsightRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.pitch = presence.mood === 'vibrante' ? 1.2 : presence.mood === 'alerta' ? 0.95 : 1.05;
    utterance.rate = 1;
    utterance.volume = preferences.ambientVolume === 'imersivo' ? 1 : 0.75;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [presence, preferences.tts, preferences.ambientVolume]);

  const triggerEventTone = useCallback(
    (event: 'insight' | 'acao' | 'recompensa') => {
      if (!preferences.soundscape) return;
      const ambient = ambientRef.current ?? createAmbient();
      if (!ambient) return;
      ambientRef.current = ambient;

      if (ambient.context.state === 'suspended') {
        ambient.context.resume().catch(() => undefined);
      }

      const now = ambient.context.currentTime;
      const osc = ambient.context.createOscillator();
      const gain = ambient.context.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(EVENT_FREQUENCY[event], now);
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(ambient.context.destination);
      osc.start(now);

      gain.gain.setTargetAtTime(preferences.ambientVolume === 'imersivo' ? 0.35 : 0.2, now, 0.01);
      gain.gain.setTargetAtTime(0, now + 0.25, 0.12);

      osc.stop(now + 0.5);

      if (preferences.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([8, 16, 8]);
      }
    },
    [preferences.soundscape, preferences.ambientVolume, preferences.haptics]
  );

  return { triggerEventTone };
}
