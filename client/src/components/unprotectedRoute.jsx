// src/components/unprotectedRoute.jsx
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../contexts/authUserContext';
import { CircularProgress, Box } from '@mui/material';

const UnprotectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dash" replace />;
  }

  return children;
};

UnprotectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default UnprotectedRoute;