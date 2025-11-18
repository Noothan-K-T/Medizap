// frontend/src/components/RegisterPharmacy.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, ArrowLeft } from 'lucide-react';
import '../styles/RegisterPharmacy.css'; // We will create this CSS

// This is the base URL for your API
const API_URL = 'http://localhost:5000/api/pharmacy';

const RegisterPharmacy = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          coordinates: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          }
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create pharmacy');
      }
      
      setMessage(`Success! Pharmacy "${data.name}" created.`);
      // Clear the form
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');

    } catch (err) {
      setLoading(false);
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="register-pharmacy-page">
      <button 
        onClick={() => navigate('/dashboard/pharmacist')} 
        className="back-to-dash-button"
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="register-box">
        <header className="register-header">
          <Building className="header-icon" />
          <h1 className="header-title">Register New Pharmacy</h1>
          <p className="header-subtitle">Add a new pharmacy to the database.</p>
        </header>

        <form onSubmit={handleRegister} className="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Pharmacy Name</label>
            <input
              id="name" type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              required className="form-input"
              placeholder="e.g., Apollo Health"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <input
              id="address" type="text" value={address}
              onChange={(e) => setAddress(e.target.value)}
              required className="form-input"
              placeholder="e.g., 456 Kothrud, Pune"
            />
          </div>

          <div className="coords-group">
            <div className="form-group">
              <label className="form-label" htmlFor="longitude">Longitude</label>
              <input
                id="longitude" type="text" value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required className="form-input"
                placeholder="e.g., 73.8080"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="latitude">Latitude</label>
              <input
                id="latitude" type="text" value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required className="form-input"
                placeholder="e.g., 18.5074"
              />
            </div>
          </div>
          
          {message && (
            <div className={`form-message ${message.startsWith('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Registering...' : 'Register Pharmacy'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPharmacy;