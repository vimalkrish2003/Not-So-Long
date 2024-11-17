import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/authUserContext';  

const UnprotectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user is already logged in, redirect to /dash
  if (user) {
    return <Navigate to={'/dash'} replace />;
  }

  return children;
};

export default UnprotectedRoute;