import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/authUserContext";
import { SocketProvider } from "./contexts/socketContext";
import { PeerProvider } from "./contexts/peerContext";
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
          <SocketProvider>
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
                      <PeerProvider>
                        <RoomPage />
                      </PeerProvider>
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
          </SocketProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
