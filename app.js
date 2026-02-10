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

// --- 🛠️ THEME & LOGO CONTROLS (Unchanged) ---
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

// --- 🔥 FIRESTORE LOGIC ---

async function loadAgentData(agentId, enteredPassword) {
  // 🎯 TARGETING THE NEW "password" DOCUMENT
  // Path: agents/{agentId}/passwords/password (assuming 'passwords' is a sub-collection)
  // or agents/{agentId}/password if it's a nested doc. 
  // Based on your text, I'll fetch the document "password" inside the agent's path.
  const passDocRef = doc(db, "agents", agentId, "config", "password"); 
  
  // Note: If you put it directly under the agent, use: doc(db, "agents", agentId)
  // But based on your specific instruction, we check the 'password' doc:
  const passDoc = await getDoc(doc(db, "agents", agentId, "private", "keys")); 

  /* REVISED LOGIC: Since you mentioned a "new document called password", 
     I will assume the structure is: agents -> {agentId} -> password (document)
  */
  const authDocRef = doc(db, "agents", agentId, "auth", "password");
  const authDoc = await getDoc(authDocRef);

  if (authDoc.exists()) {
    const dbPassword = authDoc.data().code; // Adjust 'code' to whatever field name you used

    if (enteredPassword === dbPassword) {
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
    } else {
      alert("Incorrect password!");
    }
  } else {
    alert("Security configuration missing for this agent.");
  }
}

// --- 🖱️ AGENT SWITCHER LOOP ---
agentButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedAgent = btn.getAttribute("data-agent");
    const pass = prompt(`Enter security code for ${selectedAgent}:`);
    
    if (pass) {
      currentAgent = selectedAgent;
      agentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadAgentData(currentAgent, pass);
    }
  });
});

// --- 📊 CHART LOGIC (Unchanged) ---
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
