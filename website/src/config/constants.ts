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
  ASP_OPTIONS: ['Course ASP'],
  COOKIES: {
    USER_LOGGED: { name: 'userLogged', value: 'true' },
    USER_CONNECTED: { name: 'userConnected', value: 'true' },
  },
  ITEMS_PER_PAGE: 12,
  TOC_URL: 'https://docs.privacypools.com/toc',
  PENDING_STATUS_MESSAGE:
    'The course ASP approves deposits automatically, usually within a minute (the teacher can still decline one).',
  DEFAULT_ASSET: 'ETH',
};

export const getConstants = (): Constants => {
  return constants;
};
