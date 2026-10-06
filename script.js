const firebaseConfig = {
    apiKey: "AIzaSyCsTrVR-aRxIRju_StLHOXdnOBK8Yzyu1E",
    authDomain: "byn-avenue-data.firebaseapp.com",
    projectId: "byn-avenue-data",
    storageBucket: "byn-avenue-data.firebasestorage.app",
    messagingSenderId: "1076216863590",
    appId: "1:1076216863590:web:f7f3c4359f7519c0cfc6a7"
};

const USE_FIREBASE = firebaseConfig.apiKey.indexOf("YAHAN") === -1;
const DB_PATH = "team-tasks";
let db = null;

const PASSWORDS = {
    admin: "admin123",
    Bilal: "bilal123",
    Yasir: "yasir123",
    Basit: "basit123",
    Nehal: "nehal123"
};

const API = "https://jsonblob.com/api/jsonBlob";
const LS_KEY = "tt_tasks_v4";
const LS_WEEK = "tt_week_v4";

const DEFAULT_TASKS = [
    { id: 1, member: "Bilal", text: "Website ka homepage design karo", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 2, member: "Bilal", text: "Client ko email ka reply do", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 3, member: "Yasir", text: "Social media posts schedule karo", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 4, member: "Yasir", text: "Report prepare karo (Friday tak)", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 5, member: "Basit", text: "Data entry ka kaam complete karo", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 6, member: "Nehal", text: "Content writing — 2 blogs", status: "pending", doneMsg: "", doneAt: "", proof: "" },
    { id: 7, member: "Nehal", text: "Team meeting ka agenda banao", status: "pending", doneMsg: "", doneAt: "", proof: "" }
];

const MEMBERS = [
    { name: "Bilal", color: "#38bdf8" },
    { name: "Yasir", color: "#f59e0b" },
    { name: "Basit", color: "#22c55e" },
    { name: "Nehal", color: "#e879f9" }
];

function currentMonday() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}
function nextMondayStr(mondayStr) {
    const d = new Date(mondayStr + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
}

let weekStart = localStorage.getItem(LS_WEEK) || "";
let tasks = [];
let blobId = new URLSearchParams(location.search).get("team") || localStorage.getItem("tt_blob_id") || "";
let isAdmin = false;
let adminUnlocked = false;
const unlockedRooms = {};
let modalTaskId = null;
let currentRoom = null;
let pickedProof = null;

if (weekStart !== currentMonday()) {
    weekStart = currentMonday();
    tasks = [];
} else {
    tasks = JSON.parse(localStorage.getItem(LS_KEY) || "null") || DEFAULT_TASKS;
}
localStorage.setItem(LS_WEEK, weekStart);
localStorage.setItem(LS_KEY, JSON.stringify(tasks));

function setSync(s, txt) {
    document.getElementById("syncDot").className = "dot " + s;
    document.getElementById("syncText").textContent = txt;
}

function teamUrl() {
    return location.protocol === "file:"
        ? location.href.split("?")[0] + "?team=" + blobId
        : location.origin + location.pathname + "?team=" + blobId;
}

function startFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        setSync("y", "Firebase connect ho raha hai...");
        /* Realtime listener — sab devices par foran update */
        db.ref(DB_PATH).on("value", snap => {
            const data = snap.val();
            if (data && Array.isArray(data.tasks)) {
                if (data.week !== currentMonday()) {
                    tasks = []; weekStart = currentMonday();
                    localStorage.setItem(LS_WEEK, weekStart);
                    db.ref(DB_PATH).set({ week: weekStart, tasks: [] });
                } else {
                    tasks = data.tasks;
                }
                localStorage.setItem(LS_KEY, JSON.stringify(tasks));
            } else {
                db.ref(DB_PATH).set({ week: weekStart, tasks: tasks });
            }
            setSync("g", "Live ✓ (Firebase)");
            render();
        }, err => {
            setSync("r", "Firebase error: " + err.message);
            startJsonBlob();
        });
    } catch (e) {
        startJsonBlob();
    }
}
async function ensureBlob() {
    if (blobId) return;
    setSync("y", "Sync setup ho raha hai...");
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ week: weekStart, tasks }) });
    const loc = res.headers.get("Location") || "";
    blobId = loc.split("/").filter(Boolean).pop();
    if (!blobId) throw new Error("no id");
    localStorage.setItem("tt_blob_id", blobId);
    history.replaceState(null, "", "?team=" + blobId);
    document.getElementById("teamLink").textContent = teamUrl();
}

async function pull(manual) {
    if (USE_FIREBASE) return; // firebase listener khud handle karta hai
    try {
        if (manual) setSync("y", "La rahe hain...");
        await ensureBlob();
        const res = await fetch(API + "/" + blobId, { headers: { "Accept": "application/json" } });
        if (res.status === 404) { blobId = ""; localStorage.removeItem("tt_blob_id"); await ensureBlob(); return; }
        if (!res.ok) throw new Error("http " + res.status);
        const data = await res.json();
        if (data && Array.isArray(data.tasks)) {
            if (data.week !== currentMonday()) {
                tasks = []; weekStart = currentMonday();
                localStorage.setItem(LS_WEEK, weekStart);
                push();
            } else {
                tasks = data.tasks;
            }
            localStorage.setItem(LS_KEY, JSON.stringify(tasks));
        }
        setSync("g", "Synced ✓");
        render();
    } catch (e) {
        setSync("r", "Offline — sirf is device ka data");
        render();
    }
}

function startJsonBlob() { pull(false); setInterval(() => { if (!modalTaskId) pull(false); }, 30000); }

let pushTimer = null;
function push() {
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
    render();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        const payload = { week: weekStart, tasks: tasks };
        if (USE_FIREBASE && db) {
            setSync("y", "Sync ho raha hai...");
            db.ref(DB_PATH).set(payload).catch(e => setSync("r", "Sync fail: " + e.message));
        } else if (blobId) {
            setSync("y", "Sync ho raha hai...");
            fetch(API + "/" + blobId, { method: "PUT", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
                .then(() => setSync("g", "Synced ✓"))
                .catch(() => setSync("r", "Sync fail — phir try karein"));
        } else {
            pull(false);
        }
    }, 400);
}

function fileToCompressedDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const maxW = 900;
                const scale = Math.min(1, maxW / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.6));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function memberPct(name) {
    const mine = tasks.filter(t => t.member === name);
    const done = mine.filter(t => t.status === "completed").length;
    return { pct: mine.length ? Math.round(done / mine.length * 100) : 0, done, total: mine.length };
}

function render() {
    const m1 = new Date(weekStart + "T00:00:00");
    const m2 = new Date(nextMondayStr(weekStart) + "T00:00:00");
    const fmt = d => d.toLocaleDateString("en-GB", { day: 'numeric', month: 'short' });
    document.getElementById("weekRange").textContent = fmt(m1) + " (Mon) → " + fmt(m2) + " (Mon)";

    const rooms = document.getElementById("rooms");
    rooms.innerHTML = "";
    MEMBERS.forEach(m => {
        const s = memberPct(m.name);
        const pending = s.total - s.done;
        const card = document.createElement("div");
        card.className = "room-card";
        card.onclick = () => tryOpenRoom(m.name);
        card.innerHTML = `
      <span class="lock">${unlockedRooms[m.name] ? "🔓" : "🔒"}</span>
      <div class="avatar" style="background:${m.color}">${m.name[0]}</div>
      <h3>${m.name}</h3>
      <div class="pending">${pending} pending task${pending === 1 ? "" : "s"}</div>
      <div class="mini-bar"><div class="mini-fill" style="width:${s.pct}%;background:${m.color}"></div></div>
      <div class="mini-pct" style="color:${m.color}">${s.pct}% complete (${s.done}/${s.total})</div>
      <div class="enter">${unlockedRooms[m.name] ? "Room khula hai — click karein" : "Password daalein — click karein"} →</div>`;
        rooms.appendChild(card);
    });

    // Room view
    if (currentRoom) {
        const m = MEMBERS.find(x => x.name === currentRoom);
        const s = memberPct(currentRoom);
        const mine = tasks.filter(t => t.member === currentRoom && t.status === "pending");
        const myDone = tasks.filter(t => t.member === currentRoom && t.status === "completed");
        document.getElementById("roomAvatar").style.background = m.color;
        document.getElementById("roomAvatar").textContent = currentRoom[0];
        document.getElementById("roomName").textContent = currentRoom + " ka Room 🚪";
        document.getElementById("roomSub").textContent = mine.length + " pending • " + myDone.length + " complete is week";
        document.getElementById("roomPctText").textContent = s.done + " / " + s.total + " tasks";
        const bar = document.getElementById("roomBar");
        bar.style.width = s.pct + "%"; bar.textContent = s.pct + "%";

        const list = document.getElementById("roomTasks");
        list.innerHTML = "";
        if (mine.length === 0 && myDone.length === 0) list.innerHTML = '<div class="empty">Is week abhi koi task nahi</div>';
        mine.forEach(t => {
            const el = document.createElement("div");
            el.className = "task";
            el.innerHTML = `${esc(t.text)}<small>Click karein — screenshot ke sath complete karein 👆📸</small>`;
            el.onclick = () => openModal(t.id);
            if (isAdmin) {
                const ed = document.createElement("button");
                ed.className = "mini"; ed.textContent = "✎";
                ed.onclick = (e) => { e.stopPropagation(); const nt = prompt("Task edit karein:", t.text); if (nt && nt.trim()) { t.text = nt.trim(); push(); } };
                el.appendChild(ed);
                const del = document.createElement("button");
                del.className = "mini"; del.textContent = "✕"; del.style.right = "32px";
                del.onclick = (e) => { e.stopPropagation(); if (confirm("Task delete karein?")) { tasks = tasks.filter(x => x.id !== t.id); push(); } };
                el.appendChild(del);
            }
            list.appendChild(el);
        });
        myDone.forEach(t => {
            const el = document.createElement("div");
            el.className = "task";
            el.style.borderColor = "#166534";
            el.style.background = "#052e16";
            el.style.cursor = "default";
            el.innerHTML = `<span style="color:#4ade80">✔ Complete:</span> ${esc(t.text)}
        <small style="color:#86efac">"${esc(t.doneMsg)}" — ${esc(t.doneAt)}</small>
        ${t.proof ? `<img class="proof" src="${t.proof}" onclick="window.open(this.src)" alt="proof">` : ""}`;
            list.appendChild(el);
        });
    }

    // Completed feed
    const done = tasks.filter(t => t.status === "completed");
    const sec = document.getElementById("doneSection");
    if (done.length) {
        sec.style.display = "block";
        document.getElementById("doneList").innerHTML = done.map(t =>
            `<div class="done-item"><b>✔ ${esc(t.member)}:</b> ${esc(t.text)}<br>
       <span class="msg">"${esc(t.doneMsg)}" — ${esc(t.doneAt)}</span><br>
       ${t.proof ? `<img class="proof" src="${t.proof}" onclick="window.open(this.src)" alt="proof">` : ""}</div>`
        ).join("");
    } else sec.style.display = "none";
}
function tryOpenRoom(name) {
    if (!unlockedRooms[name]) {
        const p = prompt(name + " ka room 🔒\nPassword daalein:");
        if (p === null) return;
        if (p !== PASSWORDS[name]) { alert("❌ Galat password!"); return; }
        unlockedRooms[name] = true;
    }
    openRoom(name);
}
function openRoom(name) {
    currentRoom = name;
    document.getElementById("homeView").style.display = "none";
    document.getElementById("roomView").style.display = "block";
    document.getElementById("btnBack").style.display = "inline-block";
    window.scrollTo(0, 0);
    render();
}
function goHome() {
    currentRoom = null;
    document.getElementById("homeView").style.display = "block";
    document.getElementById("roomView").style.display = "none";
    document.getElementById("btnBack").style.display = "none";
    render();
}
function toggleAdmin() {
    if (isAdmin) {
        isAdmin = false;
        document.getElementById("adminPanel").style.display = "none";
        document.getElementById("btnNewWeek").style.display = "none";
        document.getElementById("btnAdmin").textContent = "🔐 Admin";
        document.getElementById("btnAdmin").classList.remove("on");
        render();
        return;
    }
    let p = adminUnlocked ? "ok" : prompt("🔐 Admin password daalein:");
    if (p === null) return;
    if (!adminUnlocked && p !== PASSWORDS.admin) { alert("❌ Galat password!"); return; }
    adminUnlocked = true;
    isAdmin = true;
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById("btnNewWeek").style.display = "inline-block";
    document.getElementById("btnAdmin").textContent = "❌ Close";
    document.getElementById("btnAdmin").classList.add("on");
    document.getElementById("teamLink").textContent = teamUrl();
    render();
}

function addTask() {
    const inp = document.getElementById("inpTask");
    const text = inp.value.trim();
    if (!text) { alert("Pehle task likhein!"); return; }
    tasks.push({ id: Date.now(), member: document.getElementById("selMember").value, text, status: "pending", doneMsg: "", doneAt: "", proof: "" });
    inp.value = "";
    push(); /* Firebase: ye query sab devices par foran dikha degi */
}

function newWeek() {
    if (!isAdmin) return;
    if (confirm("Naya week shuru karein? Sab tasks clear ho jayenge!")) { tasks = []; weekStart = currentMonday(); localStorage.setItem(LS_WEEK, weekStart); push(); }
}

function copyLink() {
    const url = teamUrl();
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
        () => alert("✅ Team link copy ho gaya! WhatsApp par bhej dein:\n\n" + url),
        () => prompt("Ye link copy karke team ko bhejein:", url)
    );
}

function openModal(id) {
    modalTaskId = id;
    pickedProof = null;
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    document.getElementById("modalTaskText").textContent = t.member + ": " + t.text;
    document.getElementById("modalMsg").value = "";
    document.getElementById("modalImg").value = "";
    document.getElementById("imgPreview").style.display = "none";
    document.getElementById("btnSubmit").disabled = true;
    document.getElementById("modal").style.display = "flex";
}
function closeModal() { document.getElementById("modal").style.display = "none"; modalTaskId = null; pickedProof = null; }

function onImgPick(e) {
    const f = e.target.files[0];
    if (!f) { pickedProof = null; document.getElementById("btnSubmit").disabled = true; return; }
    fileToCompressedDataURL(f).then(url => {
        pickedProof = url;
        document.getElementById("previewImg").src = url;
        document.getElementById("imgPreview").style.display = "block";
        document.getElementById("btnSubmit").disabled = false;
    }).catch(() => { alert("❌ Image load nahi hui — dobara try karein"); pickedProof = null; document.getElementById("btnSubmit").disabled = true; });
}

function submitComplete() {
    if (!pickedProof) { alert("📸 Screenshot required hai! Baghair screenshot task submit nahi hoga."); return; }
    const t = tasks.find(x => x.id === modalTaskId);
    if (!t) { closeModal(); return; }
    const msg = document.getElementById("modalMsg").value.trim() || "Ye task tha, maine complete kar liya hai ✅";
    t.status = "completed";
    t.doneMsg = msg;
    t.doneAt = new Date().toLocaleString();
    t.proof = pickedProof; /* screenshot — sab ko dikhega */
    push(); closeModal();
}
render();
if (USE_FIREBASE) { startFirebase(); } else { startJsonBlob(); }

