// frontend/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Import AuthProvider and useAuth from your AuthContext
import { AuthProvider, useAuth } from './contexts/AuthContext';

import './App.css'; // Global CSS, including your theme variables
import './styles/DashboardHome.css'; // Import the new dashboard home specific CSS

// Import your components
import HomePage from './components/HomePage';
import FirebaseAuthUI from './components/FirebaseAuthUI';

// --- ROLE SELECTION IMPORTS ---
import LoginChoicePage from './components/LoginChoicePage';
import PharmacistLoginPage from './components/PharmacistLoginPage';

// --- DASHBOARD IMPORTS ---
import DashboardLayout from './components/DashboardLayout';
import PharmacistDashboard from './components/PharmacistDashboard';
import RegisterPharmacy from './components/RegisterPharmacy'; // <-- Already imported, good!

// --- FEATURE IMPORTS ---
import DashboardHome from './features/DashboardHome';
import ProfilePage from './features/ProfilePage';
import RemindersPage from './features/RemindersPage';
import UploadPrescription from './features/UploadPrescription';
import ChatbotUI from './features/ChatbotUI';
import ChatbotPage from './features/ChatbotPage';
import MedicinesList from "./features/MedicinesList";

// PrivateRoute component
const PrivateRoute = ({ children }) => {
  const { currentUser, loadingAuth, isProfileComplete, profileActionRequired, profileChecked } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("PrivateRoute useEffect: currentUser:", !!currentUser, "loadingAuth:", loadingAuth, "profileChecked:", profileChecked, "profileActionRequired:", profileActionRequired, "Current path:", window.location.pathname);

    if (loadingAuth || !profileChecked) {
      return; // Wait for auth/profile checks to complete
    }

    if (!currentUser) {
      console.log("PrivateRoute useEffect: No user. Navigating to /login-choice.");
      navigate("/login-choice", { replace: true }); 
      return;
    }
    
    // --- START ROLE-BASED LOGIC ---
    // This logic needs to be smarter. It assumes all users need a user profile.
    // A pharmacist user should not be redirected to /dashboard/profile.
    // This is a placeholder, you will need to implement roles in your AuthContext.

    const isPharmacistRoute = window.location.pathname.startsWith('/dashboard/pharmacist') || 
                              window.location.pathname.startsWith('/dashboard/register-pharmacy');
    
    // If the user is on a pharmacist route, DON'T check for user profile completeness.
    if (isPharmacistRoute) {
      console.log("PrivateRoute useEffect: Pharmacist route, skipping profile check.");
      return; 
    }

    // If it's a USER route, check for profile completion.
    if (profileActionRequired) {
      if (window.location.pathname !== "/dashboard/profile") {
        console.log("PrivateRoute useEffect: Profile action required. Navigating to /dashboard/profile.");
        navigate("/dashboard/profile", { replace: true });
      }
      return;
    }
    // --- END ROLE-BASED LOGIC ---

    console.log("PrivateRoute useEffect: All checks passed.");
  }, [currentUser, loadingAuth, isProfileComplete, profileActionRequired, profileChecked, navigate]);

  if (loadingAuth || !profileChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#2d3748', color: '#f8f9fa', fontSize: '1.5rem' }}>
        Loading user session...
      </div>
    );
  }

  return children;
};

// Main App component
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

// AppContent component to consume AuthContext
const AppContent = () => {
  const { loadingAuth } = useAuth();

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#2d3748', color: '#f8f9fa', fontSize: '2rem', padding: '20px' }}>
        Initializing Medizap...
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* --- PUBLIC ROUTES --- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login-choice" element={<LoginChoicePage />} />
        <Route path="/pharmacistlogin" element={<PharmacistLoginPage />} />
        <Route path="/login" element={<FirebaseAuthUI />} /> 

        {/* --- USER DASHBOARD ROUTES (Protected) --- */}
        <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="reminders" element={<RemindersPage />} />
        _ <Route path="upload-prescription" element={<UploadPrescription />} />
          <Route path="chatbot-page" element={<ChatbotPage />} />
          <Route path="medicines" element={<MedicinesList />} />
        </Route>

        {/* --- PHARMACIST DASHBOARD ROUTES (Protected) --- */}
        <Route 
          path="/dashboard/pharmacist" 
          element={<PrivateRoute><PharmacistDashboard /></PrivateRoute>} 
        />
        
        {/* --- THIS IS THE NEW ROUTE --- */}
        <Route 
          path="/dashboard/register-pharmacy" 
          element={<PrivateRoute><RegisterPharmacy /></PrivateRoute>} 
    t   />

        {/* --- CATCH-ALL ROUTE --- */}
content   <Route path="*" element={<Navigate to="/login-choice" replace />} /> 
      </Routes>

      <ChatbotUI />
    </>
  );
};

export default App;