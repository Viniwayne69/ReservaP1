import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const fallbackConfig = {
  apiKey: "AIzaSyAdYi5G-PhDWzD9anZZL_76asUpcCzJg9Y",
  authDomain: "agendamentop1.firebaseapp.com",
  projectId: "agendamentop1",
  storageBucket: "agendamentop1.firebasestorage.app",
  messagingSenderId: "105298128598",
  appId: "1:105298128598:web:8f1cedf58ff80dd6effeaf"
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId
};

export const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "admin@p1autorecife.com.br,alecvilarim@gmail.com")
  .split(",")
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
