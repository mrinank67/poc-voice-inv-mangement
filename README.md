# 🗣️ BolKhata (Smart Voice Inventory & Ledger)

A lightning-fast, voice-first inventory management system designed to replace traditional pen-and-paper ledgers (*bahi-khatas*) for shopkeepers and small businesses.

BolKhata prioritizes extreme low latency, ensuring the AI can process Hindi/Hinglish voice commands, display structured transaction receipts, and securely update the cloud database just as fast as a shopkeeper can write it down.

## 🚀 Key Features

* **Zero-Latency Voice Capture:** Uses a "Press and Hold" walkie-talkie UI with spacebar desktop support to capture audio cleanly in noisy shop environments.
* **Dialect & Hinglish Support:** Powered by Groq and Whisper-Large-V3 to accurately transcribe heavily accented speech without hallucinating.
* **Intelligent Intent Extraction:** Uses Llama 3 (`llama-3.1-8b-instant` via Groq) to instantly translate Devanagari to English, map local slang (e.g., "Colgate" -> "toothpaste"), and understand complex multi-item orders in a single breath.
* **Multi-Tenant Security:** Firebase Auth (Phone/OTP, Google, Email) ensures every shopkeeper's inventory and history is strictly siloed and completely private.
* **Udhaar (Credit) Management:** Automatically routes items to a customer's credit ledger if a name is spoken (e.g., *"Do lux Ramesh ke khaate mein likh do"*).
* **Smart Dashboard & History:** Returns cleanly formatted tables for every transaction. A sliding drawer keeps track of the last 50 transactions for easy auditing.

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML, CSS, JavaScript (MediaRecorder API)
* **Backend:** FastAPI (Python)
* **Database & Auth:** Firebase Firestore & Firebase Authentication
* **AI Engine:** Groq API
  * STT: `whisper-large-v3`
  * NLP/Intent: `llama-3.1-8b-instant`
* **Matching Logic:** `thefuzz` (Fuzzy string matching for brand standardization)

## 💻 Local Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/bolkhata.git
cd bolkhata
```

### 2. Set up a Virtual Environment

```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up Firebase & Environment Variables

1. Create a Firebase project, enable **Firestore**, and enable **Authentication** (Email, Google, Phone).
2. Generate a Service Account Key (JSON file) from Firebase Project Settings > Service Accounts.
3. Save the JSON file in your project folder.
4. Create a `.env` file in the root directory and add your keys:

```text
GROQ_API_KEY=gsk_your_api_key_here
FIREBASE_SERVICE_ACCOUNT=name_of_your_firebase_service_account_file.json

# Firebase Client Config (From Firebase Project Settings > General)
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:1234567:web:abcdefg
```

### 5. Run the Server

The application requires two servers running simultaneously for local development (to separate the backend API from the static frontend):

```bash
# Terminal 1: Run the FastAPI backend
uvicorn main:app --reload

# Terminal 2: Serve the frontend
python -m http.server 8080
```

*Open `http://localhost:8080` in your browser and start speaking!*

## 🎙️ Example Voice Commands to Test

* **Standard Sale:** *"Do colgate aur ek maggi de do."*
* **Restock:** *"Paanch naye lux aaye hain."*
* **Credit (Udhaar):** *"Ek sabun Suresh ke khaate mein likh do."*
* **Mixed Cash & Credit:** *"Ek maggi de do, aur do lux Ramesh ke khaate mein likh do."*
* **Checking Stock:** *"Bhai, toothpaste kitna bacha hai dekhna."*
* **Full Ledger:** *"Saara stock dikhao."*
* **Khata Settlement:** *"Ramesh ka khata clear kar do."*
* **Wipe Shop Check:** *"Saara stock delete kar do."*

## ☁️ Deployment

BolKhata is fully production-ready and configured to be deployed natively on **Vercel** as a serverless application using the included `vercel.json` routing configuration. Add your `.env` variables to your Vercel project settings, and your Firebase connection will persist seamlessly globally.
