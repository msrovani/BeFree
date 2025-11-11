'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SonicEvent = 'publish' | 'reward' | 'burn';

interface SonicFeedback {
  isSupported: boolean;
  trigger: (event: SonicEvent) => Promise<void>;
  arm: () => Promise<void>;
}

const EVENT_FREQUENCIES: Record<SonicEvent, [number, number]> = {
  publish: [440, 660],
  reward: [523.25, 784],
  burn: [392, 220],
};

export function useSonicFeedback(): SonicFeedback {
  const contextRef = useRef<AudioContext | null>(null);
  const [isSupported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContext }).webkitAudioContext;
    if (AudioCtor) {
      setSupported(true);
    }
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  const ensureContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }
    if (contextRef.current && contextRef.current.state === 'closed') {
      contextRef.current = null;
    }
    if (!contextRef.current) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return null;
      }
      contextRef.current = new AudioCtor();
    }
    if (contextRef.current.state === 'suspended') {
      await contextRef.current.resume();
    }
    return contextRef.current;
  }, []);

  const arm = useCallback(async () => {
    await ensureContext();
  }, [ensureContext]);

  const trigger = useCallback(
    async (event: SonicEvent) => {
      const ctx = await ensureContext();
      if (!ctx) {
        return;
      }
      const [startFreq, endFreq] = EVENT_FREQUENCIES[event];
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.6);
    },
    [ensureContext],
  );

  return { isSupported, trigger, arm };
}
