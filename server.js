const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PORT = 3000;

// Upload-Ordner erstellen
if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

// Static Dateien
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Upload Speicher
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Spam-Schutz
const uploadLimits = {};

// Startseite
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Alle Dateien abrufen
app.get("/files", (req, res) => {

    fs.readdir("./uploads", (err, files) => {

        if (err) {
            return res.json([]);
        }

        // Neueste zuerst
        files.sort((a, b) => {
            return fs.statSync("./uploads/" + b).mtimeMs -
                   fs.statSync("./uploads/" + a).mtimeMs;
        });

        const result = files.map(file => {

            const ext = path.extname(file).toLowerCase();

            return {
                url: "/uploads/" + file,
                type: (
                    ext === ".mp4" ||
                    ext === ".mov" ||
                    ext === ".webm"
                ) ? "video" : "image"
            };

        });

        res.json(result);

    });

});

// Bildanzahl
app.get("/count", (req, res) => {

    fs.readdir("./uploads", (err, files) => {

        if (err) {
            return res.json({
                count: 0
            });
        }

        res.json({
            count: files.length
        });

    });

});

// Upload
app.post("/upload", upload.single("file"), (req, res) => {

    const ip =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress;

    const now = Date.now();

    if (!uploadLimits[ip]) {

        uploadLimits[ip] = {
            count: 0,
            start: now
        };

    }

    const user = uploadLimits[ip];

    // Reset nach 5 Minuten
    if (now - user.start > 5 * 60 * 1000) {

        user.start = now;
        user.count = 0;

    }

    // Limit 50 Dateien
    if (user.count >= 50) {

        return res.status(429).json({
            error: "Maximal 50 Uploads alle 5 Minuten."
        });

    }

    user.count++;

    const ext = path.extname(req.file.filename).toLowerCase();

    io.emit("new-file", {
        url: "/uploads/" + req.file.filename,
        type: (
            ext === ".mp4" ||
            ext === ".mov" ||
            ext === ".webm"
        ) ? "video" : "image"
    });

    res.json({
        success: true
    });

});

// Socket
io.on("connection", () => {

    console.log("📱 Gast verbunden");

});

// Server starten
http.listen(PORT, () => {

    console.log("");
    console.log("💍 Anton & Dimitra Hochzeit läuft");
    console.log("🌐 http://localhost:3000");
    console.log("");

});