import React from 'react';

import { ExperienceShell } from '../components/ExperienceShell';
import { loadCommunitySnapshot } from '../lib/liveCommunity';

export default async function HomePage() {
  const community = await loadCommunitySnapshot();
  return <ExperienceShell community={community} />;
}
