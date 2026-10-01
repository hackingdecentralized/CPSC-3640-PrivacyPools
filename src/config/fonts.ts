import localFont from 'next/font/local';

export const ibm_plex_mono = localFont({
  src: [
    {
      path: '../assets/fonts/ibm-plex-mono/ibm-plex-mono-latin-300-normal.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../assets/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/ibm-plex-mono/ibm-plex-mono-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
});
