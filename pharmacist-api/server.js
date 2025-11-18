// pharmacist-api/server.js

// --- 1. Import Dependencies ---
require('dotenv').config(); // Loads .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- 2. Initialize App & Middleware ---
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Allows your React frontend to call this API
app.use(express.json()); // Allows API to read JSON in request bodies

// --- 3. Database Connection ---
// Your .env file must have the full string:
// MONGO_URI=mongodb+srv://prabhat...<your_password>...@...mongodb.net/CityPulseDB?appName=CityPulseDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas (Pharmacist DB) Connected!"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// --- 4. Database Schemas (Models) ---
// This defines the structure of a single medicine in the inventory
const MedicineSchema = new mongoose.Schema({
  medicineName: { type: String, required: true },
  quantity: { type: Number, required: true },
  arrivedAt: { type: Date, default: Date.now }
}, { _id: false }); // <-- Fix to prevent sub-document IDs

// This defines the structure of the main pharmacy document
const PharmacySchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [longitude, latitude]
  },
  inventory: [MedicineSchema] // An array of medicines
});

// --- 5. Create Mongoose Model ---
// This tells Mongoose to use your "Pharmacy" schema and connect to the "medizap" collection
const Pharmacy = mongoose.model('Pharmacy', PharmacySchema, 'medizap');

// --- 6. API Routes (CRUD Operations) ---

/**
 * @route   POST /api/pharmacy
 * @desc    Create a new pharmacy
 */
app.post('/api/pharmacy', async (req, res) => {
  try {
    const { name, address, coordinates } = req.body;

    const newPharmacy = new Pharmacy({
      name,
      address,
      location: {
        type: 'Point',
        // Note: GeoJSON stores as [longitude, latitude]
        coordinates: [coordinates.longitude, coordinates.latitude] 
      },
      inventory: [] // Starts with an empty inventory
    });

    await newPharmacy.save();
    res.status(201).json(newPharmacy); // Send back the newly created pharmacy
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   GET /api/pharmacy/:id
 * @desc    Get a specific pharmacy's data by its ID
 */
app.get('/api/pharmacy/:id', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return res.status(404).json({ message: "Pharmacy not found in medizap collection" });
    }
    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   POST /api/pharmacy/:id/inventory
 * @desc    Add a new medicine to a specific pharmacy's inventory
 */
app.post('/api/pharmacy/:id/inventory', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });
    
    const newMedicine = {
      medicineName: req.body.medicineName,
      quantity: req.body.quantity
    };
    
    pharmacy.inventory.push(newMedicine); // Add the new medicine to the array
    await pharmacy.save(); // Save the parent document
    res.status(201).json(pharmacy); // Send back the updated pharmacy
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
* @route   PUT /api/pharmacy/:id/inventory/:medicineName
* @desc    Update a medicine's quantity (or other details)
*/
app.put('/api/pharmacy/:id/inventory/:medicineName', async (req, res) => {
  try {
    const { quantity } = req.body;
    // We decode the name from the URL (e.g., "Paracetamol%20500mg" -> "Paracetamol 500mg")
    const medicineName = decodeURIComponent(req.params.medicineName);
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });

    // Find the specific medicine within the inventory sub-array by its name
    const medicine = pharmacy.inventory.find(
      (item) => item.medicineName.toLowerCase() === medicineName.toLowerCase()
    );
    
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found in inventory" });
    }

    // Update the quantity
    medicine.quantity = quantity;
    
    await pharmacy.save();
    res.json(pharmacy);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @route   DELETE /api/pharmacy/:id/inventory/:medicineName
 * @desc    Remove a medicine from a pharmacy's inventory
 */
app.delete('/api/pharmacy/:id/inventory/:medicineName', async (req, res) => {
  try {
    const medicineName = decodeURIComponent(req.params.medicineName);
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: "Pharmacy not found" });

    // Find the index of the medicine to remove
    const itemIndex = pharmacy.inventory.findIndex(
      (item) => item.medicineName.toLowerCase() === medicineName.toLowerCase()
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Medicine not found in inventory" });
    }

    // Remove the item from the array
    pharmacy.inventory.splice(itemIndex, 1);
    
    await pharmacy.save();
    res.json(pharmacy); // Send back the updated pharmacy
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- 7. Start the Server ---
app.listen(PORT, () => {
  console.log(`Pharmacist API server running on http://localhost:${PORT}`);
});