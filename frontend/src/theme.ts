import { createTheme } from '@mui/material/styles'

/**
 * Frame Studio theme — Material UI v7 createTheme.
 * Primary keeps the existing engineering-blue identity.
 */
export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#405aa6',
      light: '#6b82c4',
      dark: '#2c3f7a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#5c6b7a',
      light: '#8a96a3',
      dark: '#3d4a56',
    },
    error: {
      main: '#b63f52',
    },
    success: {
      main: '#087d68',
    },
    warning: {
      main: '#9b6511',
    },
    info: {
      main: '#405aa6',
    },
    background: {
      default: '#eef2f6',
      paper: '#ffffff',
    },
    divider: '#d9e0e9',
    text: {
      primary: '#202631',
      secondary: '#667080',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: 'default',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundImage: 'none',
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
        enterDelay: 400,
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
  },
})
