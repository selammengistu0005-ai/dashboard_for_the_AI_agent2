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
        // 1. Update the Main Agent Settings (Identity & Logic)
        await updateDoc(doc(db, "agents", currentAgent), {
            aiDisplayName: aiName,
            personas: activePersonas,
            systemInstructions: systemInstructions,
            lastConfigUpdate: new Date()
        });

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

        alert("Agent Identity & Memory Synchronized!");
        
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
        alert("Sync Failed. Check console.");
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
window.toggleStock = (id, status) => updateDoc(doc(db, "agents", currentAgent, "knowledge", id), { inStock: !status });
window.deleteKBItem = (id) => {
    if(confirm("Delete this item?")) {
        deleteDoc(doc(db, "agents", currentAgent, "knowledge", id));
    }
};
// Add this at the very end to make the buttons clickable
document.querySelectorAll(".persona-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        btn.classList.toggle("active");
    });
});



