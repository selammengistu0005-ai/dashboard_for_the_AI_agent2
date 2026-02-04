alert("app.js is running");
console.log("✅ app.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔐 Firebase config (PUBLIC) */
const firebaseConfig = {
  apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
  authDomain: "lumi-75592.firebaseapp.com",
  projectId: "lumi-75592",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 Connected to project:", firebaseConfig.projectId);

// 🧱 DOM
const logsContainer = document.getElementById("logs");

if (!logsContainer) {
  console.error("❌ #logs container not found");
}

const chartCanvas = document.getElementById("intentChart");

if (!chartCanvas) {
  console.error("❌ #intentChart canvas not found");
}
const logsRef = collection(
  db,
  "agents",
  "khil-support",
  "logs"
);

/* 📦 PROOF: One-time read */
(async () => {
  try {
    console.log("🔍 Testing Firestore read...");
    const snap = await getDocs(logsRef);
    console.log("📦 Documents found:", snap.size);

    snap.forEach(doc => {
      console.log("📄", doc.id, doc.data());
    });
  } catch (err) {
    console.error("❌ Firestore read failed:", err);
  }
})();

/* 🔁 LIVE LISTENER */
const q = query(logsRef, orderBy("timestamp", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    console.log("🔁 onSnapshot fired:", snapshot.size);

    logsContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();

      const div = document.createElement("div");
      div.className = "log";

      const time = data.timestamp?.toDate
        ? new Date(data.timestamp.toDate()).toLocaleString()
        : "No timestamp";

      div.innerHTML = `
        <small>${time}</small>
        <p class="user"><strong>User:</strong> ${data.question || "—"}</p>
        <p class="ai"><strong>AI:</strong> ${data.answer || "—"}</p>
        <p class="intent"><strong>Intent:</strong> ${data.category || "Unknown"}</p>
      `;

      logsContainer.appendChild(div);
    });
  },
  (error) => {
    console.error("❌ onSnapshot error:", error);
  }
);



