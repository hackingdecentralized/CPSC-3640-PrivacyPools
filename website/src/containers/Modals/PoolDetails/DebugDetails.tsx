'use client';

import { useMemo, useState } from 'react';
import { hashPrecommitment } from '@0xbow/privacy-pools-core-sdk';
import { styled, Typography } from '@mui/material';
import { usePoolAccountsContext } from '~/hooks';

/**
 * CPSC 3640: a collapsed, plain-text view of this pool account's deposit values, so students can match them to the
 * ASP and the contracts. The nullifier and secret stay masked until clicked.
 */
export const DebugDetails = () => {
  const { poolAccount } = usePoolAccountsContext();
  const [revealed, setRevealed] = useState(false);

  const precommitment = useMemo(() => {
    if (!poolAccount) return '';
    try {
      return hashPrecommitment(poolAccount.deposit.nullifier, poolAccount.deposit.secret).toString();
    } catch {
      return 'unavailable';
    }
  }, [poolAccount]);

  if (!poolAccount) return null;

  const secretValue = (value: bigint) =>
    revealed ? (
      value.toString()
    ) : (
      <RevealButton type='button' onClick={() => setRevealed(true)}>
        •••••• (click to reveal; testnet only, never reveal real secrets)
      </RevealButton>
    );

  return (
    <Details data-testid='pool-account-debug'>
      <summary>Debug</summary>
      <Typography variant='caption' component='dl'>
        <dt>Commitment (deposit.hash)</dt>
        <dd>{poolAccount.deposit.hash.toString()}</dd>
        <dt>Label</dt>
        <dd>{poolAccount.label.toString()}</dd>
        <dt>Precommitment = Poseidon(nullifier, secret)</dt>
        <dd>{precommitment}</dd>
        <dt>Nullifier</dt>
        <dd>{secretValue(poolAccount.deposit.nullifier)}</dd>
        <dt>Secret</dt>
        <dd>{secretValue(poolAccount.deposit.secret)}</dd>
      </Typography>
    </Details>
  );
};

const Details = styled('details')(({ theme }) => ({
  width: '100%',
  fontFamily: 'inherit',
  summary: {
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '1.2rem',
    textTransform: 'uppercase',
    color: theme.palette.grey[500],
  },
  dl: {
    display: 'block',
    margin: '0.8rem 0 0',
  },
  dt: {
    fontWeight: 700,
    marginTop: '0.6rem',
  },
  dd: {
    margin: 0,
    wordBreak: 'break-all',
  },
}));

const RevealButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: theme.palette.warning.main,
  textAlign: 'left',
}));
