const socket = io();

let items = [];
let currentIndex = 0;
let adminPassword = "";
let ownUploads = JSON.parse(localStorage.getItem("ownUploads") || "[]");

const gallery = document.getElementById("gallery");
const fileInput = document.getElementById("fileInput");
const selectedInfo = document.getElementById("selectedInfo");
const viewer = document.getElementById("viewer");
const viewerContent = document.getElementById("viewerContent");
const uploadStatus = document.getElementById("uploadStatus");
const uploadProgress = document.getElementById("uploadProgress");
const photoCount = document.getElementById("photoCount");
const ownDeleteBox = document.getElementById("ownDeleteBox");

document.getElementById("selectButton").onclick = () => fileInput.click();

fileInput.addEventListener("change", () => {
    selectedInfo.innerText = fileInput.files.length
        ? fileInput.files.length + " Datei(en) ausgewählt"
        : "Keine Dateien ausgewählt";
});

function saveOwnUploads() {
    localStorage.setItem("ownUploads", JSON.stringify(ownUploads));
}

function updateCounter() {
    if (photoCount) photoCount.innerText = items.length;
}

function createMediaElement(item, index) {
    const el = document.createElement(item.type === "video" ? "video" : "img");

    el.src = item.url;
    el.loading = "lazy";

    if (item.type === "video") {
        el.muted = true;
        el.preload = "metadata";
        el.playsInline = true;
    }

    el.onclick = () => openViewer(index);

    return el;
}

function renderGallery() {
    gallery.innerHTML = "";

    items.forEach((item, index) => {
        gallery.appendChild(createMediaElement(item, index));
    });

    updateCounter();
    renderOwnDeleteBox();
}

async function loadGallery() {
    const res = await fetch("/files");
    items = await res.json();
    renderGallery();
}

function prependNewFiles(newFiles) {
    items = [...newFiles, ...items];
    renderGallery();
}

document.getElementById("uploadButton").onclick = async () => {
    if (!fileInput.files.length) return;

    const form = new FormData();

    for (const file of fileInput.files) {
        form.append("file", file);
    }

    uploadProgress.style.display = "block";
    uploadProgress.value = 0;
    uploadStatus.innerText = "Upload läuft...";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");

    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            uploadProgress.value = percent;
            uploadStatus.innerText = "Upload läuft... " + percent + "%";
        }
    };

    xhr.onload = () => {
        uploadProgress.style.display = "none";

        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);

            uploadStatus.innerText = "Upload fertig ✅";
            selectedInfo.innerText = "Keine Dateien ausgewählt";
            fileInput.value = "";

            if (data.skipped && data.skipped.length > 0) {
                alert(data.skipped.length + " doppelte Datei(en) wurden übersprungen.");
            }

            if (data.files && data.files.length > 0) {
                ownUploads = [...data.files, ...ownUploads];
                saveOwnUploads();
                renderOwnDeleteBox();
            }

            loadGallery();
        } else {
            uploadStatus.innerText = "Upload fehlgeschlagen";
            alert(xhr.responseText);
        }
    };

    xhr.onerror = () => {
        uploadProgress.style.display = "none";
        uploadStatus.innerText = "Netzwerkfehler beim Upload";
    };

    xhr.send(form);
};

function renderOwnDeleteBox() {
    const now = Date.now();

    ownUploads = ownUploads.filter(item => item.deleteUntil > now);
    saveOwnUploads();

    if (!ownUploads.length) {
        ownDeleteBox.innerHTML = "";
        return;
    }

    const secondsLeft = Math.max(0, Math.floor((ownUploads[0].deleteUntil - now) / 1000));
    const min = Math.floor(secondsLeft / 60);
    const sec = String(secondsLeft % 60).padStart(2, "0");

    ownDeleteBox.innerHTML = `
        <div class="ownDeleteCard">
            ✅ Eigene letzte Uploads können noch gelöscht werden (${min}:${sec})
            <button id="deleteOwnButton">🗑 Meine letzten Uploads löschen</button>
        </div>
    `;

    document.getElementById("deleteOwnButton").onclick = deleteOwnUploads;
}

async function deleteOwnUploads() {
    if (!confirm("Deine letzten Uploads wirklich löschen?")) return;

    for (const item of ownUploads) {
        await fetch("/delete-own", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                file: item.name,
                deleteToken: item.deleteToken,
                deleteUntil: item.deleteUntil
            })
        });
    }

    ownUploads = [];
    saveOwnUploads();
    renderOwnDeleteBox();
    loadGallery();
}

setInterval(renderOwnDeleteBox, 1000);

/* VIEWER */
function openViewer(index) {
    currentIndex = index;
    renderViewer();
    viewer.style.display = "flex";
}

function renderViewer() {
    const item = items[currentIndex];
    if (!item) return;

    viewerContent.innerHTML = "";

    const el = document.createElement(item.type === "video" ? "video" : "img");
    el.src = item.url;

    if (item.type === "video") {
        el.controls = true;
        el.autoplay = true;
        el.playsInline = true;
        el.preload = "auto";
    }

    viewerContent.appendChild(el);
}

document.getElementById("closeViewer").onclick = () => {
    viewer.style.display = "none";
};

document.getElementById("nextButton").onclick = () => {
    if (currentIndex < items.length - 1) {
        currentIndex++;
        renderViewer();
    }
};

document.getElementById("prevButton").onclick = () => {
    if (currentIndex > 0) {
        currentIndex--;
        renderViewer();
    }
};

let startX = 0;

viewer.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
});

viewer.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;

    if (startX - endX > 50 && currentIndex < items.length - 1) {
        currentIndex++;
        renderViewer();
    }

    if (endX - startX > 50 && currentIndex > 0) {
        currentIndex--;
        renderViewer();
    }
});

/* ADMIN */
document.getElementById("adminButton").onclick = async () => {
    const pw = prompt("Admin Passwort eingeben");
    if (!pw) return;

    const res = await fetch("/admin/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: pw })
    });

    if (!res.ok) {
        alert("Falsches Passwort");
        return;
    }

    adminPassword = pw;
    openAdminGallery();
};

function openAdminGallery() {
    let adminOverlay = document.getElementById("adminOverlay");

    if (!adminOverlay) {
        adminOverlay = document.createElement("div");
        adminOverlay.id = "adminOverlay";
        document.body.appendChild(adminOverlay);
    }

    adminOverlay.innerHTML = `
        <div id="adminBox">
            <button id="closeAdmin">✕</button>
            <h2>Foto Management</h2>
            <p>Neueste Bilder sind oben. Tippe auf ein Bild oder Video, um es zu löschen.</p>
            <div id="adminGrid"></div>
        </div>
    `;

    adminOverlay.style.display = "flex";

    document.getElementById("closeAdmin").onclick = () => {
        adminOverlay.style.display = "none";
    };

    const adminGrid = document.getElementById("adminGrid");

    items.forEach(item => {
        const wrap = document.createElement("div");
        wrap.className = "adminItem";

        const el = document.createElement(item.type === "video" ? "video" : "img");
        el.src = item.url;
        el.loading = "lazy";

        if (item.type === "video") {
            el.muted = true;
            el.preload = "metadata";
            el.playsInline = true;
        }

        wrap.appendChild(el);

        wrap.onclick = async () => {
            if (!confirm("Dieses Bild/Video wirklich löschen?")) return;

            await fetch("/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    password: adminPassword,
                    file: item.name
                })
            });

            items = items.filter(x => x.name !== item.name);
            renderGallery();
            openAdminGallery();
        };

        adminGrid.appendChild(wrap);
    });
}

socket.on("files-added", newFiles => {
    prependNewFiles(newFiles);
});

socket.on("file-deleted", fileName => {
    items = items.filter(item => item.name !== fileName);
    renderGallery();
});

loadGallery();