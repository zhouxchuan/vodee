const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

// 允许跨域请求
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// 配置文件读取
let config = {};
try {
    const configFile = path.join(__dirname, "config.json");
    if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, "utf8");
        config = JSON.parse(configData);
    } else {
        // 创建默认配置文件
        config = {
            videoDirectory: "./videos",
            port: 3000,
            allowedExtensions: [
                ".mp4",
                ".avi",
                ".mov",
                ".mkv",
                ".wmv",
                ".flv",
                ".webm",
            ],
            enableAntiLeech: true,
            allowedDomains: ["localhost", "127.0.0.1", "yourdomain.com"],
            leechTokenSecret: "your-secret-key-for-token-generation", // 请修改为安全的密钥
            tokenExpireTime: 3600, // Token过期时间（秒）
        };
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

        // 创建示例视频目录
        if (!fs.existsSync("./videos")) {
            fs.mkdirSync("./videos", { recursive: true });
            console.log("Created default videos directory at ./videos");
        }
    }
} catch (error) {
    console.error("Error reading config file:", error);
    process.exit(1);
}

const VIDEO_DIR = config.videoDirectory || "./videos";
const ALLOWED_EXTENSIONS = config.allowedExtensions || [
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".wmv",
    ".flv",
    ".webm",
];
const ENABLE_ANTI_LEECH =
    config.enableAntiLeech !== undefined ? config.enableAntiLeech : true;
const ALLOWED_DOMAINS = config.allowedDomains || ["localhost", "127.0.0.1"];
const LEECH_TOKEN_SECRET =
    config.leechTokenSecret || "your-secret-key-for-token-generation";
const TOKEN_EXPIRE_TIME = config.tokenExpireTime || 3600; // 默认1小时

// 生成防下载令牌
function generateLeetchToken(filePath) {
    const expireTime = Date.now() + TOKEN_EXPIRE_TIME * 1000;
    const data = `${filePath}:${expireTime}`;
    const hash = crypto
        .createHmac("sha256", LEECH_TOKEN_SECRET)
        .update(data)
        .digest("hex");
    return `${hash}:${expireTime}`;
}

// 验证防下载令牌
function validateLeetchToken(filePath, token) {
    if (!token) return false;

    const parts = token.split(":");
    if (parts.length !== 2) return false;

    const [receivedHash, expireTimeString] = parts;
    const expireTime = parseInt(expireTimeString);

    // 检查令牌是否过期
    if (Date.now() > expireTime) return false;

    const expectedData = `${filePath}:${expireTime}`;
    const expectedHash = crypto
        .createHmac("sha256", LEECH_TOKEN_SECRET)
        .update(expectedData)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(receivedHash),
        Buffer.from(expectedHash),
    );
}

// 检查Referer防盗链
function checkReferer(req) {
    if (!ENABLE_ANTI_LEECH) return true;

    const referer = req.headers.referer;
    if (!referer) {
        // 对于直接访问或某些浏览器不发送referer的情况，可以允许或拒绝
        // 这里我们允许没有referer的请求
        return true;
    }

    try {
        const refererUrl = new URL(referer);
        const host = refererUrl.hostname;

        // 检查域名是否在允许列表中
        return ALLOWED_DOMAINS.some(
            (domain) => host === domain || host.endsWith("." + domain),
        );
    } catch (e) {
        // 如果无法解析referer URL，则拒绝访问
        return false;
    }
}

// 防盗链中间件
function antiLeechMiddleware(req, res, next) {
    if (!ENABLE_ANTI_LEECH) {
        next();
        return;
    }

    // 对于非视频请求，不需要防盗链检查
    if (!req.path.startsWith("/api/video")) {
        next();
        return;
    }

    // 检查Referer
    if (!checkReferer(req)) {
        res.status(403).json({ error: "Access denied: Referer not allowed" });
        return;
    }

    // 检查令牌（如果启用）
    const filePath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const token = req.query.token;

    if (token && !validateLeetchToken(filePath, token)) {
        res.status(403).json({
            error: "Access denied: Invalid or expired token",
        });
        return;
    }

    // 如果没有令牌但是启用了令牌验证，则生成一个临时令牌用于验证
    next();
}

// 中间件
app.use(express.static("public"));

// 应用防盗链中间件
app.use("/api/video", antiLeechMiddleware);

// 获取目录结构的API
app.get("/api/directory", (req, res) => {
    const requestedPath = req.query.path
        ? decodeURIComponent(req.query.path)
        : "";
    const fullPath = path.join(VIDEO_DIR, requestedPath);

    try {
        // 检查路径是否在视频目录内（防止路径遍历攻击）
        const relativePath = path.relative(VIDEO_DIR, fullPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return res.status(400).json({ error: "Invalid path" });
        }

        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
            // 如果是文件，返回文件信息
            const ext = path.extname(fullPath).toLowerCase();
            if (ALLOWED_EXTENSIONS.includes(ext)) {
                res.json({
                    name: path.basename(fullPath),
                    type: "file",
                    size: stats.size,
                    path: requestedPath,
                    extension: ext,
                });
            } else {
                res.status(400).json({ error: "File type not allowed" });
            }
        } else if (stats.isDirectory()) {
            // 如果是目录，返回目录内容
            const items = fs.readdirSync(fullPath).map((item) => {
                const itemPath = path.join(fullPath, item);
                const itemStats = fs.statSync(itemPath);

                return {
                    name: item,
                    type: itemStats.isFile() ? "file" : "directory",
                    size: itemStats.size,
                    path: path.join(requestedPath, item).replace(/\\/g, "/"),
                    extension: itemStats.isFile()
                        ? path.extname(item).toLowerCase()
                        : null,
                };
            });

            // 过滤出视频文件和目录
            const filteredItems = items.filter((item) => {
                if (item.type === "directory") return true;
                return ALLOWED_EXTENSIONS.includes(item.extension);
            });

            res.json({
                path: requestedPath,
                items: filteredItems.sort((a, b) => {
                    // 目录优先于文件排序
                    if (a.type !== b.type) {
                        return a.type === "directory" ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                }),
            });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 视频流式传输
app.get("/api/video", (req, res) => {
    const filePath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const fullPath = path.join(VIDEO_DIR, filePath);

    try {
        // 检查路径是否在视频目录内（防止路径遍历攻击）
        const relativePath = path.relative(VIDEO_DIR, fullPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return res.status(400).json({ error: "Invalid path" });
        }

        const ext = path.extname(fullPath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return res.status(400).json({ error: "File type not allowed" });
        }

        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;

            const head = {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": "video/mp4",
            };

            res.writeHead(206, head);

            const stream = fs.createReadStream(fullPath, { start, end });
            stream.on("error", (err) => {
                console.error("Stream error:", err);
                res.status(500).json({ error: "Error reading file" });
            });
            stream.pipe(res);
        } else {
            const head = {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            };
            res.writeHead(200, head);
            const stream = fs.createReadStream(fullPath);
            stream.on("error", (err) => {
                console.error("Stream error:", err);
                res.status(500).json({ error: "Error reading file" });
            });
            stream.pipe(res);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 获取带防下载令牌的视频链接
app.get("/api/video-url", (req, res) => {
    const filePath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const token = generateLeetchToken(filePath);

    const videoUrl = `/api/video?path=${encodeURIComponent(filePath)}&token=${token}`;

    res.json({
        url: videoUrl,
        expiresAt: Date.now() + TOKEN_EXPIRE_TIME * 1000,
    });
});

// 根路由，提供HTML界面
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Video streaming server running on http://localhost:${PORT}`);
    console.log(`Video directory: ${path.resolve(VIDEO_DIR)}`);
    console.log(`Anti-leech enabled: ${ENABLE_ANTI_LEECH}`);
    if (ENABLE_ANTI_LEECH) {
        console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(", ")}`);
    }
});
