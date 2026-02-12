import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  // ये सारी Keys हम अगली फाइल (.env.local) में डालेंगे
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Singleton Pattern: 
// यह चेक करता है कि App पहले से कनेक्टेड तो नहीं है (ताकि Next.js रिलोड पर Error न आए)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// डेटाबेस सर्विस को export करें ताकि हम Components में इसका यूज़ कर सकें
const db = getDatabase(app);

export { db };
