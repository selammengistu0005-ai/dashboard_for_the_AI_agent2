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
const logoRefresh = document.getElementById("logo-refresh");
const modeSwitch = document.getElementById("mode-switch");
const modeOptions = document.querySelectorAll(".mode-option");
const agentButtons = document.querySelectorAll(".agent-switch");
const body = document.body;

let intentChart = null;
let currentAgent = "lumi2_support"; 
let unsubscribe = null; 
const chartCtx = chartCanvas?.getContext("2d");

// --- 🛠️ THEME & LOGO CONTROLS ---

// 1. Click Logo to Refresh Page
if (logoRefresh) {
  logoRefresh.addEventListener("click", () => {
    window.location.reload();
  });
}

// 2. State Management: Set Theme
function setTheme(mode) {
  modeOptions.forEach(opt => opt.classList.remove("active"));
  
  if (mode === "light") {
    body.classList.add("light-mode");
    body.classList.remove("dark-mode");
    modeSwitch.classList.add("is-light");
    document.querySelector('[data-mode="light"]').classList.add("active");
  } else {
    body.classList.add("dark-mode");
    body.classList.remove("light-mode");
    modeSwitch.classList.remove("is-light");
    document.querySelector('[data-mode="dark"]').classList.add("active");
  }
  
  // Update chart if it exists
  if (intentChart) updateChartColors(mode === "light");
  
  // Save to memory so it doesn't flicker on refresh
  localStorage.setItem("dashboard-theme", mode);
}

// 3. Initialize Theme from Memory
const savedTheme = localStorage.getItem("dashboard-theme") || "dark";
setTheme(savedTheme);

// 4. Click Listener for Knob Options
modeOptions.forEach(option => {
  option.addEventListener("click", () => {
    const selectedMode = option.getAttribute("data-mode");
    setTheme(selectedMode);
  });
});

function updateChartColors(isLight) {
  const textColor = isLight ? "#1e293b" : "#e5e7eb";
  if (intentChart.options.plugins.legend.labels) {
    intentChart.options.plugins.legend.labels.color = textColor;
    intentChart.update();
  }
}

// --- 🔥 FIRESTORE LOGIC ---
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
      agentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadAgentData(currentAgent);
    }
  });
});

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
