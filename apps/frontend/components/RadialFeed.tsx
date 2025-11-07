import React from 'react';

import { usePulseLayout } from '../hooks/usePulseLayout';
import { pulses } from '../lib/demoData';

import { FeedOrb } from './FeedOrb';

export function RadialFeed() {
  const positioned = usePulseLayout(pulses);

  return (
    <section className="radial-feed">
      <div className="radial-feed__halo" />
      <div className="radial-feed__halo halo--outer" />
      <div className="radial-feed__orbs">
        {positioned.map((pulse) => (
          <FeedOrb key={pulse.id} pulse={pulse} />
        ))}
      </div>
    </section>
  );
}
