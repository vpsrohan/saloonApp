import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";

// Pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import SalonPage from "./pages/SalonPage";
import EditSalonPage from "./pages/EditSalonPage";
// import BookingsPage from "./pages/BookingsPage";
import ProfilePage from "./pages/ProfilePage";
import SalonBookingsPage from "./pages/SalonbookingsPage";

function App() {
  const { checkAuth, loading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/salon/:id" element={<SalonPage />} />
        <Route path="/salon/:id/bookings" element={<SalonBookingsPage />} />
        <Route path="/salon/edit/:id" element={<EditSalonPage />} />
        {/* <Route path="/bookings" element={<BookingsPage />} /> */}
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;