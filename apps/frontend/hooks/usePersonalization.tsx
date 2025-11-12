'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'neo' | 'sol' | 'noir';
export type MotionPreference = 'alto' | 'medio' | 'reduzido';
export type FeedFilterPreference = 'todos' | 'circulos' | 'curadoria';
export type TtsPreference = 'auto' | 'respostas' | 'off';

export interface PersonalizationPreferences {
  theme: ThemePreference;
  motion: MotionPreference;
  soundscape: boolean;
  haptics: boolean;
  tts: TtsPreference;
  feedFilter: FeedFilterPreference;
  ambientVolume: 'suave' | 'imersivo';
}

const DEFAULT_PREFERENCES: PersonalizationPreferences = {
  theme: 'neo',
  motion: 'alto',
  soundscape: true,
  haptics: true,
  tts: 'auto',
  feedFilter: 'todos',
  ambientVolume: 'suave',
};

interface PersonalizationContextValue {
  preferences: PersonalizationPreferences;
  setPreference: <K extends keyof PersonalizationPreferences>(key: K, value: PersonalizationPreferences[K]) => void;
  resetPreferences: () => void;
}

const PersonalizationContext = createContext<PersonalizationContextValue | null>(null);

const STORAGE_KEY = 'befree:preferences';

const isBrowser = () => typeof window !== 'undefined';

function applyDataset(preferences: PersonalizationPreferences) {
  if (typeof document === 'undefined') {
    return;
  }
  const { body } = document;
  body.dataset.theme = preferences.theme;
  body.dataset.motion = preferences.motion;
  body.dataset.feedFilter = preferences.feedFilter;
  body.dataset.soundscape = preferences.soundscape ? 'on' : 'off';
  body.dataset.haptics = preferences.haptics ? 'on' : 'off';
  body.dataset.tts = preferences.tts;
  body.dataset.ambientVolume = preferences.ambientVolume;
}

export function PersonalizationProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<PersonalizationPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PersonalizationPreferences>;
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.warn('Não foi possível carregar preferências salvas da BEFREE', error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    applyDataset(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!hydrated || !isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Não foi possível persistir preferências da BEFREE', error);
    }
  }, [preferences, hydrated]);

  const value = useMemo<PersonalizationContextValue>(
    () => ({
      preferences,
      setPreference: (key, value) => {
        setPreferences((current) => ({ ...current, [key]: value }));
      },
      resetPreferences: () => setPreferences(DEFAULT_PREFERENCES),
    }),
    [preferences]
  );

  return <PersonalizationContext.Provider value={value}>{children}</PersonalizationContext.Provider>;
}

export function usePersonalization(): PersonalizationContextValue {
  const context = useContext(PersonalizationContext);
  if (!context) {
    throw new Error('usePersonalization deve ser usado dentro de um PersonalizationProvider');
  }
  return context;
}

export function usePersonalizationPreferences(): PersonalizationPreferences {
  return usePersonalization().preferences;
}

export function useSetPreference() {
  return usePersonalization().setPreference;
}
