import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0b0f14',
      paper: '#111827'
    },
    primary: {
      main: '#60a5fa'
    },
    secondary: {
      main: '#f59e0b'
    }
  },
  typography: {
    fontFamily: ['"Inter"', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'].join(',')
  },
  shape: {
    borderRadius: 16
  }
});

export default theme;
