import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCRpSuQ3nSVvThu246TT0ai-G4OB9_yn_g",
  authDomain: "red-rural.firebaseapp.com",
  projectId: "red-rural",
  storageBucket: "red-rural.firebasestorage.app",
  messagingSenderId: "30695077122",
  appId: "1:30695077122:web:2c700973abeac5914dbe1b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  auth,
  onAuthStateChanged,
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where,
  ref,
  uploadBytes,
  getDownloadURL
};