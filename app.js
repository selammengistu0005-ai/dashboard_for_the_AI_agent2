import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    orderBy,
    doc,
    updateDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyD73Uyrrl8JDP5X_yxT2Zp1fV9oIpAvpXA",
    authDomain: "lumi-75592.firebaseapp.com",
    projectId: "lumi-75592",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Elements
const keyOverlay = document.getElementById("key-overlay");
const mainApp = document.getElementById("main-app");
const keyInput = document.getElementById("agent-key-input");
const unlockBtn = document.getElementById("unlock-btn");
const authError = document.getElementById("auth-error");
const logsContainer = document.getElementById("logs");
const chartCanvas = document.getElementById("intentChart");
const modeSwitch = document.getElementById("mode-switch");
const logoRefresh = document.getElementById("logo-refresh");
const togglePasswordEye = document.getElementById("toggle-password-eye");

let currentAgent = null;
let unsubscribe = null;
let intentChart = null;

// 3. Auth Logic
async function validateAndUnlock() {
    const inputKey = keyInput.value.trim();
    if (!inputKey) return;

    unlockBtn.innerText = "Verifying...";
    try {
        const q = query(collection(db, "agents"), where("accessKey", "==", inputKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            currentAgent = querySnapshot.docs[0].id;
            keyOverlay.style.display = "none";
            mainApp.style.display = "flex";
            document.getElementById("reply-area").style.display = "block";
            loadLogs(currentAgent);
        } else {
            throw new Error();
        }
    } catch (e) {
        authError.innerText = "Invalid Key";
        unlockBtn.innerText = "Authorize Dashboard";
    }
}

// 4. Load Logs
function loadLogs(agentId) {
    if (unsubscribe) unsubscribe();
    
    const q = query(collection(db, "agents", agentId, "logs"), orderBy("timestamp", "desc"));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        document.getElementById("escalation-alerts").innerHTML = ""; 
        logsContainer.innerHTML = "";
        const counts = {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === "escalation") {
                showEscalationAlert(doc.id, data.question);
                return;
            }
            const intent = data.category || "General";
            counts[intent] = (counts[intent] || 0) + 1;

            const frame = document.createElement("div");
            frame.className = "log-frame";
            frame.innerHTML = `
                <div class="user-q">
                    <i class="fa-solid fa-comment-dots" style="color: var(--primary-accent)"></i>
                    <span>${data.question}</span>
                </div>
                <div class="ai-a">${data.answer}</div>
                <div class="intent-tag">
                    <i class="fa-solid fa-tag"></i> ${intent}
                </div>
            `;
            logsContainer.appendChild(frame);
        });
        updateChart(counts);
    });
}

// 5. Chart
function updateChart(counts) {
    if (!chartCanvas) return;
    const isLight = document.body.classList.contains("light-mode");
    if (intentChart) intentChart.destroy();

    intentChart = new Chart(chartCanvas.getContext("2d"), {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#a855f7"],
                borderWidth: 0,
                hoverOffset: 10
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
                        font: { size: 10 },
                        boxWidth: 10
                    }
                }
            },
            cutout: '80%'
        }
    });
}

// 6. Events
unlockBtn.addEventListener("click", validateAndUnlock);
keyInput.addEventListener("keypress", (e) => e.key === "Enter" && validateAndUnlock());

logoRefresh.addEventListener("click", () => window.location.reload());

modeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode");
    if (intentChart) {
        const currentData = intentChart.data.datasets[0].data;
        const currentLabels = intentChart.data.labels;
        const countObj = {};
        currentLabels.forEach((l, i) => countObj[l] = currentData[i]);
        updateChart(countObj);
    }
});

// --- NEW: Toggle Password Visibility Logic ---
togglePasswordEye.addEventListener("click", () => {
    // Switch input type
    const type = keyInput.getAttribute("type") === "password" ? "text" : "password";
    keyInput.setAttribute("type", type);
    
    // Toggle icon appearance
    togglePasswordEye.classList.toggle("fa-eye");
    togglePasswordEye.classList.toggle("fa-eye-slash");
});

// --- ESCALATION SYSTEM ---

function showEscalationAlert(docId, question) {
    const alertArea = document.getElementById("escalation-alerts"); // Added this line
    
    // Check if this alert already exists to prevent duplicates
    if (document.getElementById(`alert-frame-${docId}`)) return;

    const newAlert = document.createElement('div');
    newAlert.id = `alert-frame-${docId}`; 
    newAlert.innerHTML = `
        <div class="alert-card">
            <div>
                <p style="font-weight:800; color:#ef4444;">🚨 LIVE AGENT REQUESTED</p>
                <p style="color: #1e293b;">"${question}"</p>
            </div>
            <div class="alert-btns">
                <button class="btn-accept" id="accept-${docId}">Accept</button>
                <button class="btn-decline" id="decline-${docId}">Decline</button>
            </div>
        </div>
    `;
    alertArea.appendChild(newAlert);

    // Attach events
    document.getElementById(`accept-${docId}`).onclick = () => resolveRequest(docId, "accepted");
    document.getElementById(`decline-${docId}`).onclick = () => resolveRequest(docId, "declined");
}

async function resolveRequest(docId, decision) {
    const msg = decision === "accepted" 
        ? "Connected! A human agent is joining now." 
        : "I'm sorry, agents are busy. Please try later.";
    
    try {
        await updateDoc(doc(db, "agents", currentAgent, "logs", docId), {
            answer: msg,
            status: decision
        });
        
        const targetAlert = document.getElementById(`alert-frame-${docId}`);
        if (targetAlert) targetAlert.remove();
    } catch (e) {
        console.error("Error updating status:", e);
    }
}

// --- ADMIN REPLY LOGIC ---
const replyInput = document.getElementById("admin-reply-input");
const sendBtn = document.getElementById("send-reply-btn");

async function sendAdminMessage() {
    const text = replyInput.value.trim();
    if (!text || !currentAgent) return;

    try {
        // Adding a document here creates a new "frame" in your dashboard instantly
        await addDoc(collection(db, "agents", currentAgent, "logs"), {
            question: "Admin Reply",
            answer: text,
            status: "accepted", // Keeps AI muzzled
            timestamp: new Date(), 
            category: "human_reply"
        });
        replyInput.value = ""; // Clear the box
    } catch (e) {
        console.error("Failed to send message:", e);
    }
}

// Trigger on click
sendBtn.addEventListener("click", sendAdminMessage);

// Trigger on Enter key
replyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendAdminMessage();
});
