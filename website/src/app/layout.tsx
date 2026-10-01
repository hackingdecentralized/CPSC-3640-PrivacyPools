import { Suspense } from 'react';
import { Metadata } from 'next';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { MainContent, NoScriptMessage, PageWrapper } from '~/components';
import { FeatureFlagInitializer } from '~/components/FeatureFlagInitializer';
import { ibm_plex_mono } from '~/config/fonts';
import { Footer, Header, Modals } from '~/containers';
import { NotificationContainer } from '~/containers/NotificationContainer';
import { MigrationGate, MigrationProvider } from '~/migration';
import { Providers } from '~/providers';

const title = 'Privacy Pools - Anonymous & Compliant Payments';
const description =
  'Privacy Pools by 0xbow is a compliant way to anonymously transact on Ethereum. 0xbow blocks illicit actors to ensure pool integrity.';

// Social-preview image URLs are absolute, so they need the public origin, e.g. https://<owner>.github.io (the
// GitHub Pages workflow sets it). Without it Next falls back to http://localhost:3000.
const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN;

export const metadata: Metadata = {
  ...(siteOrigin && { metadataBase: new URL(siteOrigin) }),
  title,
  description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={ibm_plex_mono.className} suppressHydrationWarning>
        <AppRouterCacheProvider>
          <InitColorSchemeScript attribute='class' />

          <Providers>
            <MigrationProvider>
              <Suspense fallback={null}>
                <FeatureFlagInitializer />
              </Suspense>
              <MigrationGate />
              <PageWrapper>
                <NoScriptMessage>
                  <p>This website requires JavaScript to function properly.</p>
                </NoScriptMessage>

                <Header />
                <MainContent data-testid='main-content'>{children}</MainContent>
                <Footer />
              </PageWrapper>
              <NotificationContainer />
              <Modals />
            </MigrationProvider>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
