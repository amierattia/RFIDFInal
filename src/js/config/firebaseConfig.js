import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Firebase configuration object
const firebaseConfig = {
    apiKey: "AIzaSyBXzJ6x23XVsfwytVHZgn03KhAYqegtTSo",
    authDomain: "roro-534fe.firebaseapp.com",
    projectId: "roro-534fe",
    storageBucket: "roro-534fe.firebasestorage.app",
    messagingSenderId: "444827835508",
    appId: "1:444827835508:web:ab65a9b345e44391200521",
    databaseURL: "https://roro-534fe-default-rtdb.firebaseio.com/"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Export the Realtime Database instance
export const db = getDatabase(app);

// Log to confirm file is loaded
console.log("Firebase initialized successfully");