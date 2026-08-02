import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Spinner from "./components/atoms/Spinner";
import AppLayout from "./components/templates/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import SearchPage from "./pages/SearchPage";
import SignupPage from "./pages/SignupPage";
import UserProfilePage from "./pages/UserProfilePage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner />;
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route
              path="search"
              element={
                <RequireAuth>
                  <SearchPage />
                </RequireAuth>
              }
            />
            <Route
              path="users/:userId"
              element={
                <RequireAuth>
                  <UserProfilePage />
                </RequireAuth>
              }
            />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
