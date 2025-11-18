// frontend/src/components/PharmacistDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, LogOut, Pill, PlusSquare, Trash2, Edit, Building, CheckCircle } from 'lucide-react';
import '../styles/PharmacistDashboard.css'; // Your existing CSS

// --- 1. DEFINE YOUR PHARMACY IDs ---
const PHARMACY_IDS = {
  'CityCare Pharmacy': '69144e4c1a95212cc49d189f',
  'Apollo Health Pharmacy': '69144e4c1a95212cc49d189a', // Uncomment when this is in your DB
};

const API_URL = 'http://localhost:5000/api/pharmacy';

const PharmacistDashboard = () => {
  const navigate = useNavigate();
  
  // --- 2. STATE ---
  const [pharmaciesData, setPharmaciesData] = useState({});
  const [currentPharmacyId, setCurrentPharmacyId] = useState(Object.values(PHARMACY_IDS)[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMedicineName, setNewMedicineName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  // --- 3. DATA FETCHING LOGIC ---
  const fetchAllPharmacyData = async () => {
    try {
      setLoading(true);
      const pharmacyIDs = Object.values(PHARMACY_IDS);
      
      const responses = await Promise.all(
        pharmacyIDs.map(id => fetch(`${API_URL}/${id}`))
      );

      const failedResponse = responses.find(res => !res.ok);
      if (failedResponse) {
        throw new Error(`Failed to fetch: ${failedResponse.url} (status ${failedResponse.status})`);
      }

      const dataPromises = responses.map(res => res.json());
      const allPharmacies = await Promise.all(dataPromises);

      const dataMap = allPharmacies.reduce((acc, pharmacy) => {
        acc[pharmacy._id] = pharmacy;
        return acc;
      }, {});
      
      setPharmaciesData(dataMap);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setPharmaciesData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPharmacyData();
  }, []);

  // --- 4. CRUD FUNCTIONS ---
  // ... (handleAddItem, handleDeleteItem, handleUpdateItem are unchanged) ...
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/${currentPharmacyId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineName: newMedicineName,
          quantity: parseInt(newQuantity, 10)
        }),
      });
      setNewMedicineName('');
      setNewQuantity('');
      fetchAllPharmacyData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteItem = async (medicineName) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await fetch(`${API_URL}/${currentPharmacyId}/inventory/${encodeURIComponent(medicineName)}`, {
        method: 'DELETE',
      });
      fetchAllPharmacyData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateItem = async (medicineName) => {
    const newQuantityInput = window.prompt("Enter new quantity:");
    if (!newQuantityInput || isNaN(newQuantityInput)) return;
    try {
      await fetch(`${API_URL}/${currentPharmacyId}/inventory/${encodeURIComponent(medicineName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(newQuantityInput, 10) }),
      });
      fetchAllPharmacyData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => navigate('/login-choice');

  // --- 5. RENDER LOGIC ---
  const pharmacy = pharmaciesData[currentPharmacyId];

  const renderContent = () => {
    return (
      <>
        <div className="form-container">
          <h3>Add New Medicine</h3>
          <form onSubmit={handleAddItem} className="add-item-form">
            <input 
              type="text" 
              placeholder="Medicine Name" 
              value={newMedicineName} 
              onChange={(e) => setNewMedicineName(e.target.value)} 
              required 
            />
            <input 
              type="number" 
              placeholder="Quantity" 
              value={newQuantity} 
              onChange={(e) => setNewQuantity(e.target.value)} 
              required 
            />
            <button type="submit" className="form-submit-button">
              <PlusSquare size={18} /> Add
            </button>
          </form>
        </div>
        <h3>Current Inventory ({pharmacy.inventory.length} items)</h3>
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Quantity</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pharmacy.inventory.map((item) => (
              <tr key={item.medicineName}>
                <td>{item.medicineName}</td>
                <td>{item.quantity}</td>
                <td>{new Date(item.arrivedAt).toLocaleDateString()}</td>
                <td className="action-buttons">
                  <button onClick={() => handleUpdateItem(item.medicineName)} className="action-edit"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteItem(item.medicineName)} className="action-delete"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };

  // --- 6. NEW RETURN STRUCTURE ---
  return (
    <div className="dashboard-layout top-bar-layout"> {/* Added new class */}
      
      {/* --- NEW TOP NAVIGATION BAR --- */}
      <nav className="top-bar">
        <div className="top-bar-brand">
          <Pill className="top-bar-logo" />
          <h2 className="top-bar-title">Medizap</h2>
        </div>
        <div className="top-bar-nav">
          <Link to="/dashboard/pharmacist" className="top-bar-link active">
            <LayoutDashboard size={16} />
            <span>Inventory</span>
          </Link>
          
        </div>
        <div className="top-bar-user">
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </nav>

      {/* --- Main Content (Unchanged) --- */}
      <main className="main-content">
        
        <header className="main-header">
          <div className="header-title-group">
            <h1>{pharmacy ? pharmacy.name : 'Loading...'}</h1>
            <span className="header-address">{pharmacy ? pharmacy.address : ''}</span>
          </div>
          
          <div className="pharmacy-selector-group">
            {Object.entries(PHARMACY_IDS).map(([name, id]) => (
              <button
                key={id}
                className={`pharmacy-select-button ${id === currentPharmacyId ? 'active' : ''}`}
                onClick={() => setCurrentPharmacyId(id)}
              >
                <CheckCircle size={14} />
                {name}
              </button>
            ))}
          </div>
        </header>
        
        <div className="content-area">
          {loading && <div className="placeholder-content">Loading Pharmacies...</div>}
          {error && <div className="placeholder-content error-text">{error} (Check API/DB)</div>}
          {!loading && !error && pharmacy && renderContent()}
          {!loading && !error && !pharmacy && <div className="placeholder-content">Could not load pharmacy data.</div>}
        </div>
      </main>
    </div>
  );
};

export default PharmacistDashboard;