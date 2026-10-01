'use client';

import { useEffect, useState } from 'react';
import { Button, styled } from '@mui/material';
import { BaseError, Hex } from 'viem';
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { courseConfig } from '~/config/course';
import { useChainContext, useNotifications } from '~/hooks';

// The course token's public airdrop: `claim()` mints 10,000 BULLDOGS to the caller.
const bulldogsClaimAbi = [
  { type: 'function', name: 'claim', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;

const errorMessage = (err: unknown) =>
  err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);

/** "Claim 10,000 BULLDOGS", shown next to Deposit while the BULLDOGS pool is selected. */
export const ClaimBulldogsButton = () => {
  const { selectedPoolInfo, chainId } = useChainContext();
  const { address, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const { addNotification } = useNotifications();
  const [hash, setHash] = useState<Hex>();
  const receipt = useWaitForTransactionReceipt({ hash, chainId });

  // A hash THIS wallet broadcast, so polling its receipt reveals nothing new to the provider.
  useEffect(() => {
    if (!hash || (!receipt.data && !receipt.isError)) return;
    if (receipt.data?.status === 'success') {
      addNotification('success', 'Claimed 10,000 BULLDOGS. Your wallet balance updates within 30 s.', hash);
    } else {
      addNotification('error', 'The BULLDOGS claim did not go through.', hash);
    }
    setHash(undefined);
  }, [hash, receipt.data, receipt.isError, addNotification]);

  if (selectedPoolInfo.asset !== 'BULLDOGS') return null;

  const handleClaim = async () => {
    try {
      if (walletChainId !== chainId) await switchChainAsync({ chainId });
      const txHash = await writeContractAsync({
        address: courseConfig.token.address,
        abi: bulldogsClaimAbi,
        functionName: 'claim',
        chainId,
      });
      addNotification('info', 'BULLDOGS claim sent. Waiting for confirmation...', txHash);
      setHash(txHash);
    } catch (err) {
      addNotification('error', `BULLDOGS claim failed: ${errorMessage(err)}`);
    }
  };

  const busy = isPending || !!hash;

  return (
    <StyledClaimButton fullWidth disabled={!address || busy} onClick={handleClaim} data-testid='claim-bulldogs-button'>
      {busy ? 'Claiming...' : 'Claim 10,000 BULLDOGS'}
    </StyledClaimButton>
  );
};

const StyledClaimButton = styled(Button)(({ theme }) => ({
  minWidth: '140px',
  backgroundColor: '#00356B',
  color: theme.palette.common.white,
  fontWeight: 500,
  minHeight: '40px',
  lineHeight: 1.2,
  borderRadius: '4px',
  border: 'none',
  '&:hover': {
    backgroundColor: '#002147',
  },
  '&.Mui-disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
  },
}));
