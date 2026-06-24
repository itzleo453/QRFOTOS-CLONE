const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "1234";

const MAX_FILE_SIZE_MB = 100;
const DELETE_TIME_MS = 10 * 60 * 1000;

if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "uploads/");
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    }
});

function getFileType(file) {
    const ext = path.extname(file).toLowerCase();
    return [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image";
}

function getFilesSorted() {
    return fs.readdirSync("./uploads")
        .map(file => {
            const stat = fs.statSync("./uploads/" + file);
            return {
                name: file,
                url: "/uploads/" + file,
                time: stat.mtimeMs,
                type: getFileType(file)
            };
        })
        .sort((a, b) => b.time - a.time);
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/files", (req, res) => {
    res.json(getFilesSorted());
});

app.post("/upload", upload.any(), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Keine Datei angekommen" });
    }

    const uploadedFiles = req.files.map(file => ({
        name: file.filename,
        url: "/uploads/" + file.filename,
        time: Date.now(),
        type: getFileType(file.filename),
        deleteToken: Math.random().toString(36).substring(2),
        deleteUntil: Date.now() + DELETE_TIME_MS
    }));

    io.emit("files-added", uploadedFiles.map(file => ({
        name: file.name,
        url: file.url,
        time: file.time,
        type: file.type
    })));

    res.json({
        success: true,
        files: uploadedFiles,
        skipped: []
    });
});

app.post("/admin/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }

    res.status(401).json({ success: false });
});

app.post("/delete", (req, res) => {
    const { password, file } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false });
    }

    const filePath = "./uploads/" + file;

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        io.emit("file-deleted", file);
    }

    res.json({ success: true });
});

app.post("/delete-own", (req, res) => {
    const { file, deleteToken, deleteUntil } = req.body;

    if (!file || !deleteToken || !deleteUntil) {
        return res.status(400).json({ success: false });
    }

    if (Date.now() > Number(deleteUntil)) {
        return res.status(403).json({ error: "Löschzeit abgelaufen" });
    }

    const filePath = "./uploads/" + file;

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        io.emit("file-deleted", file);
    }

    res.json({ success: true });
});

io.on("connection", () => {
    console.log("Gast verbunden");
});

http.listen(PORT, "0.0.0.0", () => {
    console.log("💍 Anton & Dimitra Hochzeit läuft auf Port " + PORT);
});