'use client';

import { useContext } from 'react';
import { ChainContext } from '~/providers/ChainProvider';

export const useChainContext = () => {
  const context = useContext(ChainContext);

  if (context === undefined) {
    throw new Error('useChainContext must be used within a ChainProvider');
  }

  return context;
};
