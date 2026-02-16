import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    orderBy,
    addDoc,
    serverTimestamp
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
const navMonitor = document.getElementById("nav-monitor");
const navTrain = document.getElementById("nav-train");
const logsWrapper = document.getElementById("monitor-section"); // Changed from querySelector
const trainingSection = document.getElementById("training-section");
const messyInput = document.getElementById("instructionsInput"); // Changed to match HTML id
const viewTitle = document.getElementById("view-title"); // Add this if not already there
const doneBtn = document.getElementById("done-btn");
const previewSection = document.getElementById("preview-section");
const cleanPreview = document.getElementById("clean-preview");

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
            loadLogs(currentAgent);    // Loads the chat logs
            loadHistory(currentAgent);
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
        logsContainer.innerHTML = "";
        const counts = {};

        snapshot.forEach((doc) => {
            const data = doc.data();
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

// Navigation Logic
// Navigation Logic
navMonitor.addEventListener("click", () => {
    navMonitor.classList.add("active");
    navTrain.classList.remove("active");
    
    // Show Monitor Section, Hide Training Section
    logsWrapper.style.display = "block";
    trainingSection.style.display = "none";
    
    // Update the header text
    if(viewTitle) viewTitle.innerText = "Live Monitor";
});

navTrain.addEventListener("click", () => {
    navTrain.classList.add("active");
    navMonitor.classList.remove("active");
    
    // Show Training Section, Hide Monitor Section
    trainingSection.style.display = "block";
    logsWrapper.style.display = "none";
    
    // Update the header text
    if(viewTitle) viewTitle.innerText = "Train Agent";
});

// "Done" Button Sync Logic
doneBtn.addEventListener("click", async () => {
    const text = messyInput.value.trim();
    if (!text) return;

    doneBtn.innerText = "Refining...";
    doneBtn.disabled = true;

    try {
        const response = await fetch('https://selam-backend-1biy.onrender.com/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                instructions: text,
                agent_id: currentAgent 
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // 1. Save to Firebase (Fixed the closing brackets here)
                await addDoc(collection(db, "agents", currentAgent, "trainingHistory"), {
                    text: text,
                    timestamp: serverTimestamp()
                }); 

                // 2. Update UI
                previewSection.style.display = "block";
                cleanPreview.innerText = data.cleaned;
                doneBtn.innerText = "Updated! ✅";
                
                setTimeout(() => {
                    doneBtn.innerText = "Update Agent";
                    doneBtn.disabled = false;
                }, 3000);
            }
        } else {
            // Handle cases where response is not 200 OK
            alert("Server error. Please try again.");
            doneBtn.innerText = "Update Agent";
            doneBtn.disabled = false;
        }
    } catch (e) {
        alert("Update failed. Check if your backend is running.");
        doneBtn.innerText = "Update Agent";
        doneBtn.disabled = false;
    }
}); 

// This function builds the little rectangular frame
function addToHistory(text) {
    const historyList = document.getElementById('historyList');
    
    // Create the frame
    const frame = document.createElement('div');
    frame.className = 'history-item';
    
    // Add the text and the bubble button inside the frame
    frame.innerHTML = `
        <div class="history-text">${text}</div>
        <button class="restore-bubble-btn">To the Main 🫧</button>
    `;

    // Make the "Bubble Button" work when clicked
    frame.querySelector('.restore-bubble-btn').addEventListener('click', () => {
        // This puts the text back into your big input box
        document.getElementById('instructionsInput').value = text;
    });

    // Put this new frame at the top of the history list
    historyList.prepend(frame);
}

// This function fetches all previous updates from Firebase
function loadHistory(agentId) {
    const q = query(
        collection(db, "agents", agentId, "trainingHistory"), 
        orderBy("timestamp", "desc")
    );

    // This listens to Firebase. If a new update is added, it pops up automatically!
    onSnapshot(q, (snapshot) => {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = ""; // Clear the list so we don't get duplicates
        
        snapshot.forEach((doc) => {
            addToHistory(doc.data().text);
        });
    });
}


