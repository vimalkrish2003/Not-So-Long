import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useAuth } from "../../contexts/authUserContext";
import { authService } from "../../services/api/auth";
import { useNavigate } from "react-router-dom";
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert 
} from "@mui/material";

const HomePage = () => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await authService.googleLogin(credentialResponse.credential);
      login(data.user);
      navigate("/dash");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper 
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            width: '100%',
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontWeight: 'bold',
              color: 'primary.main' 
            }}
          >
            Welcome to Video Chat
          </Typography>

          <Box sx={{ position: 'relative' }}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Login Failed")}
              disabled={isLoading}
              useOneTap={false}
              type="standard"
              shape="rectangular"
              theme="filled_blue"
            />
            {isLoading && (
              <CircularProgress
                size={24}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-12px',
                  marginLeft: '-12px',
                }}
              />
            )}
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ width: '100%' }}
            >
              {error}
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default HomePage;