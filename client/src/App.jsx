import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/authUserContext";
import { SnackbarProvider } from "notistack";
import { ThemeProvider } from "@emotion/react";
import ProtectedRoute from "./components/protectedRoute";
import UnprotectedRoute from "./components/unprotectedRoute";
import HomePage from "./pages/home/homePage";
import RoomPage from "./pages/room/roomPage";
import DashPage from "./pages/dash/dashPage";

import { theme } from "./themes/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
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
                path="/room/:roomId"
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
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
