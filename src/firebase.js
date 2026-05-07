import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD4ZgHgMSrJefYyN1mGPPG1C4pux_dOdUA",
  authDomain: "my-elogbook.firebaseapp.com",
  projectId: "my-elogbook",
  storageBucket: "my-elogbook.firebasestorage.app",
  messagingSenderId: "998086693835",
  appId: "1:998086693835:web:5350aae4d210395a079c4e",
  measurementId: "G-2PF2XWZKMD"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();