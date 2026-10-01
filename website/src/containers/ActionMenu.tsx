'use client';

import { Stack } from '@mui/material';
import { DepositAssetSelect, WithdrawAssetSelect } from '~/components';

export const ActionMenu = () => {
  return (
    <Stack direction='row' spacing={2} data-testid='action-menu'>
      <DepositAssetSelect />
      <WithdrawAssetSelect />
    </Stack>
  );
};
