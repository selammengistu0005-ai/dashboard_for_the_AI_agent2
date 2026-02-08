import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
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
const themeCheckbox = document.getElementById("checkbox"); // New Toggle Switch
const logoRefresh = document.getElementById("logo-refresh"); // Clickable Logo
const agentButtons = document.querySelectorAll(".agent-switch");
const body = document.body;

let intentChart = null;
let currentAgent = "lumi2_support"; 
let unsubscribe = null; 
const chartCtx = chartCanvas?.getContext("2d");

// --- 🛠️ INTERACTION CONTROLS ---

// 1. Click Logo to Refresh Page
if (logoRefresh) {
  logoRefresh.addEventListener("click", () => {
    // Optional: Add a small rotation animation via CSS class before reload if desired
    window.location.reload();
  });
}

// 2. Professional Theme Switch Logic
if (themeCheckbox) {
  themeCheckbox.addEventListener("change", () => {
    // Toggle the class on the body
    body.classList.toggle("light-mode");
    const isLight = body.classList.contains("light-mode");
    
    // Update Chart Colors to match theme
    if (intentChart) updateChartColors(isLight);
  });
}

function updateChartColors(isLight) {
  const textColor = isLight ? "#1e293b" : "#e5e7eb";
  intentChart.options.plugins.legend.labels.color = textColor;
  intentChart.update();
}

// --- 🔥 MODULAR FIRESTORE LOGIC ---
function loadAgentData(agentId) {
  if (unsubscribe) unsubscribe(); 

  const logsRef = collection(db, "agents", agentId, "logs");
  const q = query(logsRef, orderBy("timestamp", "desc"));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    if (!logsContainer) return;
    logsContainer.innerHTML = "";
    const intentCount = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const intent = data.category || "unknown";
      intentCount[intent] = (intentCount[intent] || 0) + 1;

      const time = data.timestamp?.toDate
        ? new Date(data.timestamp.toDate()).toLocaleString()
        : "Syncing...";

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
}

// --- 🖱️ AGENT SWITCHER LOOP ---
agentButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedAgent = btn.getAttribute("data-agent");

    if (currentAgent !== selectedAgent) {
      currentAgent = selectedAgent;

      // Update UI
      agentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Load new data
      loadAgentData(currentAgent);
    }
  });
});

// Initial load
loadAgentData(currentAgent);

// --- 📊 CHART LOGIC ---
function updateIntentChart(intentCount) {
  if (!chartCtx) return;
  const labels = Object.keys(intentCount);
  const data = Object.values(intentCount);
  const isLight = body.classList.contains("light-mode");

  if (intentChart) intentChart.destroy();

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
