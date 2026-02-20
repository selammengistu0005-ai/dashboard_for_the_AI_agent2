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
    addDoc,   
    updateDoc,
    deleteDoc
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
// History Drawer Controls
const historyDrawer = document.getElementById("history-drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const openHistoryBtn = document.getElementById("open-history-btn");
const closeHistoryBtn = document.getElementById("close-history-btn");

openHistoryBtn.addEventListener("click", () => {
    historyDrawer.classList.add("open");
    drawerOverlay.classList.add("active");
    loadHistory(currentAgent); // Fetch history when opened
});

const closeHistory = () => {
    historyDrawer.classList.remove("open");
    drawerOverlay.classList.remove("active");
};

closeHistoryBtn.addEventListener("click", closeHistory);
drawerOverlay.addEventListener("click", closeHistory);
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
            loadLogs(currentAgent);
            loadKnowledge(currentAgent);
            listenToSettings(currentAgent);
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
// 6. Events (Add these at the bottom of your script)

unlockBtn.addEventListener("click", validateAndUnlock);
keyInput.addEventListener("keypress", (e) => e.key === "Enter" && validateAndUnlock());
logoRefresh.addEventListener("click", () => window.location.reload());
document.getElementById("add-kb-item").onclick = saveKnowledge;

// Theme Switcher
modeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode");
    // Redraw chart to update font colors
    if (intentChart) {
        const currentData = intentChart.data.datasets[0].data;
        const currentLabels = intentChart.data.labels;
        const countObj = {};
        currentLabels.forEach((l, i) => countObj[l] = currentData[i]);
        updateChart(countObj);
    }
});

togglePasswordEye.addEventListener("click", () => {
    const type = keyInput.getAttribute("type") === "password" ? "text" : "password";
    keyInput.setAttribute("type", type);
    togglePasswordEye.classList.toggle("fa-eye");
    togglePasswordEye.classList.toggle("fa-eye-slash");
});

// --- KNOWLEDGE BASE ENGINE ---

async function saveKnowledge() {
    const saveBtn = document.getElementById("add-kb-item");
    const aiName = document.getElementById("ai-name-input").value.trim();
    const systemInstructions = document.getElementById("ai-instructions").value.trim();
    // Capture selected personas from the matrix
    const activePersonas = Array.from(document.querySelectorAll(".persona-btn.active")).map(btn => btn.dataset.style);

    const branches = document.querySelectorAll(".kb-branch-row");
    
    if (!currentAgent) return;

    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing Brain...`;
    saveBtn.disabled = true;

    try {
        // 1. Update the Main Agent Settings
        await updateDoc(doc(db, "agents", currentAgent), {
            aiDisplayName: aiName,
            personas: activePersonas,
            systemInstructions: systemInstructions,
            lastConfigUpdate: new Date()
        });

        // --- NEW: ARCHIVE TO HISTORY ---
        if (systemInstructions) {
            await addDoc(collection(db, "agents", currentAgent, "history"), {
                text: systemInstructions,
                timestamp: new Date(),
                author: "Admin" 
            });
        }
        // --- END ARCHIVE LOGIC ---

        // 2. Save Inventory Branches (Keep your existing loop here...)

        // 2. Save Inventory Branches
        for (let branch of branches) {
            const name = branch.querySelector(".kb-name").value.trim();
            const price = branch.querySelector(".kb-price").value;
            const desc = branch.querySelector(".kb-desc").value.trim();

            if (name && price) {
                await addDoc(collection(db, "agents", currentAgent, "knowledge"), {
                    name: name,
                    price: Number(price),
                    description: desc,
                    inStock: true,
                    timestamp: new Date()
                });
            }
        }

        notify("Sync Complete", "Agent updated and live.", "success");
        
        // UI Reset for branches
        document.getElementById("kb-branches-container").innerHTML = `
            <div class="kb-branch-row">
                <input type="text" class="kb-name" placeholder="Item Name">
                <input type="number" class="kb-price" placeholder="Price (ETB)">
                <input type="text" class="kb-desc" placeholder="Details/Description">
                <button class="remove-branch-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    } catch (error) {
        console.error("Save Error:", error);
        notify("Sync Failed", "Connection interrupted. Please try again.", "error");
    } finally {
        saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Commit All to Memory`;
        saveBtn.disabled = false;
    }
}

// --- UPDATED LOAD KNOWLEDGE WITH VIEW TOGGLE ---

function loadKnowledge(agentId) {
    const q = query(collection(db, "agents", agentId, "knowledge"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById("kb-items-list");
        list.innerHTML = "";
        snapshot.forEach((snap) => {
            const data = snap.data();
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${data.name}</strong></td>
                <td>${data.price} ETB</td>
                <td style="color: var(--text-dim)">${data.description}</td>
                <td>
                    <button class="status-toggle ${data.inStock ? 'status-in' : 'status-out'}" 
                        onclick="toggleStock('${snap.id}', ${data.inStock})">
                        ${data.inStock ? 'In Stock' : 'Out of Stock'}
                    </button>
                    <i class="fa-solid fa-trash" style="margin-left:15px; cursor:pointer; color:#ef4444" 
                        onclick="deleteKBItem('${snap.id}')"></i>
                </td>`;
            list.appendChild(row);
        });
    });

    // View Switching Logic (Moved out of loops)
    const editBtn = document.getElementById("scroll-to-kb");
    editBtn.onclick = () => {
        const isEditing = document.body.classList.toggle("editing-mode");
        editBtn.innerHTML = isEditing 
            ? `<i class="fa-solid fa-chart-line"></i> View Live Monitor` 
            : `<i class="fa-solid fa-pen-to-square"></i> Edit Agent Knowledge`;
    };

    const addBranchBtn = document.getElementById("add-branch-btn");
    addBranchBtn.onclick = () => {
        const container = document.getElementById("kb-branches-container");
        const newBranch = document.createElement("div");
        newBranch.className = "kb-branch-row";
        newBranch.innerHTML = `
            <input type="text" class="kb-name" placeholder="Item Name">
            <input type="number" class="kb-price" placeholder="Price (ETB)">
            <input type="text" class="kb-desc" placeholder="Details/Description">
            <button class="remove-branch-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(newBranch);
    };
} // This closing bracket ends loadKnowledge

function listenToSettings(agentId) {
    onSnapshot(doc(db, "agents", agentId), (docSnap) => {
        if (docSnap.exists()) {
            const settings = docSnap.data();
            document.getElementById("ai-name-input").value = settings.aiDisplayName || "";
            document.getElementById("ai-instructions").value = settings.systemInstructions || "";
            
            const savedStyles = settings.personas || [];
            document.querySelectorAll(".persona-btn").forEach(btn => {
                btn.classList.toggle("active", savedStyles.includes(btn.dataset.style));
            });
        }
    });
}

// Global functions for table buttons
// Replace your existing global function block with this cleaner version:

// Bridge for HTML onclick events (Required for type="module")
window.toggleStock = async (id, currentStatus) => {
    try {
        const itemRef = doc(db, "agents", currentAgent, "knowledge", id);
        await updateDoc(itemRef, { inStock: !currentStatus });
        notify("Inventory Updated", "Stock status synced.", "success");
    } catch (e) {
        notify("Error", "Could not update stock.", "error");
    }
};

window.deleteKBItem = async (id) => {
    if (confirm("Permanently delete this item from AI memory?")) {
        try {
            await deleteDoc(doc(db, "agents", currentAgent, "knowledge", id));
            notify("Deleted", "Item removed from memory.", "success");
        } catch (e) {
            notify("Error", "Failed to delete.", "error");
        }
    }
};

function notify(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
    const duration = 4000; // 4 seconds

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="toast-content">
            <span class="toast-title">${title.toUpperCase()}</span>
            <span class="toast-msg">${message}</span>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-fill" style="width: 100%;"></div>
        </div>
    `;
    
    container.appendChild(toast);

    // Animate progress bar
    const fill = toast.querySelector(".toast-progress-fill");
    setTimeout(() => {
        fill.style.transition = `width ${duration}ms linear`;
        fill.style.width = "0%";
    }, 10);
    
    // Remove toast
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, duration);
}



// Fetch and Display History
// Fetch and Display History
async function loadHistory(agentId) {
    const historyList = document.getElementById("history-list");
    const hQuery = query(collection(db, "agents", agentId, "history"), orderBy("timestamp", "desc"));
    
    onSnapshot(hQuery, (snapshot) => {
        historyList.innerHTML = "";
        if (snapshot.empty) {
            historyList.innerHTML = '<div class="history-empty">No snapshots found.</div>';
            return;
        }

        snapshot.forEach((snap) => {
            const data = snap.data();
            const date = data.timestamp?.toDate().toLocaleString() || "Recent";
            
            // Clean the text to prevent it from breaking the HTML attribute
            const safeText = data.text.replace(/`/g, '\\`').replace(/\$/g, '\\$');

            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <span class="history-time">${date}</span>
                <p class="history-snippet">${data.text}</p>
                <button class="restore-btn" id="btn-${snap.id}">
                    <i class="fa-solid fa-rotate-left"></i> Set as Main
                </button>
            `;
            historyList.appendChild(card);

            // Safer way to attach the event than 'onclick' in HTML
            document.getElementById(`btn-${snap.id}`).addEventListener('click', () => {
                window.restoreInstruction(snap.id, data.text);
            });
        });
    });
}

// Restore Function (Bridge to window for module support)
window.restoreInstruction = async (id, text) => {
    if (confirm("Restore this version to the live editor?")) {
        document.getElementById("ai-instructions").value = text;
        closeHistory();
        notify("Version Restored", "Instruction moved to editor. Click 'Commit' to go live.", "success");
        
        // Auto-scroll to textarea so user sees it
        document.getElementById("ai-instructions").scrollIntoView({ behavior: 'smooth' });
    }
};

