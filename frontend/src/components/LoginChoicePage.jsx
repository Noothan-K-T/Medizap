// src/components/LoginChoicePage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginChoicePage.css'; // Don't forget to create this CSS file

const LoginChoicePage = () => {
  const navigate = useNavigate();

  const handleUserLogin = () => {
    // Navigates to the existing user login page
    navigate('/login'); 
  };

  const handlePharmacistLogin = () => {
    // Navigates to the new pharmacist login page
    navigate('/pharmacistlogin');
  };

  return (
    <div className="login-choice-container">
      <h1 className="choice-title">Welcome to Medizap!</h1>
      <p className="choice-subtitle">How would you like to log in?</p>
      <div className="choice-buttons-group">
        <button 
          className="choice-button user-button" 
          onClick={handleUserLogin}
        >
          🧑‍⚕️ **As a User**
          <span className="choice-description">
            (For patients and general public)
          </span>
        </button>
        <button 
          className="choice-button pharmacist-button" 
          onClick={handlePharmacistLogin}
        >
           Apothecary 
          **As a Pharmacist**
          <span className="choice-description">
            (For certified medical professionals)
          </span>
        </button>
      </div>
    </div>
  );
};

export default LoginChoicePage;