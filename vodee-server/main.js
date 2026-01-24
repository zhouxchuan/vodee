const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { md5 } = require("js-md5");

// ----------------------------------------------------------------------------
// 常量定义
// ----------------------------------------------------------------------------

config = {
    videoDirectory: "./videos",
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    allowedExtensions: [".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"],
    enableAntiLeech: true,
    allowedDomains: ["localhost", "127.0.0.1"],
    leechTokenSecret: "your-secret-key-for-token-generation",
    tokenExpireTime: 3600,
    adminUsername: "admin",
    adminPassword: "123456",
    jwtSecret: "your-jwt-secret-key", // 在生产环境中应该从环境变量获取
};

const app = express();

// ----------------------------------------------------------------------------
// 函数定义
// ----------------------------------------------------------------------------

// 配置文件读取
const loadConfig = () => {
    try {
        const configFile = path.join(__dirname, "config.json");
        if (fs.existsSync(configFile)) {
            const configData = fs.readFileSync(configFile, "utf8");
            config = JSON.parse(configData);
        }
    } catch (error) {
        console.error("Error reading config file:", error);
    }
};

// 生成防下载令牌
const generateLeetchToken = (filePath) => {
    const expireTime = Date.now() + config.tokenExpireTime * 1000;
    const data = `${filePath}:${expireTime}`;
    const hash = crypto.createHmac("sha256", config.leechTokenSecret).update(data).digest("hex");
    return `${hash}:${expireTime}`;
};

// 验证防下载令牌
const validateLeetchToken = (filePath, token) => {
    if (!token) return false;

    const parts = token.split(":");
    if (parts.length !== 2) return false;

    const [receivedHash, expireTimeString] = parts;
    const expireTime = parseInt(expireTimeString);

    // 检查令牌是否过期
    if (Date.now() > expireTime) return false;

    const expectedData = `${filePath}:${expireTime}`;
    const expectedHash = crypto.createHmac("sha256", config.leechTokenSecret).update(expectedData).digest("hex");

    return crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
};

// 检查Referer防盗链
const checkReferer = (req) => {
    if (!config.enableAntiLeech) return true;

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
        return config.allowedDomains.some((domain) => host === domain || host.endsWith("." + domain));
    } catch (e) {
        // 如果无法解析referer URL，则拒绝访问
        return false;
    }
};

// JWT认证中间件
const jwtAuthMiddleware = (req, res, next) => {
    // 对于公共API路径，跳过认证
    const publicPaths = ["/api/video", "/api/directory", "/api/video-url", "/api/login"];
    if (publicPaths.some((path) => req.path.startsWith(path))) {
        next();
        return;
    }

    // 检查Authorization头部
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Access denied. No token provided." });
        return;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    try {
        // 验证JWT令牌
        const decoded = jwt.verify(token, config.jwtSecret);

        // 将用户信息附加到请求对象
        req.user = decoded;
        next();
    } catch (error) {
        console.error("JWT verification error:", error);
        res.status(401).json({ error: "Invalid or expired token." });
        return;
    }
};

// 防盗链中间件
const antiLeechMiddleware = (req, res, next) => {
    if (!config.enableAntiLeech) {
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
};

// ----------------------------------------------------------------------------
// 主程序
// ----------------------------------------------------------------------------

// 加载配置文件
loadConfig();

// 解析JSON请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 允许跨域请求
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// 应用JWT认证中间件（除了登录和公共API外的所有路由）
app.use("*", (req, res, next) => {
    // 跳过特定公共路由的认证
    if (["/api/video", "/api/directory", "/api/video-url", "/api/login", "/", "/favicon.ico"].includes(req.path)) {
        next();
        return;
    }

    // 对于其他路由，应用JWT认证
    jwtAuthMiddleware(req, res, next);
});

// 中间件
app.use(express.static("public"));

// 应用防盗链中间件
app.use("/api/video", antiLeechMiddleware);

// 获取目录结构的API
app.get("/api/directory", (req, res) => {
    const requestedPath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const fullPath = path.join(config.videoDirectory, requestedPath);

    try {
        // 检查路径是否在视频目录内（防止路径遍历攻击）
        const relativePath = path.relative(config.videoDirectory, fullPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return res.status(400).json({ error: "Invalid path" });
        }

        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
            // 如果是文件，返回文件信息
            const ext = path.extname(fullPath).toLowerCase();
            if (config.allowedExtensions.includes(ext)) {
                const fileInfo = {
                    name: path.basename(fullPath),
                    type: "file",
                    size: stats.size,
                    path: requestedPath,
                    extension: ext,
                };
                return res.json(fileInfo);
            } else {
                return res.status(400).json({ error: "File type not allowed" });
            }
        }

        if (stats.isDirectory()) {
            // 如果是目录，返回目录内容
            const items = fs.readdirSync(fullPath).map((item) => {
                const itemPath = path.join(fullPath, item);
                const itemStats = fs.statSync(itemPath);

                return {
                    name: item,
                    type: itemStats.isFile() ? "file" : "directory",
                    size: itemStats.size,
                    path: path.join(requestedPath, item).replace(/\\/g, "/"),
                    extension: itemStats.isFile() ? path.extname(item).toLowerCase() : null,
                };
            });

            // 过滤出视频文件和目录
            const filteredItems = items.filter((item) => {
                if (item.type === "directory") return true;
                return config.allowedExtensions.includes(item.extension || "");
            });

            const directoryStructure = {
                path: requestedPath,
                items: filteredItems.sort((a, b) => {
                    // 目录优先于文件排序
                    if (a.type !== b.type) {
                        return a.type === "directory" ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                }),
            };

            return res.json(directoryStructure);
        }
        return res.status(404).json({ error: "Not found" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// 视频流式传输
app.get("/api/video", (req, res) => {
    const filePath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const fullPath = path.join(config.videoDirectory, filePath);

    try {
        // 检查路径是否在视频目录内（防止路径遍历攻击）
        const relativePath = path.relative(config.videoDirectory, fullPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return res.status(400).json({ error: "Invalid path" });
        }

        const ext = path.extname(fullPath).toLowerCase();
        if (!config.allowedExtensions.includes(ext)) {
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
        return res;
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// 获取带防下载令牌的视频链接
app.get("/api/video-url", (req, res) => {
    const filePath = req.query.path ? decodeURIComponent(req.query.path) : "";
    const token = generateLeetchToken(filePath);

    const videoUrl = `/api/video?path=${encodeURIComponent(filePath)}&token=${token}`;

    const videoInfo = {
        url: videoUrl,
        expiresAt: Date.now() + config.tokenExpireTime * 1000,
    };

    res.json(videoInfo);
});

// 用户登录
app.post("/api/login", (req, res) => {
    try {
        const data = req.body.data;
        // 验证输入
        if (!data.username || !data.password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        // 验证凭据
        if (data.username === config.adminUsername && data.password === md5(config.adminPassword)) {
            // 生成JWT令牌
            const token = jwt.sign(
                {username: data.username},
                config.jwtSecret,
                { expiresIn: config.tokenExpireTime }, // 使用配置中的过期时间
            );

            return res.json({
                success: true,
                token,
                message: "Login successful",
            });
        } else {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error during login",
        });
    }
});

// 根路由，提供HTML界面
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(config.port, () => {
    console.log(`Video streaming server running on http://localhost:${config.port}`);
    console.log(`Video directory: ${path.resolve(config.videoDirectory)}`);
    console.log(`Anti-leech enabled: ${config.enableAntiLeech}`);
    if (config.enableAntiLeech) {
        console.log(`Allowed domains: ${config.allowedDomains.join(", ")}`);
    }
    console.log(`Admin username: ${config.adminUsername}`);
});
