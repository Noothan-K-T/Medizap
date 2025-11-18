import mongoose from "mongoose";
import 'dotenv/config'; // Use ES Module style for dotenv config

// IMPORTANT: Ensure your .env file uses MONGO_URI, as defined in server.js
const uri = process.env.MONGO_URI; 

if (!uri) {
    console.error("MONGO_URI is not set in environment variables. Please check your .env file.");
    process.exit(1);
}

// Connect to MongoDB
// Note: We use the old syntax for connection here to ensure it works as a standalone script.
// In your server.js, you use the promise-based connection.
async function seedDatabase() {
    try {
        console.log("Attempting to connect to MongoDB...");
        await mongoose.connect(uri);
        console.log("✅ Connected to MongoDB Atlas for seeding.");
        
        // ---------------- MONGOOSE SCHEMAS ----------------
        const pharmacySchema = new mongoose.Schema({
            name: String,
            address: String,
            location: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: [Number], // [lng, lat]
            },
            inventory: [{
                medicineName: String,
                quantity: Number,
                arrivedAt: Date
            }]
        });
        pharmacySchema.index({ location: '2dsphere' }); // enables geospatial queries
        
        const Pharmacy = mongoose.model("Pharmacy", pharmacySchema);
        
        // ---------------- SEED DATA ----------------
        
        // 1. Clear existing data
        await Pharmacy.deleteMany({});
        console.log("Database cleared.");
        
        // 2. Insert sample data
        await Pharmacy.insertMany([
            {
                name: "CityCare Pharmacy",
                address: "123 MG Road, Pune",
                // Coordinates: [longitude, latitude]
                location: { type: "Point", coordinates: [73.8567, 18.5204] }, 
                inventory: [
                    { medicineName: "Paracetamol 500mg", quantity: 40, arrivedAt: new Date("2025-11-10") },
                    { medicineName: "Amoxicillin 250mg", quantity: 20, arrivedAt: new Date("2025-11-11") }
                ]
            },
            {
                name: "HealthPlus Chemist",
                address: "Main Street, Pune",
                location: { type: "Point", coordinates: [73.85, 18.52] },
                inventory: [
                    { medicineName: "Cetirizine 10mg", quantity: 50, arrivedAt: new Date("2025-11-12") }
                ]
            },
            {
                name: "Rimbo Local Pharmacy",
                address: "West Rimbo, Pune",
                location: { type: "Point", coordinates: [73.86, 18.53] },
                inventory: [
                    // Adding Amoxicillin here so search results will have a match
                    { medicineName: "Amoxicillin 250mg", quantity: 5, arrivedAt: new Date("2025-11-01") },
                    { medicineName: "Ibuprofen 400mg", quantity: 15, arrivedAt: new Date("2025-11-05") }
                ]
            }
        ]);

        console.log("✅ Sample pharmacies inserted.");
    } catch (error) {
        console.error("An error occurred during seeding:", error);
        process.exit(1); // Exit with error code
    } finally {
        // 3. Disconnect from the database
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

seedDatabase();