//Create authUserContext for managing user authentication state
//assume the react app is built using vite and mui for styling so ensure vite standard is met
// authUserContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import authService from "../services/auth";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing auth session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = authService.getToken();
        if (token && !authService.isTokenExpired()) {
          const userData = authService.getUser();
          setUser(userData);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setError("Failed to restore authentication state");
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (userData) => {
    try {
      if (!userData) {
        throw new Error("User data is required");
      }
      setUser(userData);
      setError(null);
    } catch (err) {
      console.error("Context login error:", err);
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: Boolean(user && authService.isAuthenticated()),
  };

  if (loading) {
    return null; // Or a loading spinner component
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
