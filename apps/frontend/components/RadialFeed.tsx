'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { usePulseLayout } from '../hooks/usePulseLayout';
import type { Pulse } from '../lib/demoData';

import { FeedOrb } from './FeedOrb';

interface RadialFeedProps {
  pulses: Pulse[];
}

export function RadialFeed({ pulses }: RadialFeedProps) {
  const positioned = usePulseLayout(pulses);

  return (
    <section className="radial-feed" aria-label="Feed radial de energia social">
      <motion.div
        className="radial-feed__halo"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 60, ease: 'linear' }}
      />
      <motion.div
        className="radial-feed__halo halo--outer"
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 90, ease: 'linear' }}
      />
      <motion.div
        className="radial-feed__constellation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} className={`radial-feed__star star-${index % 6}`} aria-hidden />
        ))}
      </motion.div>
      <div className="radial-feed__orbs">
        {positioned.map((pulse) => (
          <FeedOrb key={pulse.id} pulse={pulse} />
        ))}
      </div>
    </section>
  );
}
