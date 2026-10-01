import { ColorSystemOptions, createTheme, Theme } from '@mui/material';
import { CustomMuiTheme } from '~/types';

export const getMuiThemeConfig = (customTheme: CustomMuiTheme) => {
  return createTheme({
    palette: customTheme.light,
    colorSchemes: {
      light: {
        palette: {
          ...(customTheme.light as ColorSystemOptions['palette']),
        },
      },
      dark: {
        palette: {
          ...(customTheme.dark as ColorSystemOptions['palette']),
        },
      },
    },
    typography: customTheme.typography,
    borderRadius: customTheme.borderRadius,
    cssVariables: {
      colorSchemeSelector: 'class',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          html: {
            fontSize: '62.5%',
          },
          body: {
            background: theme.palette.background.default,
          },
          borderRadius: theme.borderRadius.sm,
        }),
      },
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
        },
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            borderRadius: theme.borderRadius.sm,
            fontWeight: '500',
            fontSize: theme.typography.body2.fontSize,
            textTransform: 'none',
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          variant: 'outlined',
          color: 'primary',
        },
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            padding: theme.spacing(1.5, 2.5),
            height: theme.spacing(4.75),
            textTransform: 'none',
            variants: [
              {
                props: { color: 'primary', variant: 'outlined' },
                style: {
                  border: theme.palette.border.light,
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.default,
                  '&:hover, &:focus': {
                    border: theme.palette.border.main,
                    color: theme.palette.primary.contrastText,
                    backgroundColor: theme.palette.text.primary,
                  },
                  '&:active': {
                    border: theme.palette.border.main,
                    color: theme.palette.primary.contrastText,
                    backgroundColor: theme.palette.grey[700],
                  },
                  '&:disabled': {
                    color: theme.palette.text.disabled,
                    borderColor: theme.palette.text.disabled,
                  },
                },
              },
            ],
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            border: theme.palette.border.light,
            borderRadius: theme.borderRadius.sm,
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.default,
            padding: theme.spacing(0.625),
            '&:hover, &:focus': {
              border: theme.palette.border.main,
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.text.primary,
            },
            '&:active': {
              border: theme.palette.border.main,
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.grey[700],
            },
            '&:disabled': {
              color: theme.palette.text.disabled,
              borderColor: theme.palette.text.disabled,
            },
          }),
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            border: theme.palette.border.main,
            borderRadius: theme.borderRadius.default,
            backgroundColor: theme.palette.background.default,
          }),
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            '&:last-child': {
              paddingBottom: theme.spacing(2),
            },
          }),
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: ({ theme }: { theme: Theme }) => ({
            border: theme.palette.border.main,
            variants: [
              {
                props: { color: 'error' },
                style: {
                  backgroundColor: theme.palette.error.light,
                  borderColor: theme.palette.error.main,
                },
              },
              {
                props: { color: 'success' },
                style: {
                  backgroundColor: theme.palette.success.light,
                  borderColor: theme.palette.success.main,
                },
              },
              {
                props: { color: 'warning' },
                style: {
                  backgroundColor: theme.palette.warning.light,
                  borderColor: theme.palette.warning.main,
                },
              },
            ],
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            backgroundColor: theme.palette.background.default,
            '& fieldset': {
              border: theme.palette.border.light,
              borderRadius: theme.borderRadius.sm,

              '&:hover, &:focus': {
                border: theme.palette.border.main,
              },
            },
          }),
        },
      },
      MuiList: {
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            border: theme.palette.border.main,
            borderRadius: theme.borderRadius.sm,
          }),
        },
      },
      MuiFormControl: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }: { theme: Theme }) => ({
            border: theme.palette.border.main,
            borderRadius: theme.borderRadius.default,
            backgroundColor: theme.palette.background.default,
            boxShadow: 'none',
            '&:has(> .MuiList-root)': {
              border: 'none',
            },
          }),
          list: ({ theme }: { theme: Theme }) => ({
            marginTop: theme.spacing(0.5),
            padding: theme.spacing(0, 1.5),
            '& .MuiMenuItem-root': {
              borderBottom: theme.palette.border.dark,
              borderRadius: '0',
              padding: theme.spacing(2, 0),
              lineHeight: '1',
              '&.Mui-selected': {
                backgroundColor: theme.palette.background.default,
                color: theme.palette.text.disabled,
                pointerEvents: 'none',
                cursor: 'default',
                '& > div': {
                  opacity: 0.6,
                },
                '&:focus': {
                  backgroundColor: 'transparent',
                },
                '&:hover': {
                  backgroundColor: theme.palette.background.default,
                  fontWeight: 400,
                },
              },
              '&:hover': {
                backgroundColor: theme.palette.background.default,
                fontWeight: 500,
              },
              '&:last-child': {
                borderBottom: 'none',
              },
            },
          }),
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: ({ theme }: { theme: Theme }) => ({
            '& .MuiSelect-icon': {
              color: theme.palette.text.primary,
            },
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            '--Paper-overlay': 'none',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            width: '100%',
          },
        },
      },
    },
  });
};
