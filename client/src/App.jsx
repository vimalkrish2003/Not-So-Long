import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/authUserContext";
import ProtectedRoute from "./components/protectedRoute";
import UnprotectedRoute from "./components/unprotectedRoute";
import HomePage from "./pages/home/homePage";
import RoomPage from "./pages/room/roomPage";
import DashPage from "./pages/dash/dashPage";
import { ThemeProvider } from "@emotion/react";
import { theme } from "./themes/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
    <AuthProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <UnprotectedRoute>
                <HomePage />
              </UnprotectedRoute>
            } 
          />
          <Route 
            path="/room" 
            element={
              <ProtectedRoute>
                <RoomPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dash" 
            element={
              <ProtectedRoute>
                <DashPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;