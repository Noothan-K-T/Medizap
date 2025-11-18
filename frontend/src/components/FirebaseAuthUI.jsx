// src/components/FirebaseAuthUI.jsx
import React, { useEffect } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { app } from "../firebase"; // Your Firebase app instance

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// IMPORT THE CSS FILE
import '../styles/FirebaseAuthUI.css';

// Import your logo image
import logo from '../assets/medizap_logo.png'; // <--- IMPORTANT: Update this path to your actual logo image!

// Initialize compat Firebase manually (only once)
if (!firebase.apps.length) {
  console.log("FirebaseAuthUI: Initializing Firebase compat app with options from src/firebase.js");
  firebase.initializeApp(app.options);
} else {
  console.log("FirebaseAuthUI: Firebase compat app already initialized. Using existing app.");
  firebase.app();
}

const FirebaseAuthUI = () => {
  const navigate = useNavigate();
  const authContext = useAuth();

  if (!authContext) {
    console.error("FirebaseAuthUI: useAuth() returned null or undefined. This typically means FirebaseAuthUI is not wrapped by AuthProvider in App.jsx.");
    return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--card-bg)', // Use theme variable
          color: 'var(--error-color)', // Use theme variable
          fontSize: '1.2rem',
          textAlign: 'center',
          padding: '20px',
          borderRadius: '15px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          border: '2px solid var(--error-color)'
        }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Authentication context not available.</p>
            <p>Please check app configuration and ensure `FirebaseAuthUI` is rendered inside `AuthProvider`.</p>
        </div>
    );
  }

  const { checkProfileCompletion } = authContext;

  console.log("FirebaseAuthUI: Component rendered.");

  useEffect(() => {
    console.log("FirebaseAuthUI: useEffect triggered.");

    const firebaseUiContainer = document.getElementById("firebaseui-auth-container");
    if (!firebaseUiContainer) {
      console.error("FirebaseAuthUI: Target DOM element #firebaseui-auth-container not found!");
      return;
    }
    console.log("FirebaseAuthUI: Target DOM element found:", firebaseUiContainer);

    let ui;
    try {
      ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
      console.log("FirebaseAuthUI: firebaseui.auth.AuthUI instance obtained.");
    } catch (e) {
      console.error("FirebaseAuthUI: Error instantiating firebaseui.auth.AuthUI:", e);
      return;
    }

    const uiConfig = {
      callbacks: {
        signInSuccessWithAuthResult: async (authResult) => {
          const user = authResult.user;
          console.log("FirebaseAuthUI: FirebaseUI Sign-In successful. User UID:", user.uid);

          let idToken = null;
          try {
            idToken = await user.getIdToken();
            console.log("FirebaseAuthUI: ID Token obtained.");
          } catch (tokenError) {
            console.error("FirebaseAuthUI: Error getting ID token:", tokenError);
          }

          if (idToken) {
            try {
              const response = await fetch(
                "http://localhost:8080/api/auth/verify",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({ uid: user.uid }),
                }
              );
              const result = await response.json();
              console.log("FirebaseAuthUI: ✅ Backend response:", result);
            } catch (error) {
              console.error("FirebaseAuthUI: ❌ Error sending ID token to backend:", error);
            }
          } else {
              console.warn("FirebaseAuthUI: Skipping backend verification as ID token could not be obtained.");
          }

          console.log("FirebaseAuthUI: Sign-in success. Allowing AuthContext and PrivateRoute to handle navigation.");
          return false;
        },

        uiShown: () => {
          console.log("FirebaseAuthUI: UI widget shown.");
          const loaderElement = document.getElementById("loader");
          if (loaderElement) {
              loaderElement.style.display = "none";
          } else {
              console.warn("FirebaseAuthUI: Loader element not found.");
          }
        },
      },

      signInFlow: "popup",
      signInSuccessUrl: "/dashboard",
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      tosUrl: "https://www.reddit.com",
      privacyPolicyUrl: "/privacy",
    };

    try {
        console.log("FirebaseAuthUI: Starting FirebaseUI widget.");
        ui.start("#firebaseui-auth-container", uiConfig);
    } catch (startError) {
        console.error("FirebaseAuthUI: Error starting FirebaseUI widget:", startError);
    }

    return () => {
      console.log("FirebaseAuthUI: Cleaning up FirebaseUI.");
      if (ui) {
        ui.reset();
      }
    };
  }, [authContext]);

  return (
    <div className="auth-container">
      <div className="hero-section">
        <div className="logo-container">
        </div>
        <h1 className="heading">Welcome to Medizap</h1>
        <p className="subheading">
          Your comprehensive platform for modern healthcare management.
        </p>
        <p className="tagline">
          Streamlining patient care, appointments, and medical records.
        </p>
      </div>

      <div className="auth-section">
        <h2 className="auth-title">Sign In</h2>
        <p className="auth-description">
          Please use your preferred method to access your dashboard.
        </p>
        <div className="form-container">
          <div id="firebaseui-auth-container" className="firebase-ui-widget"></div>
          <div id="loader" className="loader">Loading authentication UI...</div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseAuthUI;