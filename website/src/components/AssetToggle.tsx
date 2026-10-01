'use client';

import { styled, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { chainData, ChainAssets } from '~/config';
import { useChainContext } from '~/hooks';

/** CPSC 3640: header switch between the course pools (Sepolia ETH | BULLDOGS). */
export const AssetToggle = () => {
  const { chainId, selectedPoolInfo, setSelectedAsset } = useChainContext();
  const pools = chainData[chainId]?.poolInfo ?? [];

  if (pools.length < 2) return null;

  return (
    <SToggleButtonGroup
      size='small'
      exclusive
      value={selectedPoolInfo.asset}
      onChange={(_, value: ChainAssets | null) => {
        // Exclusive groups report null when the active button is clicked again; keep the selection.
        if (value) setSelectedAsset(value);
      }}
      aria-label='Pool asset'
      data-testid='asset-toggle'
    >
      {pools.map((pool) => (
        <ToggleButton key={pool.asset} value={pool.asset} aria-label={pool.asset}>
          {pool.asset}
        </ToggleButton>
      ))}
    </SToggleButtonGroup>
  );
};

const SToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    padding: '0.4rem 1rem',
    fontSize: '1.2rem',
    fontWeight: 600,
    lineHeight: 1.4,
    textTransform: 'none',
    color: theme.palette.text.primary,
    borderColor: theme.palette.grey[900],
  },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    backgroundColor: theme.palette.text.primary,
    color: theme.palette.background.default,
  },
}));
