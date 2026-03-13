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

        // 1. Update Main Settings & Tree Structure
        const agentRef = doc(db, "agents", currentAgent);
        const visualTree = getTreeData(); // Get the current tree state
        
        batch.update(agentRef, {
            aiDisplayName: aiName,
            personas: activePersonas,
            systemInstructions: systemInstructions,
            lastConfigUpdate: new Date(),
            knowledgeTree: visualTree // This saves your visual map layout!
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
        notify("Sync Complete", "Agent brain and visual map updated.", "success");
        
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
window.getTreeData = getTreeData;

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

let isInitialLoad = true; // Add this variable above the function

function listenToSettings(agentId) {
    onSnapshot(doc(db, "agents", agentId), (docSnap) => {
        if (docSnap.exists()) {
            const settings = docSnap.data();
            
            // Only update the name/instructions if the user isn't currently typing (prevents cursor jumping)
            if (document.activeElement !== document.getElementById("ai-name-input")) {
                document.getElementById("ai-name-input").value = settings.aiDisplayName || "";
            }
            if (document.activeElement !== document.getElementById("ai-instructions")) {
                document.getElementById("ai-instructions").value = settings.systemInstructions || "";
            }
            
            const savedStyles = settings.personas || [];
            document.querySelectorAll(".persona-btn").forEach(btn => {
                btn.classList.toggle("active", savedStyles.includes(btn.dataset.style));
            });

            // GATEKEEPER: Only rebuild the visual tree on the first load
            // This prevents the map from "refreshing" while you are editing it
            if (isInitialLoad && settings.knowledgeTree) {
                rebuildTreeFromData(settings.knowledgeTree);
                isInitialLoad = false; 
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

function drawTreeConnections() {
    const svg = document.getElementById('tree-svg');
    const canvas = document.querySelector('.tree-canvas');
    if (!svg || !canvas) return;
    const scrollW = canvas.scrollWidth;
    const scrollH = canvas.scrollHeight;
    svg.setAttribute('width', scrollW);
    svg.setAttribute('height', scrollH);
    
    svg.innerHTML = ''; 

    const nodes = document.querySelectorAll('.tree-node');
    const canvasRect = canvas.getBoundingClientRect();

    nodes.forEach(node => {
        const nodeId = node.dataset.id;
        const children = document.querySelectorAll(`[data-parent="${nodeId}"]`);

        // --- FIND THIS SECTION IN app.js (around line 423) ---

        children.forEach(child => {
            const pRect = node.getBoundingClientRect();
            const cRect = child.getBoundingClientRect();
            const startX = (cRect.left - canvasRect.left) + canvas.scrollLeft + (cRect.width / 2);
            const startY = (cRect.top - canvasRect.top) + canvas.scrollTop; 
            const endX = (pRect.left - canvasRect.left) + canvas.scrollLeft + (pRect.width / 2);
            const endY = (pRect.top - canvasRect.top) + canvas.scrollTop + pRect.height; 

            const cpY = startY + (endY - startY) / 2; 
            const d = `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", d);
            path.classList.add("logic-flow-path"); 
            
            // Optional: Re-applying inline styles if your CSS class doesn't cover everything
            path.style.stroke = "var(--primary-accent)";
            path.style.strokeWidth = "2";
            path.style.fill = "none";
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

// --- REPLACE YOUR addNewNode FUNCTION (Around line 335) ---
window.addNewNode = (parentId) => {
    const parentNode = document.querySelector(`[data-id="${parentId}"]`);
    if (!parentNode) return;

    const parentGroup = parentNode.closest('.node-group');
    let childrenContainer = parentGroup.querySelector(':scope > .children-container');
    
    if (!childrenContainer) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        parentGroup.appendChild(childrenContainer);
    }

    const id = "node-" + Date.now();
    const newNodeGroup = document.createElement("div");
    newNodeGroup.className = "node-group";

    const parentDepth = parseInt(parentNode.className.match(/depth-(\d+)/)?.[1] || 1);
    const newDepth = Math.min(parentDepth + 1, 4); 
    
    newNodeGroup.innerHTML = `
        <div class="tree-node depth-${newDepth}" data-id="${id}" data-parent="${parentId}">
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
            <div class="node-actions">
                <button class="add-branch-btn" onclick="addNewNode('${id}')">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="delete-node-btn" onclick="deleteNode('${id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>`;

    childrenContainer.appendChild(newNodeGroup);
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            drawTreeConnections();
        });
    });
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

window.deleteNode = (nodeId) => {
    const node = document.querySelector(`[data-id="${nodeId}"]`);
    if (!node) return;
    
    // Don't allow deleting the root node
    if (node.classList.contains('depth-1')) {
        notify("Action Denied", "Cannot delete the core Root node.", "error");
        return;
    }

    if (confirm("Delete this branch and all its sub-children?")) {
        const group = node.closest('.node-group');
        group.remove();
        drawTreeConnections(); // Clean up the lines
    }
};

// --- AUTO-REDRAW OBSERVER ---
const canvasObserver = new ResizeObserver(() => {
    if (document.body.classList.contains("editing-mode")) {
        drawTreeConnections();
    }
});

// Start observing the canvas for size changes
const treeCanvasElement = document.querySelector('.tree-canvas');
if (treeCanvasElement) {
    canvasObserver.observe(treeCanvasElement);
}

// Helper to extract the visual tree into a structured object for Firebase
function getTreeData() {
    const nodes = document.querySelectorAll('.tree-node');
    const treeMap = [];
    
    nodes.forEach(node => {
        const nameInput = node.querySelector('.node-name');
        treeMap.push({
            id: node.dataset.id,
            parentId: node.dataset.parent || null,
            label: nameInput ? nameInput.value.trim() : "Untitled",
            shade: node.classList.contains('green-shade') ? 'green' : 
                   node.classList.contains('yellow-shade') ? 'yellow' : 
                   node.classList.contains('red-shade') ? 'red' : 'default'
        });
    });
    return treeMap;
}

function rebuildTreeFromData(treeData) {
    if (!treeData || !treeData.length) return;

    // 1. Update the Root Node first (it always exists)
    const rootData = treeData.find(item => item.parentId === null);
    if (rootData) {
        const rootNode = document.querySelector('.tree-node.depth-1');
        if (rootNode) {
            rootNode.dataset.id = rootData.id; // Sync the ID
            rootNode.querySelector('.node-name').value = rootData.label;
            window.changeNodeShade(rootData.id, rootData.shade);
        }
    }

    // 2. Sort data by depth or simply loop multiple times to ensure parents exist
    // A simple trick: render in the order they appear in the array, 
    // but filter out the root.
    const children = treeData.filter(item => item.parentId !== null);
    
    // We sort by ID length or similar if needed, but usually, 
    // the saved order from getTreeData works if we use a simple loop.
    children.forEach(item => {
        renderSavedNode(item);
    });

    setTimeout(drawTreeConnections, 500);
}

function renderSavedNode(data) {
    // 1. Manually trigger the creation logic but pass the saved ID
    const parentNode = document.querySelector(`[data-id="${data.parentId}"]`);
    if (!parentNode) return;

    const parentGroup = parentNode.closest('.node-group');
    let childrenContainer = parentGroup.querySelector(':scope > .children-container');
    
    if (!childrenContainer) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        parentGroup.appendChild(childrenContainer);
    }

    const newNodeGroup = document.createElement("div");
    newNodeGroup.className = "node-group";
    const parentDepth = parseInt(parentNode.className.match(/depth-(\d+)/)?.[1] || 1);
    const newDepth = Math.min(parentDepth + 1, 4); 

    newNodeGroup.innerHTML = `
        <div class="tree-node depth-${newDepth}" data-id="${data.id}" data-parent="${data.parentId}">
            <div class="node-content">
                <div class="node-main-info">
                    <i class="fa-solid fa-circle node-status-dot"></i>
                    <input type="text" class="node-name" value="${data.label}">
                </div>
                <div class="node-color-picker">
                    <span class="dot green" onclick="changeNodeShade('${data.id}', 'green')"></span>
                    <span class="dot yellow" onclick="changeNodeShade('${data.id}', 'yellow')"></span>
                    <span class="dot red" onclick="changeNodeShade('${data.id}', 'red')"></span>
                </div>
            </div>
            <div class="node-actions">
                <button class="add-branch-btn" onclick="addNewNode('${data.id}')">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="delete-node-btn" onclick="deleteNode('${data.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>`;

    childrenContainer.appendChild(newNodeGroup);
    window.changeNodeShade(data.id, data.shade);
}
// Exporting functions to window so HTML onclick attributes can find them
window.deleteNode = deleteNode;
window.changeNodeShade = changeNodeShade;
window.addNewNode = addNewNode;

// Function to snap back to the center Root
window.recenterTree = () => {
    const rootNode = document.querySelector('.tree-node.depth-1');
    if (rootNode) {
        rootNode.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center', 
            inline: 'center' 
        });
        notify("Map Recentered", "Back at the Root node.", "success");
    }
};

export function resetCanvas() {
    const canvas = document.getElementById('tree-canvas');
    const viewport = document.querySelector('.tree-viewport');
    const rootNode = document.querySelector('.tree-node[data-id="root"]');

    if (!canvas || !rootNode) return;

    // 1. Get dimensions
    const vWidth = viewport.offsetWidth;
    const vHeight = viewport.offsetHeight;

    // 2. Get Root Node Position relative to the 5000px canvas
    // We use offsetLeft/Top because the node is inside the canvas
    const rootX = rootNode.parentElement.offsetLeft + (rootNode.offsetWidth / 2);
    const rootY = rootNode.parentElement.offsetTop + (rootNode.offsetHeight / 2);

    // 3. Calculate the translation needed to put Root in the middle of the Viewport
    const translateX = (vWidth / 2) - rootX;
    const translateY = (vHeight / 2) - rootY;

    // 4. Apply the transform (Resetting scale to 1)
    canvas.style.transition = "transform 0.5s cubic-bezier(0.2, 0, 0.2, 1)";
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(1)`;
    
    // Clear transition after it finishes so dragging stays smooth
    setTimeout(() => {
        canvas.style.transition = "none";
    }, 500);
}

// Attach the listener
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('[onclick="resetCanvas()"]');
    if(btn) {
        btn.removeAttribute('onclick'); // Clean up the HTML attribute
        btn.addEventListener('click', resetCanvas);
    }
});
