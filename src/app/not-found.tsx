'use client';

import Link from 'next/link';
import { Box, Button, Stack, styled, Typography } from '@mui/material';
import { FOOTER_HEIGHT } from '~/utils';

export default function NotFound() {
  return (
    <Container>
      <Stack gap={6} alignItems='center' px={6}>
        <Box>
          <Typography variant='h2' align='center' color='error'>
            404
          </Typography>
          <Typography variant='h6' align='center' color='error' textTransform='uppercase'>
            Page not found
          </Typography>
        </Box>

        <Link href='/'>
          <Button>Go Home</Button>
        </Link>
      </Stack>
    </Container>
  );
}

const Container = styled('div')(() => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  minHeight: `calc(100vh - var(--header-height) - ${FOOTER_HEIGHT}rem)`,
  '@supports (height: 100dvh)': {
    height: '100%',
    minHeight: `calc(100dvh - var(--header-height) - ${FOOTER_HEIGHT}rem)`,
  },
}));
