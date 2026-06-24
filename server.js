const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "1234";

const MAX_FILES_PER_5_MIN = 50;
const MAX_FILE_SIZE_MB = 100;

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "uploads/");
    },
    filename(req, file, cb) {
        const safeExt = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + safeExt);
    }
});

const upload = multer({
    storage,
    limits: {
        files: MAX_FILES_PER_5_MIN,
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    }
});

const uploadLimits = {};

function getIp(req) {
    return req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
}

function getFileType(file) {
    const ext = path.extname(file).toLowerCase();
    return [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image";
}

function getFilesSorted() {
    if (!fs.existsSync("./uploads")) return [];

    return fs.readdirSync("./uploads")
        .map(file => {
            const stat = fs.statSync("./uploads/" + file);

            return {
                name: file,
                time: stat.mtimeMs,
                url: "/uploads/" + file,
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
        return res.status(400).json({
            error: "Keine Datei angekommen"
        });
    }

    const uploadedFiles = [];
    const existingFiles = getFilesSorted();
    const existingHashes = new Set();

    existingFiles.forEach(file => {
        const fullPath = "./uploads/" + file.name;
        if (fs.existsSync(fullPath)) {
            existingHashes.add(getFileHash(fullPath));
        }
    });

    req.files.forEach(file => {
        const newHash = getFileHash(file.path);

        if (existingHashes.has(newHash)) {
            fs.unlinkSync(file.path);
            return;
        }

        existingHashes.add(newHash);

        uploadedFiles.push({
            name: file.filename,
            time: Date.now(),
            url: "/uploads/" + file.filename,
            type: getFileType(file.filename)
        });
    });

    if (uploadedFiles.length > 0) {
        io.emit("files-added", uploadedFiles);
    }

    res.json({
        success: true,
        files: uploadedFiles,
        skipped: req.files.length - uploadedFiles.length
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

io.on("connection", () => {
    console.log("Gast verbunden");
});

http.listen(PORT, "0.0.0.0", () => {
    console.log("💍 Anton & Dimitra Hochzeit läuft auf Port " + PORT);
});

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}