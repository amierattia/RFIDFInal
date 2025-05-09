 // Import Firebase SDKs
 import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
 import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

 // Firebase configuration
 const firebaseConfig = {
     apiKey: "AIzaSyBXzJ6x23XVsfwytVHZgn03KhAYqegtTSo",
     authDomain: "roro-534fe.firebaseapp.com",
     projectId: "roro-534fe",
     storageBucket: "roro-534fe.firebasestorage.app",
     messagingSenderId: "444827835508",
     appId: "1:444827835508:web:ab65a9b345e44391200521",
     databaseURL: "https://roro-534fe-default-rtdb.firebaseio.com/"
 };

 // Initialize Firebase
 const app = initializeApp(firebaseConfig);
 const db = getDatabase(app);
 const errorMessage = document.getElementById("errorMessage");

 // Login handler
 document.getElementById("loginButton").addEventListener("click", async () => {
     const name = document.getElementById("loginName").value.trim();
     const uid = document.getElementById("loginUID").value.trim();

     if (!name || !uid) {
         errorMessage.textContent = "Please enter both name and UID.";
         errorMessage.classList.remove("hidden");
         return;
     }

     try {
         const userRef = ref(db, `Users/${uid}`);
         const snapshot = await get(userRef);
         const userData = snapshot.val();

         if (userData && userData.Name === name && userData.UID === uid) {
             localStorage.setItem("userUID", uid);
             localStorage.setItem("userRole", userData.Role);
             if (userData.Role === "admin") {
                 window.location.href = "index.html";
             } else {
                 window.location.href = "employee.html";
             }
         } else {
             errorMessage.textContent = "Invalid name or UID.";
             errorMessage.classList.remove("hidden");
         }
     } catch (error) {
         console.error("Login error:", error);
         errorMessage.textContent = `Login failed: ${error.message}`;
         errorMessage.classList.remove("hidden");
     }
 });