import '@mui/material/styles';
import '@mui/material/Typography';
declare module '@mui/material/styles' {
  interface Theme {
    borderRadius: {
      default: string;
      sm: string;
      md: string;
      lg: string;
    };
  }
  // allow configuration using `createTheme()`
  interface ThemeOptions {
    borderRadius: {
      default: string;
      sm: string;
      md: string;
      lg: string;
    };
  }

  interface Palette {
    border: {
      main: string;
      dark: string;
      light: string;
    };
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    tiny: true;
  }
}
