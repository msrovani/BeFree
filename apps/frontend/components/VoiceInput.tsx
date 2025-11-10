'use client';

import React, { useState } from 'react';

import { voicePrompts } from '../lib/demoData';

export function VoiceInput() {
  const [recording, setRecording] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const toggle = () => {
    setRecording((value) => !value);
    setPromptIndex((value) => (value + 1) % voicePrompts.length);
  };

  return (
    <div className={`voice-input ${recording ? 'voice-input--active' : ''}`}>
      <button type="button" onClick={toggle} className="voice-input__button">
        <span className="voice-input__glow" aria-hidden />
        <span className="voice-input__mic">🎙️</span>
        {recording ? 'Jarbas escuta você...' : 'Fale com o Jarbas'}
      </button>
      <p className="voice-input__prompt" aria-live="polite">
        {voicePrompts[promptIndex]}
      </p>
    </div>
  );
}
