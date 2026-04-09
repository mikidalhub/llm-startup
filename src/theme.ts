import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#eef2f7',
      paper: '#f8fafc'
    },
    primary: {
      main: '#60a5fa'
    },
    secondary: {
      main: '#0ea5e9'
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
