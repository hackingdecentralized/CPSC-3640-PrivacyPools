'use client';

import { useContext } from 'react';
import { PoolAccountsContext } from '~/providers/PoolAccountsProvider';

export const usePoolAccountsContext = () => {
  const context = useContext(PoolAccountsContext);

  if (context === undefined) {
    throw new Error('usePoolAccountsContext must be used within a PoolAccountsProvider');
  }

  return context;
};
