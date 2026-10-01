'use client';

import { Stack } from '@mui/material';
import { DepositAssetSelect, WithdrawAssetSelect } from '~/components';
import { ClaimBulldogsButton } from '~/components/ClaimBulldogsButton';
import { useChainContext } from '~/hooks';

export const ActionMenu = () => {
  const { selectedPoolInfo } = useChainContext();
  // CPSC 3640: with the Claim button there are three buttons, which do not fit a phone-width row, so they stack there.
  const stackOnPhone = selectedPoolInfo.asset === 'BULLDOGS';

  return (
    <Stack
      direction={{ xs: stackOnPhone ? 'column' : 'row', sm: 'row' }}
      spacing={2}
      width={{ xs: stackOnPhone ? '80%' : 'auto', sm: 'auto' }}
      data-testid='action-menu'
    >
      <DepositAssetSelect />
      {/* CPSC 3640: renders only while the BULLDOGS pool is selected */}
      <ClaimBulldogsButton />
      <WithdrawAssetSelect />
    </Stack>
  );
};
