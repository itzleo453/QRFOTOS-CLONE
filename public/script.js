const socket = io();

/* =========================
   STATE
========================= */
let items = [];          // Bilder + Videos
let currentIndex = 0;
let slideshowActive = false;
let slideshowInterval = null;

/* =========================
   ELEMENTS
========================= */
const gallery = document.getElementById("gallery");
const fileInput = document.getElementById("fileInput");
const selectedInfo = document.getElementById("selectedInfo");
const counter = document.getElementById("counter");

const viewer = document.getElementById("viewer");
const viewerContent = document.getElementById("viewerContent");

/* =========================
   FILE SELECT BUTTON
========================= */
document.getElementById("selectButton").onclick = () => {
    fileInput.click();
};

fileInput.addEventListener("change", () => {
    const files = fileInput.files;
    selectedInfo.innerText = files.length
        ? `${files.length} Datei(en) ausgewählt`
        : "Keine Dateien ausgewählt";
});

/* =========================
   LOAD GALLERY
========================= */
async function loadGallery() {
    const res = await fetch("/files");
    items = await res.json();

    gallery.innerHTML = "";

    items.forEach((item, index) => {

        const ext = item.url.split(".").pop().toLowerCase();

        if (item.type === "video") {
            const video = document.createElement("video");
            video.src = item.url;
            video.muted = true;
            video.onclick = () => openViewer(index);
            gallery.appendChild(video);
        } else {
            const img = document.createElement("img");
            img.src = item.url;
            img.onclick = () => openViewer(index);
            gallery.appendChild(img);
        }

    });
}

/* =========================
   UPLOAD MULTI
========================= */
document.getElementById("uploadButton").onclick = async () => {

    const files = fileInput.files;

    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {

        const formData = new FormData();
        formData.append("file", files[i]);

        const res = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        if (res.status === 429) {
            const err = await res.json();
            alert(err.error);
            break;
        }
    }

    fileInput.value = "";
    selectedInfo.innerText = "Keine Dateien ausgewählt";

    loadGallery();
    updateCounter();
};

/* =========================
   COUNTER
========================= */
async function updateCounter() {
    const res = await fetch("/count");
    const data = await res.json();
    counter.innerText = data.count;
}

/* =========================
   VIEWER
========================= */
function openViewer(index) {
    currentIndex = index;
    renderViewer();
    viewer.style.display = "flex";
}

function closeViewer() {
    viewer.style.display = "none";
    stopSlideshow();
}

document.getElementById("closeViewer").onclick = closeViewer;

/* =========================
   RENDER VIEWER
========================= */
function renderViewer() {

    const item = items[currentIndex];

    viewerContent.innerHTML = "";

    if (item.type === "video") {
        const video = document.createElement("video");
        video.src = item.url;
        video.controls = true;
        video.autoplay = true;
        viewerContent.appendChild(video);
    } else {
        const img = document.createElement("img");
        img.src = item.url;
        viewerContent.appendChild(img);
    }
}

/* =========================
   NEXT / PREV
========================= */
function next() {
    if (currentIndex < items.length - 1) {
        currentIndex++;
        renderViewer();
    }
}

function prev() {
    if (currentIndex > 0) {
        currentIndex--;
        renderViewer();
    }
}

document.getElementById("nextButton").onclick = next;
document.getElementById("prevButton").onclick = prev;

/* =========================
   SWIPE (HANDY)
========================= */
let startX = 0;

viewer.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
});

viewer.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;

    if (startX - endX > 50) next();
    if (endX - startX > 50) prev();
});

/* =========================
   SLIDESHOW
========================= */
document.getElementById("slideshowButton").onclick = () => {

    if (slideshowActive) {
        stopSlideshow();
        return;
    }

    slideshowActive = true;
    viewer.style.display = "flex";
    currentIndex = 0;

    slideshowInterval = setInterval(() => {

        if (currentIndex >= items.length - 1) {
            currentIndex = 0;
        } else {
            currentIndex++;
        }

        renderViewer();

    }, 3000);
};

function stopSlideshow() {
    slideshowActive = false;
    clearInterval(slideshowInterval);
}

/* =========================
   SOCKET LIVE UPDATES
========================= */
socket.on("new-file", () => {
    loadGallery();
    updateCounter();
});

/* =========================
   INIT
========================= */
loadGallery();
updateCounter();