'use client';

import React, { useState } from 'react';

import { voicePrompts } from '../lib/demoData';

interface VoiceInputProps {
  onPulse?: () => void;
}

export function VoiceInput({ onPulse }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const toggle = () => {
    setRecording((value) => {
      const next = !value;
      if (!value && onPulse) {
        onPulse();
      }
      return next;
    });
    setPromptIndex((value) => (value + 1) % voicePrompts.length);
  };

  return (
    <div className={`voice-input ${recording ? 'voice-input--active' : ''}`}>
      <div className="voice-input__orb" aria-hidden>
        <span />
      </div>
      <button type="button" onClick={toggle} className="voice-input__button">
        <span className="voice-input__mic" aria-hidden>
          🎙️
        </span>
        <div className="voice-input__copy">
          <strong>{recording ? 'Jarbas está escutando...' : 'Fale com o Jarbas'}</strong>
          <span>voz → IA → ação imediata</span>
        </div>
      </button>
      <p className="voice-input__prompt" aria-live="polite">
        {voicePrompts[promptIndex]}
      </p>
    </div>
  );
}
