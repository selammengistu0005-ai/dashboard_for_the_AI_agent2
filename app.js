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
const modeSwitch = document.getElementById("mode-switch");
const historyDrawer = document.getElementById("history-drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const openHistoryBtn = document.getElementById("open-history-btn");
const closeHistoryBtn = document.getElementById("close-history-btn");
const exportBtn = document.getElementById("export-logs-btn");
const liveMonitorView = document.getElementById("live-monitor-view");
const openActivityBtn = document.getElementById("open-activity-btn");
const activityView = document.getElementById("activity-view");
const backFromActivityBtn = document.getElementById("back-from-activity-btn");
const visitorCountBtn = document.getElementById("visitor-count-btn");
const visitorCountDisplay = document.getElementById("visitor-count-display");

let currentAgent = null;
let activityUnsubscribe = null;
let unsubscribe = null;

// 3. Visitor Count Button
if (visitorCountBtn) {
    visitorCountBtn.addEventListener("click", async () => {
        visitorCountDisplay.textContent = "...";
        try {
            const visitorRef = doc(db, "agents", currentAgent);
            const visitorSnap = await getDoc(visitorRef);
            if (visitorSnap.exists()) {
                const count = visitorSnap.data().count || 0;
                visitorCountDisplay.textContent = count;
            } else {
                visitorCountDisplay.textContent = "0";
            }
        } catch (err) {
            console.error("Visitor count error:", err);
            visitorCountDisplay.textContent = "!";
        }
    });
}

// 4. History Drawer Controls
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

// 5. Auth Logic
async function validateAndUnlock() {
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

    currentAgent = null;
    authError.innerText = "";
    unlockBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;

    try {
        const q = query(collection(db, "agents"), where("accessKey", "==", inputKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();
            currentAgent = docSnap.id;

            keyOverlay.style.display = "none";
            mainApp.style.display = "flex";

            logsContainer.innerHTML = '<div class="loading-state">Initialising Logs...</div>';

            loadLogs(currentAgent);
            if (activityView && activityView.style.display !== 'none') {
                loadClickStats(currentAgent);
            }

            const name = data.aiDisplayName || "Private Agent";
            notify("Welcome Back", `Authorized as ${name}`, "success");
        } else {
            throw new Error("Invalid Key");
        }
    } catch (e) {
        console.error("Auth Error:", e);
        authError.innerText = "Invalid Access Key - Access Denied";
        unlockBtn.innerText = "Authorize Dashboard";
        notify("Auth Failed", "Key not recognized", "error");
    }
}

// 6. Load Logs
function loadLogs(agentId) {
    if (unsubscribe) unsubscribe();

    const q = query(collection(db, "agents", agentId, "logs"), orderBy("timestamp", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        logsContainer.innerHTML = "";

        snapshot.forEach((doc) => {
            const data = doc.data();
            const intent = data.category || "General";
            const timestamp = data.timestamp?.toDate().toLocaleString() || "—";

            const frame = document.createElement("div");
            frame.className = "log-frame";
            frame.innerHTML = `
                <div class="log-cell">
                    <i class="fa-solid fa-comment-dots"></i>
                    <span>${data.question}</span>
                </div>
                <div class="log-cell">
                    <i class="fa-solid fa-robot"></i>
                    <span>${data.answer}</span>
                </div>
                <div class="log-cell">
                    <i class="fa-solid fa-clock"></i>
                    <span>${timestamp}</span>
                </div>
                <div class="log-cell">
                    <i class="fa-solid fa-tag"></i>
                    <span>${intent}</span>
                </div>
            `;
            logsContainer.appendChild(frame);
        });
    });
}

// 7. Auth Button
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

// Theme Toggle
if (modeSwitch) {
    modeSwitch.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
    });
}

// 8. Log Export
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

// 9. Reset log highlights when clicking background
document.addEventListener('click', (e) => {
    if (e.target.id === 'live-monitor-view' || e.target.classList.contains('logs-wrapper')) {
        document.querySelectorAll('.log-frame').forEach(log => {
            log.classList.remove('highlight-glow', 'dimmed');
        });
    }
});

// 10. Live Activity View
if (openActivityBtn) {
    openActivityBtn.addEventListener("click", () => {
        if (!currentAgent) {
            notify("Access Denied", "Authorize an agent first", "error");
            return;
        }
        liveMonitorView.style.display = "none";
        activityView.style.display = "flex";
        activityView.style.flexDirection = "column";
        loadClickStats(currentAgent);
    });
}

if (backFromActivityBtn) {
    backFromActivityBtn.addEventListener("click", () => {
        if (activityUnsubscribe) activityUnsubscribe();
        activityView.style.display = "none";
        liveMonitorView.style.display = "block";
    });
}

function loadClickStats(agentId) {
    if (activityUnsubscribe) activityUnsubscribe();

    const q = query(
        collection(db, "agents", agentId, "clicks"),
        orderBy("count", "desc")
    );

    activityUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("activity-table-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-dim); padding: 30px;">No click data yet.</td></tr>`;
            document.getElementById("stat-total-clicks").textContent = "0";
            document.getElementById("stat-top-button").textContent = "—";
            document.getElementById("stat-today-clicks").textContent = "0";
            document.getElementById("stat-buttons-tracked").textContent = "0";
            return;
        }

        let totalClicks = 0;
        let topButton = { name: "—", count: 0 };
        let todayClicks = 0;
        const todayStr = new Date().toDateString();
        let index = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const name = docSnap.id;
            const count = data.count || 0;
            const lastClicked = data.lastClicked?.toDate();
            const lastClickedStr = lastClicked ? lastClicked.toLocaleString() : "—";

            totalClicks += count;
            if (count > topButton.count) {
                topButton = { name, count };
            }
            if (lastClicked && lastClicked.toDateString() === todayStr) {
                todayClicks += count;
            }

            const tr = document.createElement("tr");
            tr.style.animationDelay = `${index * 0.05}s`;
            tr.innerHTML = `
                <td><span class="btn-name-link">${formatButtonName(name)}</span></td>
                <td><span class="click-count-badge"><i class="fa-solid fa-computer-mouse"></i> ${count}</span></td>
                <td class="dim">${lastClickedStr}</td>
            `;
            tbody.appendChild(tr);
            index++;
        });

        document.getElementById("stat-total-clicks").textContent = totalClicks;
        document.getElementById("stat-top-button").textContent = formatButtonName(topButton.name);
        document.getElementById("stat-today-clicks").textContent = todayClicks;
        document.getElementById("stat-buttons-tracked").textContent = snapshot.size;
    });
}

function formatButtonName(id) {
    return id
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

// 11. History Drawer
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

            document.getElementById(`btn-${snap.id}`).addEventListener('click', () => {
                window.restoreInstruction(snap.id, data.text);
            });
        });
    });
}

window.restoreInstruction = async (id, text) => {
    if (confirm("Restore this version to the live editor?")) {
        notify("Version Restored", "Snapshot loaded.", "success");
        closeHistory();
    }
};

// 12. Toast Notifications
function notify(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
    const duration = 4000;

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

    const fill = toast.querySelector(".toast-progress-fill");
    setTimeout(() => {
        fill.style.transition = `width ${duration}ms linear`;
        fill.style.width = "0%";
    }, 10);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, duration);
}
