'use client';

import { useContext } from 'react';
import { AuthContext } from '~/providers/AuthProvider';

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within a AuthProvider');
  }

  return context;
};
