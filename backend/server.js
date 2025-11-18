// backend/server.js

import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import medicineRoutes from "./routes/medicineRoutes.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------------- GEMINI SETUP AND UTILITIES ----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025"; 

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set!");
  process.exit(1);
}

/**
 * Utility function to handle API calls with exponential backoff.
 */
async function fetchWithBackoff(apiUrl, payload, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                return response.json();
            }

            // Retry on specific error codes (e.g., 429 Too Many Requests)
            if (response.status === 429 || response.status >= 500) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry
            }
            
            // For other client errors (4xx), throw immediately
            throw new Error(`API call failed with status ${response.status}: ${await response.text()}`);

        } catch (error) {
            if (attempt === maxRetries - 1) throw error; // Re-throw on last attempt
            // Delay for next retry
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// ---------------- MONGODB SETUP ----------------
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is not set!");
  process.exit(1);
}

mongoose.connect(mongoUri) 
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// ---------------- MONGOOSE SCHEMAS ----------------

// Define the sub-schema for inventory (matches pharmacist-api)
const MedicineSchema = new mongoose.Schema({
  medicineName: String,
  quantity: Number,
  arrivedAt: Date
}, { _id: false }); // This prevents Mongoose from adding _id to inventory items

const pharmacySchema = new mongoose.Schema({
  name: String,
  address: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
  },
  inventory: [MedicineSchema] // Use the new schema
});
pharmacySchema.index({ location: '2dsphere' });

// Explicitly tell Mongoose to use the "medizap" collection
const Pharmacy = mongoose.model('Pharmacy', pharmacySchema, 'medizap');


// ---------------- NEW: GEMINI REMINDER-EXTRACTION ENDPOINT ----------------
app.post('/api/extract-reminders', async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: "rawText is required." });

  const systemPrompt = `You are a precision medical-dosage-parser. Your task is to analyze the provided prescription text and extract all medicines and their corresponding dosage codes (e.g., '1 0 0', '0 1 0', '1 1 1').
  - The dosage code indicates (Morning, Noon, Night).
  - '1 0 0' means morning only.
  - '1 0 1' means morning and night.
  - '1 1 1' means morning, noon, and night.
  - You must return a structured JSON array.
  - ONLY return medicines that have a clear dosage code. Ignore all other text.`;
  
  const reminderSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        medicineName: { 
          type: "STRING", 
          description: "The name of the medicine, e.g., Amoxicillin, Paracetamol." 
        },
        dosageCode: { 
          type: "STRING", 
          description: "The 3-digit dosage code, e.g., '1 0 0', '0 1 0', '1 1 1'. Must be a string." 
        }
      },
      required: ["medicineName", "dosageCode"]
    },
    description: "A list of medicine and dosage-code objects."
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
      contents: [{ parts: [{ text: rawText }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: reminderSchema,
      }
  };

  try {
    const result = await fetchWithBackoff(apiUrl, payload);
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
      return res.status(500).json({ message: "Extraction failed: Gemini returned no data." });
    }

    const extractedData = JSON.parse(jsonText);
    
    if (!Array.isArray(extractedData)) {
      return res.status(500).json({ message: "Extraction failed: Data was not a valid list." });
    }

    res.json(extractedData); 

  } catch (error) {
    console.error("Gemini Reminder Extraction error:", error);
    res.status(500).json({ error: "Failed to extract reminders from text." });
  }
});

// ---------------- GEMINI CHAT ENDPOINT ----------------
app.post('/api/chat-gemini', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.status(400).json({ error: "Message is required." });

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{ parts: [{ text: userMessage }] }],
        tools: [{ "google_search": {} }], 
    };
    
    const result = await fetchWithBackoff(apiUrl, payload);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response text received.";

    res.json({ response: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to get response from Gemini API." });
  }
});

// ---------------- PHARMACY SEARCH ENDPOINT (COMBINED LOGIC) ----------------
app.post('/api/pharmacies/search', async (req, res) => {
  try {
    let { medicines, location, radiusMeters = 20000 } = req.body;
    let medicineList = [];

    // --- STEP 1: Handle Medicine Extraction if input is raw text ---
    if (typeof medicines === 'string') {
        const rawText = medicines;
        const systemPrompt = `You are an intelligent Medical Prescription Parser. Your task is to analyze the provided raw, unstructured text. Your SOLE purpose is to extract ONLY the names of the medicines (drug names) and return them as a clean, structured JSON array. Ignore all other text like patient names, addresses, dosages (Sig), days of supply, physician names, license numbers, and irrelevant headers. For example, if the text contains 'Amoxicillin 1 Cap Seven Days', you must return ['Amoxicillin'].`;
        
        const medicineSchema = {
            type: "ARRAY",
            items: {
                type: "STRING",
                description: "The name of the medicine, e.g., Amoxicillin, Paracetamol."
            },
            description: "A list of only the medicine names found in the text."
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: rawText }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: medicineSchema,
            }
        };

        const result = await fetchWithBackoff(apiUrl, payload);
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
             return res.status(500).json({ message: "Extraction failed: Gemini returned no medicine list." });
        }

        const extractedMedicines = JSON.parse(jsonText);
        
        if (!Array.isArray(extractedMedicines)) {
            return res.status(500).json({ message: "Extraction failed: Extracted data was not a valid list." });
        }

        medicineList = extractedMedicines;
        
    } else if (Array.isArray(medicines)) {
        medicineList = medicines;
    }

    // --- Step 2: Validate and Search ---
    if (medicineList.length === 0) {
      return res.status(400).json({ message: "No valid medicine names found for search." });
    }

    console.log("Searching MongoDB for medicines:", medicineList); 

    let nearbyQuery = {};
    if (location && location.lat && location.lng) {
      nearbyQuery = {
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [location.lng, location.lat],
            },
            $maxDistance: radiusMeters,
          },
        },
      };
    }

    // This query now correctly searches the 'medizap' collection
    const pharmacies = await Pharmacy.find(nearbyQuery).lean();

    const finalResults = {};
    for (const med of medicineList) { 
      const matches = [];
      for (const p of pharmacies) {
        // This 'find' logic will now find "crocin" and other new medicines
        const found = p.inventory.find(i =>
          i.medicineName.toLowerCase().includes(med.toLowerCase())
        );
        if (found) {
          matches.push({
            pharmacyName: p.name,
            address: p.address,
            distanceMeters: p.distanceMeters ?? null, 
            inventory: {
              quantity: found.quantity,
              arrivedAt: found.arrivedAt,
            },
          });
        }
      }
      finalResults[med] = matches;
    }

    res.json({ medicines: finalResults });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Error searching pharmacies or extracting medicines." });
  }
});


// ---------------- SERVER ROOT ----------------
app.get('/', (req, res) => res.send('Backend is running ✅'));

app.use("/api/medicines", medicineRoutes);

// ---------------- START SERVER ----------------
app.listen(port, () => console.log(`Server listening at http://localhost:${port}`));