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
// 3. Auth Logic (Access Key Only Version)
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

        // 1. Update Main Settings
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

        // 3. Save New Inventory Items
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

        await batch.commit(); // Sends EVERYTHING in one shot!

        notify("Sync Complete", "Agent updated and live.", "success");
        
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
window.saveKnowledge = saveKnowledge;

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
        const liveMonitor = document.querySelector(".logs-wrapper"); // Target the logs
        const liveChart = document.querySelector(".sidebar-chart-container"); // Target sidebar chart

        // This keeps your cool transformation text
        scrollBtn.innerHTML = isEditing 
            ? `<i class="fa-solid fa-chart-line"></i> View Live Monitor` 
            : `<i class="fa-solid fa-pen-to-square"></i> Edit Agent Knowledge`;

        if (isEditing) {
            // 1. Hide the Monitor stuff so it doesn't bleed through
            if(liveMonitor) liveMonitor.style.display = "none";
            
            // 2. Initialize the Horizontal Map
            setTimeout(() => {
                window.initCanvas();
                const rootNode = document.querySelector('.tree-node');
                if (rootNode) rootNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        } else {
            // 3. Bring the Monitor back when we exit Edit Mode
            if(liveMonitor) liveMonitor.style.display = "block";
        }
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

// Persona Matrix Toggle Logic
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('persona-btn')) {
        // Toggle 'active' class on click
        e.target.classList.toggle('active');
        
        // Optional: Add a subtle click sound or haptic feedback feel
        const isActive = e.target.classList.contains('active');
        console.log(`${e.target.dataset.style} is now ${isActive ? 'selected' : 'unselected'}`);
    }
});

const treeCanvas = document.querySelector('.tree-canvas');
const svgElement = document.getElementById('tree-svg');

// Initial draw and resize listener
window.addEventListener('resize', drawTreeConnections);
// Redraw lines when the "Site Map" section becomes visible
document.getElementById("scroll-to-kb").addEventListener('click', () => {
    setTimeout(drawTreeConnections, 100); 
});

const viewport = document.querySelector('.tree-viewport');
let isDown = false;
let startX, startY, scrollLeft, scrollTop;

viewport.addEventListener('mousedown', (e) => {
    isDown = true;
    viewport.classList.add('active'); // CSS can change cursor to 'grabbing'
    startX = e.pageX - viewport.offsetLeft;
    startY = e.pageY - viewport.offsetTop;
    scrollLeft = viewport.scrollLeft;
    scrollTop = viewport.scrollTop;
});

viewport.addEventListener('mouseleave', () => isDown = false);
viewport.addEventListener('mouseup', () => isDown = false);

viewport.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - viewport.offsetLeft;
    const y = e.pageY - viewport.offsetTop;
    const walkX = (x - startX) * 1.5; 
    const walkY = (y - startY) * 1.5;
    viewport.scrollLeft = scrollLeft - walkX;
    viewport.scrollTop = scrollTop - walkY;
});

// --- 🌳 THE SITE MAP CANVAS ENGINE (OPTIMIZED) ---

/**
 * 1. The Connector Logic
 */
function drawTreeConnections() {
    const svg = document.getElementById('tree-svg');
    const canvas = document.querySelector('.tree-canvas');
    if (!svg || !canvas) return;

    svg.setAttribute('width', canvas.scrollWidth);
    svg.setAttribute('height', canvas.scrollHeight);
    svg.innerHTML = ''; 

    const nodes = document.querySelectorAll('.tree-node');
    const canvasRect = canvas.getBoundingClientRect();

    nodes.forEach(node => {
        const nodeId = node.dataset.id;
        const children = document.querySelectorAll(`[data-parent="${nodeId}"]`);

        // --- REPLACE THE MATH INSIDE THE children.forEach LOOP ---

        children.forEach(child => {
            const pRect = node.getBoundingClientRect();
            const cRect = child.getBoundingClientRect();

            // FIX: Add window.scroll to get absolute page coordinates, 
            // then subtract canvas offset to get local SVG coordinates.
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            // 1. START at the Child (Top-Center)
            const startX = (cRect.left + scrollX) - (canvasRect.left + scrollX) + (cRect.width / 2);
            const startY = (cRect.top + scrollY) - (canvasRect.top + scrollY); 
            
            // 2. END at the Parent (Bottom-Center)
            const endX = (pRect.left + scrollX) - (canvasRect.left + scrollX) + (pRect.width / 2);
            const endY = (pRect.top + scrollY) - (canvasRect.top + scrollY) + pRect.height; 

            // 3. Create the Curve
            const cpY = startY + (endY - startY) / 2; 
            const d = `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`;
// --- END OF REPLACEMENT ---

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", d);
            
            // Apply the styles and the animation class
            path.classList.add("logic-flow-path"); 
            path.style.stroke = "var(--primary-accent)";
            path.style.strokeWidth = "2";
            path.style.fill = "none";
            path.style.opacity = "0.6";
            
            // dasharray: first number is dot length, second is gap
            path.setAttribute("stroke-dasharray", "4, 12"); 
            
            svg.appendChild(path);
        });
    });
}

window.initCanvas = () => {
    drawTreeConnections();
};

// Call init when switching to edit mode
document.getElementById("scroll-to-kb").addEventListener('click', () => {
    setTimeout(window.initCanvas, 300);
});

window.addNewNode = (parentId) => {
    const parentNode = document.querySelector(`[data-id="${parentId}"]`);
    if (!parentNode) return;

    // 1. Ensure a children-container exists inside the parent's group
    let childrenContainer = parentNode.parentElement.querySelector('.children-container');
    if (!childrenContainer) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        parentNode.parentElement.appendChild(childrenContainer);
    }

    const id = "node-" + Date.now();
    const newNodeGroup = document.createElement("div");
    newNodeGroup.className = "node-group"; // This is the vertical anchor

    const newNode = document.createElement("div");
    
    // 2. Depth Logic: Check parent's depth to assign child's depth
    let depth = 1;
    if (parentNode.classList.contains('depth-1')) depth = 2;
    else if (parentNode.classList.contains('depth-2')) depth = 3;
    else if (parentNode.classList.contains('depth-3')) depth = 4;
    
    newNode.className = `tree-node depth-${depth}`; 
    newNode.dataset.id = id;
    newNode.dataset.parent = parentId;

    newNode.innerHTML = `
        <div class="node-content">
            <div class="node-main-info">
                <i class="fa-solid fa-circle node-status-dot"></i>
                <input type="text" class="node-name" placeholder="Branch Label...">
            </div>
            <div class="node-color-picker">
                <span class="dot green" onclick="changeNodeShade('${id}', 'green')"></span>
                <span class="dot yellow" onclick="changeNodeShade('${id}', 'yellow')"></span>
                <span class="dot red" onclick="changeNodeShade('${id}', 'red')"></span>
            </div>
        </div>
        <button class="add-branch-btn" onclick="addNewNode('${id}')">
            <i class="fa-solid fa-plus"></i>
        </button>
    `;

    // 3. Append to the container and trigger line redraw
    newNodeGroup.appendChild(newNode);
    childrenContainer.appendChild(newNodeGroup);
    
    // Give the DOM a millisecond to breathe before drawing lines
    setTimeout(drawTreeConnections, 50); 
};

// Add this helper function below addNewNode
window.changeNodeShade = (nodeId, color) => {
    const node = document.querySelector(`[data-id="${nodeId}"]`);
    if (!node) return;
    // Remove all possible shades first
    node.classList.remove('green-shade', 'yellow-shade', 'red-shade');
    // Add the new one
    node.classList.add(`${color}-shade`);
};



