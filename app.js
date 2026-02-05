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
const chartCtx = chartCanvas.getContext("2d");
let intentChart = null;

if (!chartCanvas) {
  console.error("❌ #intentChart canvas not found");
}
const logsRef = collection(
  db,
  "agents",
  "lumi2_support",
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

onSnapshot(q, (snapshot) => {
  logsContainer.innerHTML = "";

  const intentCount = {}; // { billing: 3, support: 5 }

  snapshot.forEach((doc) => {
    const data = doc.data();

    // Count intents
    const intent = data.category || "unknown";
    intentCount[intent] = (intentCount[intent] || 0) + 1;

    const div = document.createElement("div");
    div.className = "log";

    const time = data.timestamp?.toDate
      ? new Date(data.timestamp.toDate()).toLocaleString()
      : "No timestamp";

    div.innerHTML = `
      <small>${time}</small>
      <p class="user"><strong>User:</strong> ${data.question}</p>
      <p class="ai"><strong>AI:</strong> ${data.answer}</p>
      <p class="intent"><strong>Intent:</strong> ${intent}</p>
    `;

    logsContainer.appendChild(div);
  });

  updateIntentChart(intentCount);
});

function updateIntentChart(intentCount) {
  const labels = Object.keys(intentCount);
  const data = Object.values(intentCount);

  if (intentChart) {
    intentChart.destroy(); // Reset chart on live update
  }

  intentChart = new Chart(chartCtx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#6366f1",
            "#22c55e",
            "#f59e0b",
            "#ef4444",
            "#06b6d4",
            "#a855f7"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb"
          }
        }
      }
    }
  });
}








