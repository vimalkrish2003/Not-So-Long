import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useAuth } from "../../contexts/authUserContext";
import { authService } from "../../services/auth";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  Button,
} from "@mui/material";
import api from "../../services/apiClient";


const HomePage = () => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  //Development Code for testing purpose to simplify login starts
  const testUsers = {
    user1: {
      googleId: "112379314031303067001",
      email: "testuser1@example.com",
      name: "Test User 1",
      picture: "https://ui-avatars.com/api/?name=Test+User+1"
    },
    user2: {
      googleId: "112379314031303067002",
      email: "testuser2@example.com",
      name: "Test User 2",
      picture: "https://ui-avatars.com/api/?name=Test+User+2"
    }
  };


  const getDetailedError = (err) => {
    if (err.response) {
      // Server responded with error
      return `Error ${err.response.status}: ${err.response.data?.message || err.message}`;
    } else if (err.request) {
      // Request made but no response
      return `Network Error: Server not responding. Check your connection.`;
    } else {
      // Error in request setup
      return `Error: ${err.message}`;
    }
  };
  
  const handleTestLogin=async (testUser)=>{
    try{
      setIsLoading(true);
      setError(null);
      const response = await api.post("/auth/test", { user:testUser });
      const { token: jwtToken, user } = response.data;

      if (!jwtToken || !user) {
        throw new Error("Invalid response from server");
      }

      // Store token and user data
      localStorage.setItem("token", jwtToken);
      localStorage.setItem("user", JSON.stringify(user));

      await login(user);
      navigate("/dash");
    }
    catch(err){
      console.error("Login error:",err);
      console.log(err)
      setError(getDetailedError(err)|| "Failed to login");
    }
    finally{
      setIsLoading(false);
    }
  }
  //Development login code ends

  const handleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setError(null);
      const user = await authService.googleLogin(credentialResponse.credential);
      await login(user);
      navigate("/dash");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Failed to login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            width: "100%",
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: "bold",
              color: "primary.main",
            }}
          >
            Welcome to Video Chat
          </Typography>
          <Typography>
            Development Login used for development purpose
          </Typography>
          <Stack spacing={2} width="100%">
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => handleTestLogin(testUsers.user1)}
            >
              Login as Test User 1
            </Button>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => handleTestLogin(testUsers.user2)}
            >
              Login as Test User 2
            </Button>
          </Stack>

          <Box sx={{ position: "relative" }}>
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
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  marginTop: "-12px",
                  marginLeft: "-12px",
                }}
              />
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default HomePage;
