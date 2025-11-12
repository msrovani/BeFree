import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BEFREE — Rede Viva',
    short_name: 'BeFree',
    description:
      'Interface sensorial da BEFREE com feed radial, Jarbas em tempo real, reputação BFR e automações imersivas.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#38bdf8',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
