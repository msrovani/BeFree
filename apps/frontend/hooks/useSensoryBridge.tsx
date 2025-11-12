'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type SensoryEvent = 'insight' | 'acao' | 'recompensa';

interface SensoryBridgeValue {
  trigger: (event: SensoryEvent) => void;
  register: (handler: (event: SensoryEvent) => void) => void;
}

const noop = () => {};

const SensoryBridgeContext = createContext<SensoryBridgeValue>({
  trigger: noop,
  register: () => {},
});

export function SensoryBridgeProvider({ children }: { children: React.ReactNode }) {
  const [handler, setHandler] = useState<(event: SensoryEvent) => void>(() => noop);

  const value = useMemo<SensoryBridgeValue>(
    () => ({
      trigger: (event: SensoryEvent) => {
        handler(event);
      },
      register: (nextHandler: (event: SensoryEvent) => void) => {
        setHandler(() => nextHandler ?? noop);
      },
    }),
    [handler]
  );

  return <SensoryBridgeContext.Provider value={value}>{children}</SensoryBridgeContext.Provider>;
}

export function useSensoryBridge(): SensoryBridgeValue {
  return useContext(SensoryBridgeContext);
}
