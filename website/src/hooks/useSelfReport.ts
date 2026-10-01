'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useNotifications } from '~/hooks';

interface SelfReportState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}

interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export function useSelfReport() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { addNotification } = useNotifications();

  const [state, setState] = useState<SelfReportState>({
    isLoading: false,
    isSuccess: false,
    error: null,
  });

  const reportCompromisedAddress = useCallback(async () => {
    if (!address) {
      setState({ isLoading: false, isSuccess: false, error: 'No wallet connected' });
      return false;
    }

    setState({ isLoading: true, isSuccess: false, error: null });

    try {
      // Step 1: Get nonce and message from ASP
      const nonceResponse = await fetch(`/api/self-report/nonce?address=${address}&action=report`);
      const nonceData = await nonceResponse.json();

      if (!nonceResponse.ok) {
        throw new Error(nonceData.error || 'Failed to get nonce');
      }

      const { nonce, message } = nonceData as NonceResponse;

      // Step 2: Sign the server-generated message
      const signature = await signMessageAsync({ message });

      // Step 3: Send to API endpoint
      const response = await fetch('/api/self-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          nonce,
          message,
          signature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to report address');
      }

      setState({ isLoading: false, isSuccess: true, error: null });
      addNotification('success', 'Address successfully reported as compromised. All deposits will be blocked.');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to report address';
      setState({ isLoading: false, isSuccess: false, error: errorMessage });

      // Don't show notification for user rejection
      if (!errorMessage.includes('rejected') && !errorMessage.includes('denied')) {
        addNotification('error', errorMessage);
      }
      return false;
    }
  }, [address, signMessageAsync, addNotification]);

  const reset = useCallback(() => {
    setState({ isLoading: false, isSuccess: false, error: null });
  }, []);

  return {
    ...state,
    address,
    reportCompromisedAddress,
    reset,
  };
}
