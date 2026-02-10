import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
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
let currentAgent = null; 
let unsubscribe = null; 
const chartCtx = chartCanvas?.getContext("2d");

// --- 🛠️ THEME & LOGO CONTROLS ---

if (logoRefresh) {
  logoRefresh.addEventListener("click", () => {
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
    const selectedMode = option.getAttribute("data-mode");
    setTheme(selectedMode);
  });
});

function updateChartColors(isLight) {
  const textColor = isLight ? "#1e293b" : "#e5e7eb";
  if (intentChart && intentChart.options.plugins.legend.labels) {
    intentChart.options.plugins.legend.labels.color = textColor;
    intentChart.update();
  }
}

// --- 🔥 FIRESTORE LOGIC (The Professional Path) ---

async function loadAgentData(agentId, enteredPassword) {
  try {
    // 🚪 WALKING THE PATH: agents -> {id} -> private -> keys
    const authDocRef = doc(db, "agents", agentId, "private", "keys"); 
    const authDoc = await getDoc(authDocRef);

    if (authDoc.exists()) {
      const data = authDoc.data();
      const dbPassword = data.password; // Looks for 'password' field

      if (enteredPassword === dbPassword) {
        console.log("✅ Authenticated: " + agentId);
        
        // Stop listening to previous agent logs if switching
        if (unsubscribe) unsubscribe(); 

        // Start listening to the logs sub-collection
        const logsRef = collection(db, "agents", agentId, "logs");
        const q = query(logsRef, orderBy("timestamp", "desc"));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!logsContainer) return;
          logsContainer.innerHTML = "";
          const intentCount = {};

          snapshot.forEach((doc) => {
            const logData = doc.data();
            const intent = logData.category || "unknown";
            intentCount[intent] = (intentCount[intent] || 0) + 1;

            const time = logData.timestamp?.toDate
              ? new Date(logData.timestamp.toDate()).toLocaleString()
              : "Syncing...";

            const div = document.createElement("div");
            div.className = "log";
            div.innerHTML = `
              <small>${time}</small>
              <p class="user"><strong>User:</strong> ${logData.question}</p>
              <p class="ai"><strong>AI:</strong> ${logData.answer}</p>
              <span class="intent-tag">${intent}</span>
            `;
            logsContainer.appendChild(div);
          });
          updateIntentChart(intentCount);
        });
      } else {
        alert("❌ Access Denied: Incorrect Password");
      }
    } else {
      console.error("Path missing: " + authDocRef.path);
      alert("Error: This agent does not have a security profile set up.");
    }
  } catch (error) {
    console.error("🔥 Firebase Error:", error);
    alert("Connection error. Check console.");
  }
}

// --- 🖱️ AGENT SWITCHER ---

agentButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedAgent = btn.getAttribute("data-agent");
    
    // Simple prompt for the password
    const pass = prompt(`Please enter the security key for ${selectedAgent}:`);
    
    if (pass) {
      currentAgent = selectedAgent;
      agentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadAgentData(currentAgent, pass);
    }
  });
});

// NOTE: We removed the auto-load function so the dashboard stays blank until a password is used.

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
