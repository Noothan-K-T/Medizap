from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os
import pandas as pd
import re
import base64
from PIL import Image
import io
import requests
import json # Ensure json is imported for json.loads (reading from env var)

# NEW: Firebase Admin SDK Imports
import firebase_admin
from firebase_admin import credentials, firestore, auth

# --- CORS middleware (keep this as is) ---
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:3000", # For local React development (Create React App default)
    "http://localhost:5173", # For local React development (Vite/other setups)
    "https://your-medizap-webapp-domain.com", # Your deployed React app domain - IMPORTANT: Replace with your actual deployed frontend URL
]

app = FastAPI(
    title="Medizap Medical Data API (CSV Retrieval & Firestore)",
    description="API for Medizap chatbot, retrieving information from 'book1.csv' and storing chat history in Firestore. Now with News!",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- END CORS middleware ---


# --- Global variables for Firebase, DataFrame, and API Keys ---
db_firestore = None # Firestore client
medical_data_df = None
CSV_FILE_NAME = "book1.csv"
APP_ID = os.environ.get("APP_ID", "default-medizap-app")
NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "4f30447ac575407ab4ddc687060d8677") # Now with default value from friend's file
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "") # NEW: For Gemini API


@app.on_event("startup")
async def load_medical_data_and_initialize_firebase():
    """
    Load the medical data CSV and initialize Firebase Admin SDK on application startup.
    Firebase service account key is expected as a JSON string in FIREBASE_SERVICE_ACCOUNT_KEY env var.
    """
    global medical_data_df, db_firestore

    # --- Initialize Firebase Admin SDK ---
    print("--- Initializing Firebase Admin SDK ---")
    firebase_service_account_key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")

    if not firebase_service_account_key_path:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_KEY_PATH environment variable not set. Firestore will not be initialized.")
    elif not os.path.exists(firebase_service_account_key_path):
        print(f"ERROR: Firebase service account key file not found at: {firebase_service_account_key_path}. Firestore will not be initialized.")
    else:
        try:
            # Load the service account key from the file path
            cred = credentials.Certificate(firebase_service_account_key_path)
            
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db_firestore = firestore.client()
            print("Firebase Admin SDK initialized successfully and Firestore client obtained.")
        except Exception as e:
            print(f"ERROR: Failed to initialize Firebase Admin SDK from file: {e}. Firestore client will not be available.")
            db_firestore = None

    # --- Load Medical Data CSV ---
    csv_path = os.path.join(os.path.dirname(__file__), CSV_FILE_NAME)
    print(f"--- Application Startup: Loading Medical Data from CSV ---")
    print(f"Attempting to load CSV from: {csv_path}")

    encodings_to_try = ['utf-8', 'latin1', 'cp1252', 'ISO-8859-1']
    loaded_successfully = False
    last_error = None

    for encoding in encodings_to_try:
        try:
            print(f"Trying to load CSV with encoding: '{encoding}' and separator ',' (skipping bad lines).")
            medical_data_df = pd.read_csv(csv_path, encoding=encoding, sep=',', on_bad_lines='skip')
            
            if not medical_data_df.empty and all(col in medical_data_df.columns for col in ['Disease', 'Description', 'Symptoms', 'Medicines']):
                loaded_successfully = True
                print(f"Successfully loaded {len(medical_data_df)} records from '{CSV_FILE_NAME}' using encoding '{encoding}'.")
                break
            else:
                print(f"Loaded with encoding '{encoding}' but DataFrame structure is unexpected or empty. Trying next combination.")
                medical_data_df = None
                continue
        except (UnicodeDecodeError, pd.errors.ParserError) as e:
            last_error = e
            print(f"Failed to load with encoding '{encoding}': {e}")
            medical_data_df = None
            continue
        except FileNotFoundError:
            last_error = FileNotFoundError(f"'{CSV_FILE_NAME}' not found at '{csv_path}'.")
            loaded_successfully = False
            break
        except Exception as e:
            last_error = e
            print(f"An unexpected error occurred while loading with encoding '{encoding}': {e}")
            loaded_successfully = False
            break

    if not loaded_successfully:
        print("All attempted loading combinations failed. Falling back to a dummy DataFrame.")
        medical_data_df = pd.DataFrame(
            columns=['Disease', 'Description', 'Symptoms', 'Medicines'],
            data=[
                ['common cold', 'a viral infection of the nose and throat', 'runny nose, sore throat, cough', 'pain relievers, decongestants'],
                ['influenza', 'a contagious respiratory illness caused by flu viruses', 'fever, body aches, cough, fatigue', 'antivirals, rest'],
                ['dummy disease', 'this is a dummy description for a missing CSV', 'dummy symptom 1, dummy symptom 2', 'dummy medicine']
            ]
        )
        if isinstance(last_error, FileNotFoundError):
             raise FileNotFoundError(f"Critical: '{CSV_FILE_NAME}' not found at '{csv_path}'. Check file path and name. ({last_error})")
        else:
            print(f"Warning: Failed to load medical data from '{CSV_FILE_NAME}' with any tried encoding/separator. Using dummy data. Last error: {last_error}")

    if not medical_data_df.empty and 'Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] != 'dummy disease':
        temp_df = medical_data_df.copy()
        for col in ['Disease', 'Description', 'Symptoms', 'Medicines']:
            if col in temp_df.columns:
                temp_df[col] = temp_df[col].astype(str).fillna('').str.lower()
            else:
                print(f"Warning: Column '{col}' not found in '{CSV_FILE_NAME}'. This column will not be used for lookup/display.")
        medical_data_df = temp_df
        print(f"Available columns after preprocessing: {medical_data_df.columns.tolist()}")
    elif not medical_data_df.empty and ('Disease' not in medical_data_df.columns or medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        print(f"Info: Using dummy data or 'Disease' column not found in '{CSV_FILE_NAME}'. Subsequent operations might be limited.")


# --- Helper function to save chat history to Firestore ---
async def save_chat_history(user_id: str, query: str, response: dict, api_endpoint: str):
    """Saves a chat interaction to Firestore."""
    if db_firestore is None:
        print("Firestore client not initialized. Cannot save chat history.")
        return

    try:
        collection_ref = db_firestore.collection('artifacts').document(APP_ID).collection('users').document(user_id).collection('chat_history')

        chat_entry = {
            "user_id": user_id,
            "query": query,
            "response": response, # Store the full response from the API
            "api_endpoint": api_endpoint,
            "timestamp": firestore.SERVER_TIMESTAMP # Firestore automatically sets server timestamp
        }
        await collection_ref.add(chat_entry) # Use add() for auto-generated document ID
        print(f"Chat history saved for user {user_id} to Firestore.")
    except Exception as e:
        print(f"Error saving chat history to Firestore for user {user_id}: {e}")


# --- Authentication Dependency ---
async def get_current_user_id(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    
    id_token = auth_header.split("Bearer ")[1] if "Bearer " in auth_header else None
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token not found in Authorization header"
        )

    if db_firestore is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK not initialized. Cannot authenticate."
        )

    try:
        # Verify the ID token using Firebase Admin SDK
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        # print(f"User authenticated: UID={uid}") # Commented to reduce log spam
        return uid
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}"
        )


# --- Define Input/Output Pydantic Models ---
class TextInput(BaseModel):
    text: str

# Pydantic Model for Base64 Image Input
class ImageInput(BaseModel):
    image_base64: str # Expects data URL like "data:image/png;base64,..."

# Pydantic Model for OCR Response (ADDED THIS)
class OCRResponse(BaseModel):
    extracted_text: str
    message: str = "OCR process completed."
    disclaimer: str = "OCR results may contain errors. Always verify critical information manually, especially for medical prescriptions."

class MedicalInfo(BaseModel):
    Disease: str
    Description: str
    Symptoms: str
    Medicines: str

class MedicalResponse(BaseModel):
    results: list[MedicalInfo]
    message: str = "Query successful."
    disclaimer: str = "This information is for general knowledge and informational purposes only, and does not constitute medical advice. Always consult a qualified healthcare professional for diagnosis and treatment."

# Pydantic models for News API Response (Copied from friend's file)
class NewsArticle(BaseModel):
    source_name: str | None = None
    author: str | None = None
    title: str
    description: str | None = None
    url: str
    url_to_image: str | None = None
    published_at: str | None = None
    content: str | None = None

class NewsResponse(BaseModel):
    articles: list[NewsArticle]
    total_results: int
    message: str = "News fetched successfully."
    disclaimer: str = "News articles are provided for informational purposes only and do not constitute medical advice. Please verify information from reliable sources."


# --- Define API Endpoints ---

@app.get("/")
async def root():
    data_status = f"Data loaded from '{CSV_FILE_NAME}'."
    if medical_data_df is not None and not medical_data_df.empty and ('Disease' not in medical_data_df.columns or medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        data_status = "Using dummy data due to CSV loading errors."
    firebase_status = "Firestore initialized." if db_firestore else "Firestore NOT initialized."
    news_api_status = "NewsAPI key present." if NEWS_API_KEY else "NewsAPI key missing. News endpoint will not function."
    return {"message": f"Medizap Medical Data API is running. {data_status} {firebase_status} {news_api_status} Use /predict-symptoms, /predict-disease, or /news endpoints for queries."}


@app.post("/predict-symptoms", response_model=MedicalResponse)
async def get_disease_info_by_disease_name(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Retrieves detailed information for a given disease name and saves interaction.
    """
    if medical_data_df is None or medical_data_df.empty or ('Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        response = MedicalResponse(
            results=[],
            message="Data is not available. The server is using dummy data. Please check server logs for CSV loading errors.",
            disclaimer="This response is from dummy data due to a file loading issue. Please consult a qualified healthcare professional for actual medical advice."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-symptoms") # Save interaction
        return response
    
    query_text_lower = input_data.text.strip().lower()
    matching_rows = medical_data_df[
        medical_data_df['Disease'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False)
    ]
    
    if matching_rows.empty:
        matching_rows = medical_data_df[
            medical_data_df['Description'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False) |
            medical_data_df['Symptoms'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False)
        ]
        
    if matching_rows.empty:
        response = MedicalResponse(
            results=[], 
            message=f"No information found for '{input_data.text}'. Please try a different disease name or keyword."
        )
    else:
        results_data = matching_rows.head(5).to_dict(orient='records') 
        formatted_results = [
            MedicalInfo(
                Disease=row['Disease'].title(), 
                Description=row['Description'].capitalize(),
                Symptoms=row['Symptoms'].capitalize(),
                Medicines=row['Medicines'].capitalize()
            ) for row in results_data
        ]
        response = MedicalResponse(
            results=formatted_results, 
            message=f"Found information related to '{input_data.text}':"
        )
    
    await save_chat_history(user_id, input_data.text, response.dict(), "/predict-symptoms") # Save interaction
    return response


@app.post("/predict-disease", response_model=MedicalResponse)
async def get_disease_by_symptoms(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Retrieves diseases and their information that are associated with the given symptoms and saves interaction.
    """
    if medical_data_df is None or medical_data_df.empty or ('Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        response = MedicalResponse(
            results=[],
            message="Data is not available. The server is using dummy data. Please check server logs for CSV loading errors.",
            disclaimer="This response is from dummy data due to a file loading issue. Please consult a qualified healthcare professional for actual medical advice."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease") # Save interaction
        return response
    
    input_symptoms_list = [s.strip().lower() for s in input_data.text.split(',') if s.strip()]

    if not input_symptoms_list:
        response = MedicalResponse(
            results=[], 
            message="Please provide some symptoms to search for diseases."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease") # Save interaction
        return response

    combined_filter = pd.Series([False] * len(medical_data_df), index=medical_data_df.index)
    for symptom in input_symptoms_list:
        symptom_pattern = r'\b' + re.escape(symptom) + r'\b'
        symptom_filter = medical_data_df['Symptoms'].str.contains(symptom_pattern, regex=True, na=False)
        combined_filter = combined_filter | symptom_filter

    matching_rows = medical_data_df[combined_filter].copy()
    
    if matching_rows.empty:
        response = MedicalResponse(
            results=[], 
            message=f"No diseases found matching the symptoms: '{input_data.text}'. Please try different symptoms or keywords."
        )
    else:
        matching_rows['match_count'] = matching_rows['Symptoms'].apply(
            lambda s: sum(1 for symp in input_symptoms_list if re.search(r'\b' + re.escape(symp) + r'\b', s, re.IGNORECASE))
        )
        matching_rows = matching_rows.sort_values(by=['match_count', 'Disease'], ascending=[False, True])
        results_data = matching_rows.head(5).to_dict(orient='records') 
        formatted_results = [
            MedicalInfo(
                Disease=row['Disease'].title(),
                Description=row['Description'].capitalize(),
                Symptoms=row['Symptoms'].capitalize(),
                Medicines=row['Medicines'].capitalize()
            ) for row in results_data
        ]
        response = MedicalResponse(
            results=formatted_results, 
            message=f"Diseases potentially related to '{input_data.text}':"
        )
    
    await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease") # Save interaction
    return response

# NEW ENDPOINT: OCR for Handwritten Text - NOW USES GEMINI API
@app.post("/ocr/handwritten-text", response_model=OCRResponse)
async def ocr_handwriting(input_data: ImageInput, user_id: str = Depends(get_current_user_id)):
    """
    Receives a Base64 encoded image, sends it to Gemini API for OCR,
    and returns the extracted text.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_API_KEY environment variable not set. Cannot perform OCR."
        )

    image_data_url = input_data.image_base64
    
    # Extract Base64 part and decode
    try:
        # Data URL format: data:<mime type>;base64,<data>
        header, encoded_data = image_data_url.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        
        # Validate mime type (Gemini only supports image/jpeg, image/png, image/webp, image/heic, image/heif)
        if not mime_type.startswith("image/"):
            raise ValueError(f"Unsupported MIME type: {mime_type}. Only image types are accepted.")

        # No need to decode to bytes then re-encode, just send the base64 string directly
        # for `inlineData.data` in the Gemini payload.
        base64_only_data = encoded_data # This is the pure base64 string without data:image/png;base64,
        
        # Optional: Verify image using Pillow if you want to perform checks like size/corruptness
        # try:
        #     image_bytes = base64.b64decode(base64_only_data)
        #     Image.open(io.BytesIO(image_bytes))
        # except Exception as e:
        #     raise ValueError(f"Invalid or corrupted image data: {e}")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Base64 image format or unsupported type: {e}. Expected 'data:image/...;base64,...'"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {e}"
        )

    # --- Gemini API Call for OCR ---
    gemini_api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}"
    
    prompt = "Extract all readable text from this image, focusing on any handwritten notes or prescription details. Provide the text clearly, preserving line breaks and original formatting as much as possible."

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    { "text": prompt },
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_only_data
                        }
                    }
                ]
            }
        ]
    }

    try:
        print("Calling Gemini API for OCR...")
        gemini_response = requests.post(
            gemini_api_url, 
            headers={'Content-Type': 'application/json'}, 
            data=json.dumps(payload)
        )
        gemini_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        gemini_result = gemini_response.json()

        extracted_text = ""
        if gemini_result.get('candidates') and len(gemini_result['candidates']) > 0 and \
           gemini_result['candidates'][0].get('content') and \
           gemini_result['candidates'][0]['content'].get('parts') and \
           len(gemini_result['candidates'][0]['content']['parts']) > 0:
            extracted_text = gemini_result['candidates'][0]['content']['parts'][0].get('text', '')
            print(f"Gemini OCR result (first 100 chars): {extracted_text[:100]}...")
        else:
            print("Gemini API response structure unexpected or empty content.")
            extracted_text = "Could not extract text. Gemini API returned an unexpected response."

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error calling Gemini API: {http_err} - Response: {gemini_response.text}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini API error: {http_err.response.text}"
        )
    except requests.exceptions.RequestException as req_err:
        print(f"Request error calling Gemini API: {req_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not connect to Gemini API: {req_err}"
        )
    except Exception as e:
        print(f"An unexpected error occurred during Gemini OCR: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during OCR processing: {e}"
        )

    response_data = {"extracted_text": extracted_text}
    
    # Save OCR interaction to Firestore
    await save_chat_history(user_id, "OCR Request (Image Upload)", response_data, "/ocr/handwritten-text")

    return OCRResponse(extracted_text=extracted_text)


# NEW ENDPOINT: Fetch daily news related to health/medicine (Copied from friend's file)
@app.get("/news", response_model=NewsResponse)
async def get_daily_news(user_id: str = Depends(get_current_user_id), query: str = "health OR medicine OR disease", pageSize: int = 10):
    """
    Fetches daily news related to health, medicine, or diseases.
    """
    if not NEWS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="News API Key is not configured on the server. Cannot fetch news."
        )

    news_api_url = "https://newsapi.org/v2/everything"
    params = {
        "q": query, # Search query
        "sortBy": "publishedAt", # Sort by most recent
        "language": "en", # English language articles
        "pageSize": pageSize, # Number of articles to return
        "apiKey": NEWS_API_KEY
    }

    try:
        response = requests.get(news_api_url, params=params)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        news_data = response.json()

        articles = []
        for article_data in news_data.get('articles', []):
            try:
                articles.append(NewsArticle(
                    source_name=article_data.get('source', {}).get('name'),
                    author=article_data.get('author'),
                    title=article_data.get('title'),
                    description=article_data.get('description'),
                    url=article_data.get('url'),
                    url_to_image=article_data.get('urlToImage'),
                    published_at=article_data.get('publishedAt'),
                    content=article_data.get('content')
                ))
            except Exception as e:
                print(f"Warning: Could not parse news article: {e} - Data: {article_data}")
                # Continue to next article if one fails to parse

        news_response = NewsResponse(
            articles=articles,
            total_results=news_data.get('totalResults', 0),
            message="Daily health news fetched successfully."
        )
        # Log the news fetching interaction (optional, but good for tracking)
        await save_chat_history(user_id, f"Fetched news (query: {query}, count: {len(articles)})", news_response.dict(), "/news")
        return news_response

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error fetching news: {http_err} - Response: {http_err.response.text}")
        raise HTTPException(
            status_code=http_err.response.status_code,
            detail=f"News API error: {http_err.response.text}"
        )
    except requests.exceptions.RequestException as req_err:
        print(f"Request error fetching news: {req_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not connect to News API: {req_err}"
        )
    except Exception as e:
        print(f"An unexpected error occurred while fetching news: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )


if __name__ == "__main__":
    # Ensure the 'data' directory exists if you plan to save other data there.
    # For this script, we only load the CSV from the root of the API folder.
    # if not os.path.exists("data"):
    #     os.makedirs("data")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
