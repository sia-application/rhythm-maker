// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBVgnTxz5pOliFVTAsErlGrwF25gW_gvWQ",
    authDomain: "rhythm-maker-pro.firebaseapp.com",
    projectId: "rhythm-maker-pro",
    storageBucket: "rhythm-maker-pro.firebasestorage.app",
    messagingSenderId: "177590336280",
    appId: "1:177590336280:web:ec08514e60cba77c33fc6d",
    measurementId: "G-VHRWJ5C37C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
