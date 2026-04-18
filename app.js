import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc,
    onSnapshot, 
    orderBy,
    doc, 
    addDoc,   
    updateDoc,
    writeBatch,
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
const exportBtn = document.getElementById("export-logs-btn");
const openPhoneVaultBtn = document.getElementById("open-phone-vault-btn");

// NEW FIXED HISTORY CONTROLS
if (openHistoryBtn) {
    openHistoryBtn.addEventListener("click", () => {
        if (!currentAgent) {
            notify("Access Denied", "Please authorize first", "error");
            return;
        }
        historyDrawer.classList.add("open");
        drawerOverlay.classList.add("active");
        loadHistory(currentAgent); 
    });
}

const closeHistory = () => {
    if (historyDrawer && drawerOverlay) {
        historyDrawer.classList.remove("open");
        drawerOverlay.classList.remove("active");
    }
};

if (closeHistoryBtn) closeHistoryBtn.addEventListener("click", closeHistory);
if (drawerOverlay) drawerOverlay.addEventListener("click", closeHistory);
let currentAgent = null;
let unsubscribe = null;
let intentChart = null;
let knowledgeUnsubscribe = null; // Add this at the top with your other lets

// 3. Auth Logic
// --- REPLACE YOUR EXISTING validateAndUnlock FUNCTION ---
async function validateAndUnlock() {
    // Move these inside so they are fetched when the button is clicked
    const keyInput = document.getElementById("agent-key-input");
    const unlockBtn = document.getElementById("unlock-btn");
    const keyOverlay = document.getElementById("key-overlay");
    const mainApp = document.getElementById("main-app");
    const authError = document.getElementById("auth-error");

    const inputKey = keyInput.value.trim();
    if (!inputKey) {
        notify("Required", "Please enter your Access Key", "error");
        return;
    }
    unlockBtn.innerText = "Verifying...";
    try {
        // We SEARCH the 'agents' collection for any document where 'accessKey' matches
        const q = query(collection(db, "agents"), where("accessKey", "==", inputKey));
        const querySnapshot = await getDocs(q);
        console.log("Documents found:", querySnapshot.size);

        if (!querySnapshot.empty) {
            // We found the agent!
            const docSnap = querySnapshot.docs[0]; 
            const data = docSnap.data();
            
            currentAgent = docSnap.id; // This sets the ID for the rest of the app
            keyOverlay.style.display = "none";
            mainApp.style.display = "flex";
            
            // Initialize the dashboard
            loadLogs(currentAgent);
            loadKnowledge(currentAgent);
            listenToSettings(currentAgent);
            
            notify("Welcome Back", `Authorized as ${data.aiDisplayName || 'Agent'}`, "success");
        } else {
            throw new Error("Invalid Key");
        }
    } catch (e) {
        console.error(e);
        authError.innerText = "Invalid Access Key";
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
            layout: {
                padding: 0 // Removes wasted space around the ring
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { 
                        color: isLight ? '#1e293b' : '#f8fafc',
                        font: { 
                            size: 13, // Increased from 10 to 13
                            weight: '600' // Makes the text bold and easier to read
                        },
                        boxWidth: 12,
                        padding: 15 // Space between the ring and the text
                    }
                }
            },
            cutout: '75%',
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const clickedIntent = intentChart.data.labels[index];
                    applyIntentHighlight(clickedIntent);
                } else {
                    resetHighlights();
                }
            }
        }
    });
}

// 6. Events
// 6. Events (Add these at the bottom of your script)
// --- REPLACE YOUR SECTION 6 (EVENTS) WITH THIS ---

// Auth Button
const uBtn = document.getElementById("unlock-btn");
if (uBtn) uBtn.addEventListener("click", validateAndUnlock);

// Enter Key on Input
const kInput = document.getElementById("agent-key-input");
if (kInput) {
    kInput.addEventListener("keypress", (e) => e.key === "Enter" && validateAndUnlock());
}

// Password Eye Toggle
const eye = document.getElementById("toggle-password-eye");
if (eye && kInput) {
    eye.addEventListener("click", () => {
        const type = kInput.getAttribute("type") === "password" ? "text" : "password";
        kInput.setAttribute("type", type);
        eye.classList.toggle("fa-eye");
        eye.classList.toggle("fa-eye-slash");
    });
}

// Logo Refresh
const lRefresh = document.getElementById("logo-refresh");
if (lRefresh) lRefresh.addEventListener("click", () => window.location.reload());
// INSERT THE THEME TOGGLE CODE HERE:
// Theme Toggle Logic
if (modeSwitch) {
    modeSwitch.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        const isLight = document.body.classList.contains("light-mode");
        if (intentChart) {
            intentChart.options.plugins.legend.labels.color = isLight ? '#1e293b' : '#f8fafc';
            intentChart.update();
        }
    });
}

if (openPhoneVaultBtn) {
    openPhoneVaultBtn.addEventListener("click", () => {
        // First check if an agent is authorized
        if (!currentAgentId) {
            notify("Access Denied", "Please authorize an agent first", "error");
            return;
        }

        // For now, let's trigger a success notification to prove it works
        notify("Phone Vault", "Fetching patient records...", "success");
        
        // This is where we will eventually call the function to show the list
        console.log("Phone Vault Clicked for Agent:", currentAgentId);
    });
}

// --- KNOWLEDGE BASE ENGINE ---

async function saveKnowledge() {
    const saveBtn = document.getElementById("add-kb-item");
    const aiName = document.getElementById("ai-name-input").value.trim();
    const systemInstructions = document.getElementById("ai-instructions").value.trim();
    const activePersonas = Array.from(document.querySelectorAll(".persona-btn.active")).map(btn => btn.dataset.style);
    const branches = document.querySelectorAll(".kb-branch-row");
    
    if (!currentAgent) return;

    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing Brain...`;
    saveBtn.disabled = true;

    try {
        const batch = writeBatch(db);

        // 1. Update Main Settings & Tree Structure
        const agentRef = doc(db, "agents", currentAgent);
        
        batch.update(agentRef, {
            aiDisplayName: aiName,
            personas: activePersonas,
            systemInstructions: systemInstructions,
            lastConfigUpdate: new Date()
        });

        // 2. Archive to History
        if (systemInstructions) {
            const historyRef = doc(collection(db, "agents", currentAgent, "history"));
            batch.set(historyRef, {
                text: systemInstructions,
                timestamp: new Date(),
                author: "Admin" 
            });
        }

        // 3. Save New Inventory Items (from the list rows)
        branches.forEach((branch) => {
            const name = branch.querySelector(".kb-name").value.trim();
            const price = branch.querySelector(".kb-price").value;
            const desc = branch.querySelector(".kb-desc").value.trim();

            if (name && price) {
                const newKbRef = doc(collection(db, "agents", currentAgent, "knowledge"));
                batch.set(newKbRef, {
                    name: name,
                    price: Number(price),
                    description: desc,
                    inStock: true,
                    timestamp: new Date()
                });
            }
        });

        await batch.commit();
        notify("Sync Complete", "Agent brain updated.", "success");
        
        // Reset branches UI
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
        notify("Sync Failed", "Check your connection and try again.", "error");
    } finally {
        saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Commit All to Memory`;
        saveBtn.disabled = false;
    }
    
}

function loadKnowledge(agentId) {
    // 1. Kill the old listener if it exists before starting a new one
    if (knowledgeUnsubscribe) knowledgeUnsubscribe(); 
    
    const q = query(collection(db, "agents", agentId, "knowledge"), orderBy("timestamp", "desc"));
    
    knowledgeUnsubscribe = onSnapshot(q, (snapshot) => {
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
}
// NEW FIXED KNOWLEDGE BASE CONTROLS
// --- REPLACED: NEW HORIZONTAL MODE SWITCHER ---
const scrollBtn = document.getElementById("scroll-to-kb");
if (scrollBtn) {
    scrollBtn.onclick = () => {
        const isEditing = document.body.classList.toggle("editing-mode");
        scrollBtn.innerHTML = isEditing 
            ? `<i class="fa-solid fa-chart-line"></i> View Live Monitor` 
            : `<i class="fa-solid fa-pen-to-square"></i> Edit Agent Knowledge`;
    };
}

const addBranchBtn = document.getElementById("add-branch-btn");
if (addBranchBtn) {
    addBranchBtn.onclick = () => {
        const container = document.getElementById("kb-branches-container");
        if (!container) return;
        const newBranch = document.createElement("div");
        newBranch.className = "kb-branch-row";
        newBranch.innerHTML = `
            <input type="text" class="kb-name" placeholder="Item Name">
            <input type="number" class="kb-price" placeholder="Price (ETB)">
            <input type="text" class="kb-desc" placeholder="Details/Description">
            <button class="remove-branch-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(newBranch);
    };
}
const saveKbBtn = document.getElementById("add-kb-item");
if (saveKbBtn) saveKbBtn.addEventListener("click", saveKnowledge);

let isInitialLoad = true; // Add this variable above the function

function listenToSettings(agentId) {
    onSnapshot(doc(db, "agents", agentId), (docSnap) => {
        if (docSnap.exists()) {
            const settings = docSnap.data();
            
            // Only update inputs if the user isn't currently typing in them
            if (document.activeElement !== document.getElementById("ai-name-input")) {
                document.getElementById("ai-name-input").value = settings.aiDisplayName || "";
            }
            if (document.activeElement !== document.getElementById("ai-instructions")) {
                document.getElementById("ai-instructions").value = settings.systemInstructions || "";
            }
            
            // CRITICAL FIX: Only reset buttons if the user is NOT in editing mode
            if (!document.body.classList.contains("editing-mode")) {
                const savedStyles = settings.personas || [];
                document.querySelectorAll(".persona-btn").forEach(btn => { 
                    btn.classList.toggle("active", savedStyles.includes(btn.dataset.style));
                });
            }
        }
    });
}

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

// Persona Matrix Toggle Logic
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('persona-btn')) {
        // .toggle() allows multiple buttons to be active at once
        e.target.classList.toggle('active');
        
        // Optional: Add a subtle click sound or haptic feedback feel
        const isActive = e.target.classList.contains('active');
        console.log(`${e.target.dataset.style} is now ${isActive ? 'selected' : 'unselected'}`);
    }
});

// --- LOG EXPORT SYSTEM ---
if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
        if (!currentAgent) {
            notify("Access Denied", "Please authorize first", "error");
            return;
        }

        const originalContent = exportBtn.innerHTML;
        exportBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing...`;
        
        try {
            const q = query(collection(db, "agents", currentAgent, "logs"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                notify("No Data", "There are no conversations to export.", "error");
                exportBtn.innerHTML = originalContent;
                return;
            }

            let csvContent = "Timestamp,User Question,AI Answer,Intent\n";

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const time = data.timestamp?.toDate().toLocaleString().replace(/,/g, "") || "N/A";
                const question = `"${(data.question || "").replace(/"/g, '""')}"`; 
                const answer = `"${(data.answer || "").replace(/"/g, '""')}"`;     
                const intent = data.category || "General";
                csvContent += `${time},${question},${answer},${intent}\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Agent_Logs_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            notify("Export Successful", "CSV file generated.", "success");
        } catch (error) {
            console.error("Export Error:", error);
            notify("Export Failed", "Check database permissions.", "error");
        } finally {
            exportBtn.innerHTML = originalContent;
        }
    });
}

// Function to make matching cards glow
function applyIntentHighlight(intentName) {
    const allLogs = document.querySelectorAll('.log-frame');
    let firstMatch = null;
    
    allLogs.forEach(log => {
        const logIntent = log.querySelector('.intent-tag').innerText.replace(/\s+/g, ' ').trim();
        
        if (logIntent.includes(intentName)) {
            log.classList.add('highlight-glow');
            log.classList.remove('dimmed');
            
            // Capture the first matching card we find
            if (!firstMatch) firstMatch = log;
        } else {
            log.classList.add('dimmed');
            log.classList.remove('highlight-glow');
        }
    });

    // If we found a match, scroll to it automatically
    if (firstMatch) {
        firstMatch.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
}

// Function to remove the glow
function resetHighlights() {
    const allLogs = document.querySelectorAll('.log-frame');
    allLogs.forEach(log => {
        log.classList.remove('highlight-glow', 'dimmed');
    });
}

// Reset when clicking the background of the live monitor
document.addEventListener('click', (e) => {
    if (e.target.id === 'live-monitor-view' || e.target.classList.contains('logs-wrapper')) {
        resetHighlights();
    }
});
