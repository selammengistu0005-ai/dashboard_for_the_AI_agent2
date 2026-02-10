import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
    authDomain: "lumi-75592.firebaseapp.com",
    projectId: "lumi-75592",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. DOM Elements
const keyOverlay = document.getElementById("key-overlay");
const mainApp = document.getElementById("main-app");
const keyInput = document.getElementById("agent-key-input");
const unlockBtn = document.getElementById("unlock-btn");
const authError = document.getElementById("auth-error");
const toggleEye = document.getElementById("toggle-password-eye");
const logsContainer = document.getElementById("logs");
const chartCanvas = document.getElementById("intentChart");
const logoRefresh = document.getElementById("logo-refresh");
const modeSwitch = document.getElementById("mode-switch");

let currentAgent = null; 
let unsubscribe = null;
let intentChart = null;

// 3. Authentication Logic
async function validateAndUnlock() {
    const inputKey = keyInput.value.trim();
    if (!inputKey) return;

    unlockBtn.innerText = "Authorizing...";
    authError.innerText = "";

    try {
        const agentsRef = collection(db, "agents");
        const q = query(agentsRef, where("accessKey", "==", inputKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const agentDoc = querySnapshot.docs[0];
            currentAgent = agentDoc.id; 
            initDashboard();
        } else {
            throw new Error("Invalid Key");
        }
    } catch (error) {
        authError.innerText = "Invalid Access Key. Please try again.";
        unlockBtn.innerText = "Authorize Dashboard";
    }
}

// 4. Dashboard Initialization
function initDashboard() {
    if (currentAgent) {
        keyOverlay.style.display = "none";
        mainApp.style.display = "flex";
        loadRealtimeLogs(currentAgent);
    }
}

// 5. Real-time Data Loading with Professional Frame Structure
function loadRealtimeLogs(agentId) {
    if (unsubscribe) unsubscribe();

    const logsRef = collection(db, "agents", agentId, "logs");
    const q = query(logsRef, orderBy("timestamp", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        if (!logsContainer) return;
        logsContainer.innerHTML = "";
        const counts = {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            const intent = data.category || "General";
            counts[intent] = (counts[intent] || 0) + 1;

            const logDiv = document.createElement("div");
            logDiv.className = "log-frame";
            logDiv.innerHTML = `
                <div class="user-q">
                    <i class="fa-solid fa-circle-user" style="color: var(--primary-accent)"></i>
                    <span>${data.question || "No question recorded"}</span>
                </div>
                <div class="ai-a">
                    ${data.answer || "No response generated"}
                </div>
                <div class="intent-tag">
                    <i class="fa-solid fa-bolt-lightning"></i> ${intent}
                </div>
            `;
            logsContainer.appendChild(logDiv);
        });
        updateIntentChart(counts);
    });
}

// 6. Chart.js Visualization
function updateIntentChart(counts) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    const isLight = document.body.classList.contains("light-mode");
    
    if (intentChart) intentChart.destroy();

    intentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#a855f7"],
                hoverOffset: 15,
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
                        color: isLight ? '#1e293b' : '#f8fafc',
                        padding: 20,
                        font: { family: 'Inter', size: 12 }
                    } 
                }
            },
            cutout: '75%'
        }
    });
}

// 7. UI Interactivity
unlockBtn.addEventListener("click", validateAndUnlock);
keyInput.addEventListener("keypress", (e) => { if (e.key === "Enter") validateAndUnlock(); });

// Requirement 1: Logo Refresh
logoRefresh.addEventListener("click", () => {
    window.location.reload();
});

// Requirement 2: Advanced Toggle Knob Logic
modeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode");
    
    // Refresh chart to update font colors
    if (intentChart && currentAgent) {
        // Redraw based on current counts
        const lastCounts = intentChart.data.datasets[0].data;
        const lastLabels = intentChart.data.labels;
        const countObj = {};
        lastLabels.forEach((label, i) => countObj[label] = lastCounts[i]);
        updateIntentChart(countObj);
    }
});

// Toggle Password visibility
toggleEye.addEventListener("click", () => {
    const type = keyInput.type === "password" ? "text" : "password";
    keyInput.type = type;
    toggleEye.classList.toggle("fa-eye");
    toggleEye.classList.toggle("fa-eye-slash");
});
