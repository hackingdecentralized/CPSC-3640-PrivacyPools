import { Constants } from '~/types';

const constants: Constants = {
  FOOTER_LINKS: [
    { label: 'White Paper', href: '/whitepaper.pdf' },
    { label: 'Docs', href: 'https://docs.privacypools.com' },
    {
      label: 'Github',
      href: `https://github.com/hackingdecentralized/CPSC-3640-PrivacyPools`,
    },
    { label: 'Terms', href: 'https://docs.privacypools.com/toc' },
    { label: 'Privacy', href: 'https://docs.privacypools.com/privacy-policy' },
  ],
  ASP_OPTIONS: ['0xBow ASP'],
  COOKIES: {
    USER_LOGGED: { name: 'userLogged', value: 'true' },
    USER_CONNECTED: { name: 'userConnected', value: 'true' },
  },
  ITEMS_PER_PAGE: 12,
  TOC_URL: 'https://docs.privacypools.com/toc',
  PENDING_STATUS_MESSAGE:
    'The ASP is validating that the funds are coming from a good actor. Estimated period: Up to 7 days.',
  DEFAULT_ASSET: 'ETH',
};

export const getConstants = (): Constants => {
  return constants;
};
