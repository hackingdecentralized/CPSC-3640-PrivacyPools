'use client';

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
//import { Porto } from 'porto';
import { WagmiProvider } from 'wagmi';
import { config } from '~/config/wagmiConfig';

import '@rainbow-me/rainbowkit/styles.css';

// Initialize Porto for wallet discovery
//Porto.create();

type Props = {
  children: React.ReactNode;
};

const queryClient = new QueryClient();

export function WalletProvider({ children }: Props) {
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize='compact' theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
