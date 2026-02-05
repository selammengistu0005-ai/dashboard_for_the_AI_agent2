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

/* 🔐 Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
  authDomain: "lumi-75592.firebaseapp.com",
  projectId: "lumi-75592",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🧱 DOM Elements
const logsContainer = document.getElementById("logs");
const chartCanvas = document.getElementById("intentChart");
const themeBtn = document.getElementById("theme-toggle");
const body = document.body;

let intentChart = null;
const chartCtx = chartCanvas?.getContext("2d");

// --- 🌗 THEME TOGGLE LOGIC ---
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    body.classList.toggle("light-mode");
    const isLight = body.classList.contains("light-mode");
    
    // Update Button Icon & Text
    themeBtn.innerHTML = isLight 
      ? '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>' 
      : '<i class="fa-solid fa-moon"></i> <span>Dark Mode</span>';

    // Refresh chart to update label colors
    if (intentChart) {
      updateChartColors(isLight);
    }
  });
}

// Helper to refresh chart colors without full rebuild
function updateChartColors(isLight) {
  const textColor = isLight ? "#1e293b" : "#e5e7eb";
  intentChart.options.plugins.legend.labels.color = textColor;
  intentChart.update();
}

// --- 🔥 FIRESTORE LOGIC ---
const logsRef = collection(db, "agents", "lumi2_support", "logs");
const q = query(logsRef, orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
  if (!logsContainer) return;
  logsContainer.innerHTML = "";
  const intentCount = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    const intent = data.category || "unknown";
    intentCount[intent] = (intentCount[intent] || 0) + 1;

    const time = data.timestamp?.toDate 
      ? new Date(data.timestamp.toDate()).toLocaleString() 
      : "No timestamp";

    const div = document.createElement("div");
    div.className = "log";
    div.innerHTML = `
      <small>${time}</small>
      <p class="user"><strong>User:</strong> ${data.question}</p>
      <p class="ai"><strong>AI:</strong> ${data.answer}</p>
      <span class="intent-tag">${intent}</span>
    `;
    logsContainer.appendChild(div);
  });

  updateIntentChart(intentCount);
});

// --- 📊 CHART LOGIC ---
function updateIntentChart(intentCount) {
  if (!chartCtx) return;

  const labels = Object.keys(intentCount);
  const data = Object.values(intentCount);
  const isLight = body.classList.contains("light-mode");

  if (intentChart) {
    intentChart.destroy();
  }

  intentChart = new Chart(chartCtx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isLight ? "#1e293b" : "#e5e7eb",
            padding: 20,
            font: { size: 12 }
          }
        }
      }
    }
  });
}
