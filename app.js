// 🔴 HARD PROOF THAT app.js IS EXECUTING
alert("app.js is running");
console.log("✅ app.js loaded");

// 🔥 Firebase ES module imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔐 Firebase config (PUBLIC, SAFE)
const firebaseConfig = {
  apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
  authDomain: "lumi-75592.firebaseapp.com",
  projectId: "lumi-75592",
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 Connected to project:", firebaseConfig.projectId);

// 🧱 DOM reference
const logsContainer = document.getElementById("logs");

if (!logsContainer) {
  console.error("❌ #logs container not found in HTML");
} else {
  console.log("✅ #logs container found");
}

// 📦 ---- PROOF #1: One-time Firestore READ test ----
(async () => {
  try {
    console.log("🔍 Testing Firestore read (getDocs)...");
    const snap = await getDocs(collection(db, "messages"));
    console.log(`📦 Firestore reachable. Documents found: ${snap.size}`);

    snap.forEach(doc => {
      console.log("📄 Doc:", doc.id, doc.data());
    });
  } catch (err) {
    console.error("❌ Firestore READ FAILED:", err);
  }
})();

// 🔁 ---- PROOF #2: Real-time listener (NO filters first) ----
console.log("👂 Attaching onSnapshot listener...");

const messagesRef = collection(db, "messages");

onSnapshot(
  messagesRef,
  (snapshot) => {
    console.log("🔁 onSnapshot fired. Docs:", snapshot.size);

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
        <p class="user"><strong>User:</strong> ${data.userMessage || "—"}</p>
        <p class="ai"><strong>AI:</strong> ${data.aiReply || "—"}</p>
      `;

      logsContainer.appendChild(div);
    });
  },
  (error) => {
    console.error("❌ Firestore onSnapshot error:", error);
  }
);
