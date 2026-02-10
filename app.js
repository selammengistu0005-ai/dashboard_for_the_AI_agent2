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

// 3. Updated Authentication Logic (Searches for the 'abc123' field)
async function validateAndUnlock() {
    const inputKey = keyInput.value.trim();
    if (!inputKey) return;

    unlockBtn.innerText = "Checking...";
    authError.innerText = "";

    try {
        // SEARCH the 'agents' collection for a document with accessKey == input
        const agentsRef = collection(db, "agents");
        const q = query(agentsRef, where("accessKey", "==", inputKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Found it! Get the ID of the document (echo-support)
            const agentDoc = querySnapshot.docs[0];
            currentAgent = agentDoc.id; 
            initDashboard();
        } else {
            throw new Error("Key not found");
        }
    } catch (error) {
        console.error(error);
        authError.innerText = "Invalid Access Key";
        unlockBtn.innerText = "Unlock";
    }
}

// 4. Password Visibility Toggle
toggleEye.addEventListener("click", () => {
    const type = keyInput.getAttribute("type") === "password" ? "text" : "password";
    keyInput.setAttribute("type", type);
    toggleEye.classList.toggle("fa-eye");
    toggleEye.classList.toggle("fa-eye-slash");
});

// 5. Dashboard Initialization
function initDashboard() {
    if (currentAgent) {
        keyOverlay.style.display = "none";
        mainApp.style.display = "flex";
        loadRealtimeLogs(currentAgent);
    } else {
        keyOverlay.style.display = "flex";
        mainApp.style.display = "none";
    }
}

// 6. Real-time Data Loading
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

            const time = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString() : "Pending...";

            const logDiv = document.createElement("div");
            logDiv.className = "log";
            logDiv.innerHTML = `
                <small>${time}</small>
                <div><strong>User:</strong> ${data.question}</div>
                <div><strong>AI:</strong> ${data.answer}</div>
                <div class="intent-tag">${intent}</div>
            `;
            logsContainer.appendChild(logDiv);
        });
        updateIntentChart(counts);
    });
}

// 7. Chart.js Visualization
function updateIntentChart(counts) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    if (intentChart) intentChart.destroy();

    intentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#a855f7"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text') } }
            }
        }
    });
}

// 8. Event Listeners
unlockBtn.addEventListener("click", validateAndUnlock);
keyInput.addEventListener("keypress", (e) => { if (e.key === "Enter") validateAndUnlock(); });
logoRefresh.addEventListener("click", () => window.location.reload());

modeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    if (intentChart) intentChart.update();
});

initDashboard();
