// ==============================
//  Firebase INIT — RuralControl
// ==============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- CONFIG ---
export const firebaseConfig = {
  apiKey: "AIzaSyCRpSuQ3nSVvThu246TT0ai-G4OB9_yn_g",
  authDomain: "red-rural.firebaseapp.com",
  projectId: "red-rural",
  storageBucket: "red-rural.firebasestorage.app",
  messagingSenderId: "30695077122",
  appId: "1:30695077122:web:2c700973abeac5914dbe1b"
};

// --- INICIALIZACIÓN ---
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
