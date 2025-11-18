// src/features/UploadPrescription.jsx
import React, { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
// We must assume this component can also get the context
// If this isn't true, you'll need to pass 'addReminder' down as a prop
import { useOutletContext } from 'react-router-dom'; 

// ... existing styles ...
// --- Injected Styles ---
// Re-adding inline styles to fix compilation errors
const styles = {
  uploadPrescriptionContainer: {
    maxWidth: '800px',
    margin: '40px auto',
    padding: '30px',
    backgroundColor: '#f8f9fa', // var(--secondary-bg)
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)', // var(--shadow-color)
    color: '#212529', // var(--text-primary)
    fontFamily: "'Inter', sans-serif",
  },
  pageTitle: {
    fontSize: '2.2rem',
    fontWeight: 700,
    color: '#007bff', // var(--accent-color)
    textAlign: 'center',
    marginBottom: '20px',
  },
  pageDescription: {
    fontSize: '1rem',
    color: '#5a6168', // var(--text-secondary)
    textAlign: 'center',
    marginBottom: '30px',
    lineHeight: 1.6,
  },
  uploadSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '25px',
    border: '2px dashed #dee2e6', // var(--border-color)
    borderRadius: '10px',
    backgroundColor: '#fdfdff', // var(--tertiary-bg)
    marginBottom: '30px',
  },
  fileInput: {
    display: 'none',
  },
  fileInputLabel: {
    display: 'inline-block',
    padding: '12px 25px',
    backgroundColor: '#007bff', // var(--accent-color)
    color: 'white',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '1rem',
    transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 10px hsla(210, 80%, 55%, 0.3)',
  },
  imagePreview: {
    marginTop: '15px',
    textAlign: 'center',
    maxWidth: '100%',
  },
  imagePreviewImg: {
    maxWidth: '100%',
    height: 'auto',
    maxHeight: '250px',
    borderRadius: '8px',
    border: '1px solid #dee2e6', // var(--border-color)
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  fileName: {
    fontSize: '0.9rem',
    color: '#5a6168', // var(--text-secondary)
    marginTop: '10px',
    wordBreak: 'break-all',
  },
  convertButton: {
    padding: '15px 30px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    fontSize: '1.1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 6px 15px rgba(40, 167, 69, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  locationButton: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#5c6ac4',
    color: 'white',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  errorMessage: {
    color: '#dc3545', // var(--error-color)
    backgroundColor: 'hsla(0, 80%, 60%, 0.1)',
    border: '1px solid #dc3545', // var(--error-color)
    padding: '15px',
    borderRadius: '8px',
    marginTop: '25px',
    textAlign: 'center',
    fontWeight: 500,
  },
  successMessage: {
    color: '#155724', // var(--success-color)
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '25px',
    textAlign: 'center',
    fontWeight: 500,
  },
  convertedTextSection: {
    marginTop: '40px',
    borderTop: '1px solid #dee2e6', // var(--border-color)
    paddingTop: '30px',
  },
  convertedTextSectionH3: {
    fontSize: '1.6rem',
    fontWeight: 600,
    color: '#007bff', // var(--accent-color)
    marginBottom: '15px',
    textAlign: 'center',
  },
  convertedTextOutput: {
    width: '100%',
    padding: '15px',
    border: '1px solid #dee2e6', // var(--border-color)
    borderRadius: '8px',
    backgroundColor: '#f1f3f5', // var(--primary-bg-dark)
    color: '#212529', // var(--text-primary)
    fontFamily: "'monospace', sans-serif",
    fontSize: '0.95rem',
    lineHeight: 1.5,
    minHeight: '150px',
    resize: 'vertical',
    boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box', // Added for better padding behavior
  },
  loadingSpinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '50%',
    borderTopColor: '#333',
    animation: 'spin 1s linear infinite',
    marginRight: '8px',
    verticalAlign: 'middle',
  },
  smallSpinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#fff',
    // animation is inherited from .loading-spinner if combined, but we'll add it here for clarity
    animation: 'spin 1s linear infinite', 
  },
};

// Inject keyframes for spinner
const keyframes = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = keyframes;
document.head.appendChild(styleSheet);
// --- End Injected Styles ---


/**
 * NEW HELPER FUNCTION
 * A client-side version of fetchWithBackoff to handle retries for 429/5xx errors.
 */
async function fetchWithBackoff(url, options, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response.json(); // Success
      }

      // Retry on 429 (Too Many Requests) or 5xx (Server Error)
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[fetchWithBackoff] Attempt ${attempt + 1} failed with status ${response.status}. Retrying in ${Math.pow(2, attempt)}s...`);
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Go to the next attempt
      }

      // For other client errors (4xx), parse and throw immediately
      const errorData = await response.json().catch(() => ({}));
      // Use 'detail' for FastAPI errors, 'message' for standard/backend errors
      throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);

    } catch (error) {
      // If this was a network error (not a response error), retry
      console.warn(`[fetchWithBackoff] Attempt ${attempt + 1} failed with error: ${error.message}. Retrying...`);
      if (attempt === maxRetries - 1) throw error; // Re-throw on last attempt
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to fetch after multiple retries.");
}


const UploadPrescription = () => {
  const [file, setFile] = useState(null);
  const [base64Image, setBase64Image] = useState('');
  const [extractedText, setExtractedText] = useState('');
  // const [loading, setLoading] = useState(false); // This state was unused
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // const [medicines, setMedicines] = useState([]); // REMOVED: Local extraction is unreliable
  const [searchResults, setSearchResults] = useState(null); // will hold API results
  const [searchLoading, setSearchLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [reminderLoading, setReminderLoading] = useState(false); // New state for reminder creation
  const auth = getAuth();

  // ***** NEW *****
  // We assume UploadPrescription and RemindersPage are siblings under 
  // a parent Layout that provides this context.
  // This is the *only* way this component can add reminders.
  const { addReminder } = useOutletContext() || {}; 
  // The '|| {}' prevents a crash if context is not found

  // File handling + base64 read
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setMessage('');
      setExtractedText('');
      // setMedicines([]); // REMOVED
      setSearchResults(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Image(reader.result);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setBase64Image('');
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null);
      setBase64Image('');
      setExtractedText('');
    }
  };

  // OCR call
  const handleOcrProcess = useCallback(async () => {
    if (!base64Image) {
      setError("Please select an image file first.");
      return;
    }

    setOcrLoading(true);
    setError('');
    setMessage('');
    // setMedicines([]); // REMOVED
    setSearchResults(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated. Please log in.");
      const idToken = await user.getIdToken();

      // MODIFIED: Use the new fetchWithBackoff function
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ image_base64: base64Image }),
      };

      // This now automatically handles 429 retries
      const data = await fetchWithBackoff('http://localhost:8000/ocr/handwritten-text', options);
      
      // The !response.ok checks are no longer needed, as fetchWithBackoff handles it

      const text = data.extracted_text || '';
      setExtractedText(text);
      
      // MODIFIED: Simplified message
      setMessage('Text extracted successfully! You can now edit the text or search pharmacies.');

    } catch (err) {
      console.error('Error during OCR process:', err);
      // The error message from fetchWithBackoff will be more informative
      setError(`Failed to convert image to text: ${err.message}.`);
      setExtractedText('');
    } finally {
      setOcrLoading(false);
    }
  }, [base64Image, auth]);

  // simple UI helper: ask for browser geolocation (non-blocking)
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser does not support geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMessage('Location captured.');
      },
      (err) => {
        console.warn('Geolocation error', err);
        setError('Unable to get location. You can still search without a location.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  // call backend to search pharmacies
  // MODIFIED: This function now sends the RAW extractedText string
  const searchPharmacies = async () => {
    // MODIFIED: Check for extractedText, not the 'medicines' array
    if (!extractedText.trim()) {
      setError('No extracted text to search. Please convert an image first.');
      return;
    }

    setSearchLoading(true);
    setSearchResults(null);
    setError('');
    setMessage('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated.');
      const idToken = await user.getIdToken();

      // MODIFIED: The body now sends the raw string.
      // Your backend server.js is already built to handle this!
      const body = {
        medicines: extractedText, // <-- THE FIX: Send the raw text
        location: userLocation, // optional
        radiusMeters: 20000 // 20km search radius default
      };

      // MODIFIED: Use the new fetchWithBackoff function
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      };

      // This now automatically handles 429/5xx retries
      const data = await fetchWithBackoff('http://localhost:3001/api/pharmacies/search', options);

      // The !resp.ok check is no longer needed

      setSearchResults(data); // expected shape described below
    } catch (err) {
      console.error('Search error', err);
      setError(err.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  // ***** NEW FUNCTION *****
  // This handles calling the new backend endpoint and creating reminders
  const handleCreateReminders = async () => {
    if (!extractedText.trim()) {
      setError('No extracted text. Please convert an image first.');
      return;
    }
    if (!addReminder) {
      setError('Error: addReminder function is not available from context.');
      console.error("UploadPrescription.jsx cannot find 'addReminder' in useOutletContext.");
      return;
    }

    setReminderLoading(true);
    setError('');
    setMessage('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated.');
      const idToken = await user.getIdToken();

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ rawText: extractedText }),
      };
      
      // Call the NEW endpoint
      const extractedData = await fetchWithBackoff('http://localhost:3001/api/extract-reminders', options);

      if (!Array.isArray(extractedData) || extractedData.length === 0) {
        setMessage('No specific medicine dosages (e.g., "1 0 0") were found in the text.');
        setReminderLoading(false);
        return;
      }

      // We have data, e.g., [{ medicineName: "Amox", dosageCode: "1 0 1" }]
      const today = new Date();
      let remindersCreatedCount = 0;

      for (const item of extractedData) {
        const { medicineName, dosageCode } = item;
        const times = mapDosageToTimes(dosageCode, today); // Helper to get Date objects

        for (const time of times) {
          const reminderData = {
            title: `Medication: ${medicineName}`,
            message: `Take your dose (${dosageCode}).`,
            dateTime: time,
            recurrence: 'daily', // This is the new field!
            isDismissed: false,
          };
          
          await addReminder(reminderData); // Add to Firebase
          remindersCreatedCount++;
        }
      }

      setMessage(`Successfully created ${remindersCreatedCount} daily reminders!`);

    } catch (err) {
      console.error('Reminder creation error', err);
      setError(err.message || 'Failed to create reminders.');
    } finally {
      setReminderLoading(false);
    }
  };

  // ***** NEW HELPER FUNCTION *****
  // Maps "1 0 0" to today at 8:00 AM, etc.
  const mapDosageToTimes = (dosageCode, startDate) => {
    const times = [];
    const [morning, noon, night] = dosageCode.split(' ').map(Number); // "1 0 0" -> [1, 0, 0]

    const baseDate = new Date(startDate); // Use today as the base

    // Set time for 8:00 AM
    if (morning === 1) {
      const morningDate = new Date(baseDate);
      morningDate.setHours(8, 0, 0, 0); // 8:00:00.000
      // If 8am has already passed today, set it for tomorrow
      if (morningDate.getTime() < Date.now()) {
        morningDate.setDate(morningDate.getDate() + 1);
      }
      times.push(morningDate);
    }

    // Set time for 1:00 PM
    if (noon === 1) {
      const noonDate = new Date(baseDate);
      noonDate.setHours(13, 0, 0, 0); // 1:00 PM
      if (noonDate.getTime() < Date.now()) {
        noonDate.setDate(noonDate.getDate() + 1);
      }
      times.push(noonDate);
    }

    // Set time for 8:00 PM
    if (night === 1) {
      const nightDate = new Date(baseDate);
      nightDate.setHours(20, 0, 0, 0); // 8:00 PM
      if (nightDate.getTime() < Date.now()) {
        nightDate.setDate(nightDate.getDate() + 1);
      }
      times.push(nightDate);
    }
    
    return times;
  };


  // --- UI (Switched to inline styles) ---
  return (
    <div style={styles.uploadPrescriptionContainer}>
      <h1 style={styles.pageTitle}>Upload Prescription or Handwritten Notes</h1>
      <p style={styles.pageDescription}>
        Upload an image and then convert to text. After extraction you can search for nearby pharmacies stocking the medicine.
      </p>

      <div style={styles.uploadSection}>
        <label htmlFor="file-upload" style={styles.fileInputLabel}>Choose Image File (JPG, PNG)</label>
        <input id="file-upload" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} disabled={ocrLoading || searchLoading} style={styles.fileInput}/>
        
        {base64Image && (
          <div style={styles.imagePreview}>
            <img src={base64Image} alt="Preview" style={styles.imagePreviewImg} />
            {file && <p style={styles.fileName}>Selected: {file.name}</p>}
          </div>
        )}
        
        <button 
          onClick={handleOcrProcess} 
          style={{...styles.convertButton, opacity: (ocrLoading || !base64Image) ? 0.7 : 1}}
          disabled={ocrLoading || !base64Image}
        >
          {ocrLoading ? <><div style={{...styles.loadingSpinner, ...styles.smallSpinner}}></div> Processing...</> : 'Convert to Text'}
        </button>
      </div>

      {/* Location button is separate from the upload section now */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button onClick={requestLocation} style={styles.locationButton}>Allow Location</button>
      </div>


      {message && <div style={styles.successMessage}>{message}</div>}
      {error && <div style={styles.errorMessage}>{error}</div>}

      {/* MODIFIED: The "Re-detect" button is gone, as it's no longer needed. */}
      {/* Wrapper added to match CSS structure */}
      {extractedText !== '' && (
        <div style={styles.convertedTextSection}>
          <h3 style={styles.convertedTextSectionH3}>Extracted Text (Editable)</h3>
          <textarea style={styles.convertedTextOutput} value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows="8"></textarea>
        </div>
      )}

      {/* REMOVED: The entire "Detected Medicines" section is gone. */}

      {/* MODIFIED: This button now searches using the raw text */}
      <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <button 
          onClick={searchPharmacies} 
          disabled={searchLoading || extractedText.trim().length === 0} 
          style={{...styles.convertButton, opacity: (searchLoading || extractedText.trim().length === 0) ? 0.7 : 1}} // Using same style as convert button
        >
          {searchLoading ? <><div style={{...styles.loadingSpinner, ...styles.smallSpinner}}></div> Searching...</> : 'Search Nearby Pharmacies'}
        </button>

        {/* ***** NEW BUTTON ***** */}
        <button
          onClick={handleCreateReminders}
          disabled={reminderLoading || extractedText.trim().length === 0 || !addReminder}
          style={{...styles.convertButton, backgroundColor: '#007bff', opacity: (reminderLoading || extractedText.trim().length === 0 || !addReminder) ? 0.7 : 1}}
        >
          {reminderLoading ? <><div style={{...styles.loadingSpinner, ...styles.smallSpinner}}></div> Creating...</> : 'Create Reminders from Text'}
        </button>
      </div>
      {!addReminder && (
        <p style={{textAlign: 'center', color: '#dc3545', fontSize: '12px', marginTop: '10px'}}>
          Reminder creation is disabled (Context not found).
        </p>
      )}

      {/* Search results (This section was already correct, but inline styles are kept as CSS doesn't cover it) */}
      {searchResults && (
        <div style={{ marginTop: 20 }}>
          <h2>Search Results</h2>
          {Object.keys(searchResults.medicines || {}).length === 0 && <p>No results found for the detected medicines.</p>}
          {Object.entries(searchResults.medicines || {}).map(([med, entries]) => (
            <div key={med} style={{ marginBottom: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <h4>{med}</h4>
              
              {entries.length === 0 && (
                <p style={{ fontSize: 14, color: '#555' }}>No pharmacies found stocking this medicine.</p>
              )}

              {entries.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 6 }}>Pharmacy</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>Address</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>Distance (m)</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>Qty</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>Arrived</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: 6 }}>{e.pharmacyName}</td>
                        <td style={{ padding: 6 }}>{e.address}</td>
                        <td style={{ padding: 6 }}>{e.distanceMeters === null ? 'N/A' : Math.round(e.distanceMeters)}</td>
                        <td style={{ padding: 6 }}>{e.inventory?.quantity ?? '-'}</td>
                        <td style={{ padding: 6 }}>{e.inventory?.arrivedAt ? new Date(e.inventory.arrivedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadPrescription;