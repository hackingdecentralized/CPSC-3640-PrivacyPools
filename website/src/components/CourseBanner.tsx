'use client';

import { useEffect, useRef } from 'react';
import { styled, Typography } from '@mui/material';
import { isLocalFork } from '~/config/course';

/**
 * Slim, always-on notice that this is the CPSC 3640 / CPSC 5400 classroom deployment, with
 * a LOCAL FORK badge when course.json points at an anvil fork instead of Sepolia.
 *
 * Its height feeds `--banner-height`, which the mobile layout adds to the fixed
 * header's padding (the slot the upstream migration banner used).
 */
export const CourseBanner = () => {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      document.body.style.setProperty('--banner-height', `${h}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      document.body.style.removeProperty('--banner-height');
    };
  }, []);

  return (
    <Banner ref={bannerRef} role='note' data-testid='course-banner'>
      <Typography variant='caption'>CPSC 3640 / CPSC 5400 course demo — Sepolia testnet only</Typography>
      {isLocalFork && <ForkBadge data-testid='local-fork-badge'>LOCAL FORK</ForkBadge>}
    </Banner>
  );
};

const Banner = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '0.8rem',
  width: '100%',
  padding: '0.4rem 1.6rem',
  backgroundColor: '#00356B',
  color: '#FFFFFF',
  textAlign: 'center',
  span: {
    lineHeight: 1.3,
    fontWeight: 500,
  },
});

const ForkBadge = styled('span')({
  padding: '0.1rem 0.6rem',
  borderRadius: '0.4rem',
  backgroundColor: '#FFC107',
  color: '#1A1A1A',
  fontSize: '1.1rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
});
