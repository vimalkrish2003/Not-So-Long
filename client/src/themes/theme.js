import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.controlBar': {
            backgroundColor: 'rgba(15, 15, 15, 1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '30px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          },
          '&.messageContainer': {
            backgroundColor: 'rgba(41, 41, 41, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          '&.message': {
            backgroundColor: 'rgba(49, 49, 49, 0.95)',
            color: '#ffffff',
          },
          '&.sentMessage .message': {
            backgroundColor: 'rgba(33, 150, 243, 0.9)',
          }
        }
      }
    }
  }
});