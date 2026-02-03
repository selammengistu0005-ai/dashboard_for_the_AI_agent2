alert("app.js is running");
console.log("app.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔐 Firebase config (PUBLIC, SAFE) */
const firebaseConfig = {
  apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
  authDomain: "lumi-75592.firebaseapp.com",
  projectId: "lumi-75592",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const logsContainer = document.getElementById("logs");

const q = collection(db, "messages");

onSnapshot(
  q,
  (snapshot) => {
    logsContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();

      const div = document.createElement("div");
      div.className = "log";

      const time = data.timestamp
        ? new Date(data.timestamp.toDate()).toLocaleString()
        : "No timestamp";

      div.innerHTML = `
        <small>${time}</small>
        <p class="user"><strong>User:</strong> ${data.userMessage || "—"}</p>
        <p class="ai"><strong>AI:</strong> ${data.aiReply || "—"}</p>
      `;

      logsContainer.appendChild(div);
    });
  },
  (error) => {
    console.error("Firestore error:", error);
  }
);
