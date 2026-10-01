'use client';

import { Stack, styled, Typography } from '@mui/material';
import { FOOTER_HEIGHT } from '~/utils';

export default function Loading() {
  return (
    <Container>
      <Stack gap={2} zIndex={1}>
        <Typography variant='h5' fontWeight='bold' align='center'>
          Loading
        </Typography>
        <Typography variant='body2' align='center'>
          Wait a few seconds
        </Typography>
      </Stack>
      <Circle />
    </Container>
  );
}

const Container = styled('div')(() => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  minHeight: `calc(100vh - var(--header-height) - ${FOOTER_HEIGHT}rem)`,
  '@supports (height: 100dvh)': {
    height: '100%',
    minHeight: `calc(100dvh - var(--header-height) - ${FOOTER_HEIGHT}rem)`,
  },
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const Circle = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  aspectRatio: '1',
  borderRadius: '50%',
  '--circle-width': '40%',
  width: 'var(--circle-width)',
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.grey[50],
  animation: 'pulse 1.5s infinite',
  willChange: 'width',
  '@keyframes pulse': {
    '0%': {
      width: 'var(--circle-width)',
      animationTimingFunction: 'ease-out',
    },
    '50%': {
      width: 'calc(var(--circle-width) * 0.8)',
      animationTimingFunction: 'ease-in',
    },
    '100%': {
      width: 'var(--circle-width)',
    },
  },
  [theme.breakpoints.down('sm')]: {
    '--circle-width': '90%',
  },
}));
