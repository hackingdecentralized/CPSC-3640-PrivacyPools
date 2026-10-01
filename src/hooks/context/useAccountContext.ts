'use client';

import { useContext } from 'react';
import { AccountContext } from '~/providers/AccountProvider';

export const useAccountContext = () => {
  const context = useContext(AccountContext);

  if (context === undefined) {
    throw new Error('useAccountContext must be used within a AccountContext');
  }

  return context;
};
