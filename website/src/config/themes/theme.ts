import { CustomMuiTheme } from '~/types';

const grey = {
  50: '#FFFFFF',
  100: '#F0F0F0',
  200: '#E6E6E6',
  300: '#B8BBBF',
  400: '#999999',
  500: '#737373',
  600: '#4D4D4D',
  700: '#262626',
  800: '#1A1A1A',
  900: '#000000',
};

const error = {
  main: '#BA6B5D',
  light: '#ECCCC6',
  dark: '#824A41',
};

const warning = {
  main: '#f4b740',
  light: '#FAECBD',
  dark: '#AA802C',
};

const success = {
  main: '#7D9C40',
  light: '#DFECC6',
  dark: '#408040',
};

const info = {
  main: '#5bc0de',
  light: '#7BCCE4',
  dark: '#3F869B',
};

const palette = {
  grey,
  error,
  warning,
  success,
  info,
};

const core = {
  typography: {
    fontFamily: 'ibm_plex_mono',
    tiny: {
      fontSize: '0.625rem',
    },
    fontSize: 22.4,
  },
  borderRadius: {
    default: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
};

const darkTheme = {
  ...palette,
  primary: { main: palette.grey[50] },
  secondary: { main: palette.grey[300] },
  text: {
    primary: palette.grey[50],
    secondary: palette.grey[300],
    disabled: palette.grey[500],
  },
  background: {
    default: palette.grey[900],
    paper: palette.grey[900],
  },
  divider: palette.grey[700],
  border: {
    main: `1px solid ${palette.grey[50]}`,
    dark: `1px solid ${palette.grey[500]}`,
    light: `1px solid ${palette.grey[600]}`,
  },
};

const lightTheme = {
  ...palette,
  primary: {
    main: palette.grey[900],
  },
  secondary: {
    main: palette.grey[600],
  },
  text: {
    primary: palette.grey[900],
    secondary: palette.grey[600],
    disabled: palette.grey[400],
  },
  background: {
    default: palette.grey[50],
    paper: palette.grey[50],
  },
  divider: palette.grey[200],
  border: {
    main: `1px solid ${palette.grey[900]}`,
    dark: `1px solid ${palette.grey[400]}`,
    light: `1px solid ${palette.grey[300]}`,
  },
};

export const customTheme: CustomMuiTheme = {
  dark: darkTheme,
  light: lightTheme,
  ...core,
};
