// src/components/PharmacistLoginPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, ArrowLeft } from 'lucide-react';

// Import your new CSS file
import '../styles/PharmacistLoginPage.css'; 

// --- We removed useAuth ---

const PharmacistLoginPage = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  // --- Set back to mock login logic ---
  const handleLogin = (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    
    // --- Mock Login Logic ---
    setTimeout(() => {
        setLoading(false);
        // Here are the hardcoded credentials
        if (email === 'pharmacy@medizap.com' && password === 'securepass') {
            setMessage('Login successful! Redirecting to Pharmacist Dashboard...');
            // Navigate directly on success
            setTimeout(() => {
                navigate('/dashboard/pharmacist'); 
            }, 1000);
        } else {
            setMessage('Error: Invalid credentials.');
        }
    }, 1500);
    // ------------------------
  };

  return (
    <div className="pharmacist-login-page">
        
      <button 
        onClick={() => navigate('/login-choice')} 
        className="back-button"
        aria-label="Go back to role selection"
      >
        <ArrowLeft className="back-button-icon" />
        <span className="back-button-text">Back to Role Selection</span>
      </button>

      <div className="login-box">
        <header className="login-header">
          <Stethoscope className="header-icon" />
          <h1 className="header-title">Pharmacist Login</h1>
          <p className="header-subtitle">Access your secure professional dashboard.</p>
        </header>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
//             required // You can comment this out for faster testing
              className="form-input"
              placeholder="pharmacy@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
// g           required // You can comment this out for faster testing
              className="form-input"
              placeholder="••••••••"
            />
          </div>
          
          {message && (
            <div className={`form-message ${message.startsWith('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
t           disabled={loading}
            className="submit-button"
          >
      {loading ? (
              <svg className="spinner" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
              'Log In'
            )}
          </button>
        </form>
        
        <div className="forgot-password-container">
        </div>
    _ </div>
    </div>
  );
};

export default PharmacistLoginPage;