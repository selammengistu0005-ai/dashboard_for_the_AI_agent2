import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs
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
const body = document.body;

// Auth Elements
const keyOverlay = document.getElementById("key-overlay");
const sidebar = document.getElementById("sidebar-main");
const contentArea = document.getElementById("content-main");
const keyInput = document.getElementById("agent-key-input");
const unlockBtn = document.getElementById("unlock-btn");
const authError = document.getElementById("auth-error");

let intentChart = null;
let currentAgent = localStorage.getItem("agent_access_key"); 
let unsubscribe = null; 
const chartCtx = chartCanvas?.getContext("2d");

// --- 🛡️ AUTHENTICATION LOGIC ---

async function validateAndUnlock() {
    const inputKey = keyInput.value.trim();
    if (!inputKey) return;

    unlockBtn.disabled = true;
    unlockBtn.innerHTML = `<span>Checking...</span>`;

    try {
        // Check if the agent collection exists by trying to fetch 1 doc
        const testRef = collection(db, "agents", inputKey, "logs");
        const testSnap = await getDocs(query(testRef, orderBy("timestamp", "desc")));

        // In Firebase, collections aren't "checked" for existence easily, 
        // so we treat any valid string that returns/allows access as a success.
        localStorage.setItem("agent_access_key", inputKey);
        currentAgent = inputKey;
        initDashboard();
    } catch (error) {
        authError.innerText = "Access Denied: Invalid Key";
        unlockBtn.disabled = false;
        unlockBtn.innerHTML = `<span>Unlock Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
}

function initDashboard() {
    if (!currentAgent) {
        keyOverlay.style.display = "flex";
        sidebar.style.display = "none";
        contentArea.style.display = "none";
    } else {
        keyOverlay.style.display = "none";
        sidebar.style.display = "flex";
        contentArea.style.display = "flex";
        loadAgentData(currentAgent);
    }
}

unlockBtn.addEventListener("click", validateAndUnlock);
keyInput.addEventListener("keypress", (e) => { if (e.key === "Enter") validateAndUnlock(); });

// --- 🛠️ THEME & LOGO CONTROLS ---

if (logoRefresh) {
  logoRefresh.addEventListener("click", () => {
    localStorage.removeItem("agent_access_key"); // Simple way to "Logout"
    window.location.reload();
  });
}

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
  if (intentChart) updateChartColors(mode === "light");
  localStorage.setItem("dashboard-theme", mode);
}

const savedTheme = localStorage.getItem("dashboard-theme") || "dark";
setTheme(savedTheme);

modeOptions.forEach(option => {
  option.addEventListener("click", () => {
    setTheme(option.getAttribute("data-mode"));
  });
});

function updateChartColors(isLight) {
  const textColor = isLight ? "#1e293b" : "#e5e7eb";
  if (intentChart && intentChart.options.plugins.legend.labels) {
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
  }, (error) => {
      console.error("Snapshot error:", error);
      // If error (like permission denied), kick back to login
      localStorage.removeItem("agent_access_key");
      location.reload();
  });
}

// --- 📊 CHART LOGIC ---
function updateIntentChart(intentCount) {
  if (!chartCtx) return;
  const labels = Object.keys(intentCount);
  const data = Object.values(intentCount);
  const isLight = body.classList.contains("light-mode");
  const isMobile = window.innerWidth <= 768;

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
          display: !isMobile,
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

// Initialize on Load
initDashboard();
