<template>
    <div class="main-container">
        <el-container class="main-layout">
            <!-- 头部区域 -->
            <el-header class="header-container">
                <div class="header-content">
                    <div class="header-left">
                        <el-icon class="header-icon">
                            <Monitor />
                        </el-icon>
                        <h1 class="header-title">VODEE</h1>
                    </div>
                    <div class="header-right">
                        <div class="user-info">
                            <el-icon>
                                <User />
                            </el-icon>
                            <span>{{ username }}</span>
                        </div>
                        <el-button
                            type="danger"
                            size="small"
                            @click="handleLogout"
                        >
                            <el-icon>
                                <SwitchButton />
                            </el-icon>
                            <!-- 退出 -->
                        </el-button>
                    </div>
                </div>
            </el-header>

            <!-- 主内容区域 -->
            <el-main class="main-content">
                <el-row :gutter="0" class="split-layout">
                    <!-- 左侧栏 - 文件目录树 -->
                    <el-col
                        :xs="6"
                        :sm="6"
                        :md="6"
                        :lg="6"
                        :xl="6"
                        class="left-panel"
                    >
                        <el-card class="directory-card" shadow="never">
                            <div class="directory-header">
                                <el-breadcrumb
                                    :separator-icon="ArrowRight"
                                    class="breadcrumb-container"
                                >
                                    <el-breadcrumb-item
                                        v-for="item in directoryList"
                                        :key="item.path"
                                    >
                                        <el-button
                                            type="default"
                                            link
                                            size="default"
                                            @click="loadDirectory(item.path)"
                                            style="font-size: 16px"
                                            >{{ item.name }}</el-button
                                        >
                                    </el-breadcrumb-item>
                                </el-breadcrumb>
                            </div>
                            <div class="directory-container">
                                <ul
                                    class="directory-list"
                                    id="directory-list"
                                    style="list-style-type: none"
                                >
                                    <li
                                        class="file-item"
                                        v-for="item in fileList"
                                        :key="item.path"
                                        @click="
                                            item.type == 'directory'
                                                ? loadDirectory(item.path)
                                                : playVideo(item.path)
                                        "
                                    >
                                        <el-icon>
                                            <Folder
                                                v-if="item.type == 'directory'"
                                            ></Folder>
                                            <Film v-else></Film>
                                        </el-icon>
                                        {{ item.name }}
                                    </li>
                                </ul>
                            </div>
                        </el-card>
                    </el-col>

                    <!-- 右侧栏 - 视频播放器 -->
                    <el-col
                        :xs="18"
                        :sm="18"
                        :md="18"
                        :lg="18"
                        :xl="18"
                        class="right-panel"
                    >
                        <el-card class="player-card" shadow="never">
                            <div class="player-header">
                                <div class="player-header-title">
                                    {{ videoInfo }}
                                </div>
                                <div class="player-header-buttons">
                                    <el-button
                                        :icon="Close"
                                        circle
                                        size="small"
                                        @click="handleVideoClose()"
                                        v-show="videoInfo"
                                    ></el-button>
                                </div>
                            </div>
                            <div class="player-container">
                                <video
                                    id="videoPlayer"
                                    class="video-player"
                                    autoplay="true"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            <div class="player-footer">
                                <span>All copyrights reserved by VODEE</span>
                            </div>
                        </el-card>
                    </el-col>
                </el-row>
            </el-main>
        </el-container>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, nextTick } from "vue";
    import { useRouter } from "vue-router";
    import {
        Monitor,
        User,
        SwitchButton,
        ArrowRight,
        CircleClose,
        Close,
        Film,
        Folder,
    } from "@element-plus/icons-vue";
    import { API_URL } from "@/utils/config";
    import axios from "axios";

    const videoInfo = ref("");

    // 响应式数据
    const username = ref("管理员");
    const router = useRouter();

    interface DirectoryItem {
        path: string;
        name: string;
    }

    const directoryList = ref<DirectoryItem[]>([]);
    directoryList.value = [{ path: "/", name: "Home" }];

    // 接口定义
    interface FileItem {
        extension: string;
        name: string;
        path: string;
        size: number;
        type: string;
    }

    const fileList = ref<FileItem[]>([]);

    //------------------------------------------------------------------------------------
    onMounted(() => {
        // 检查登录状态
        const isLoggedIn = localStorage.getItem("isLoggedIn");
        const savedUsername = localStorage.getItem("username");

        if (!isLoggedIn) {
            router.push("/login");
            return;
        }

        if (savedUsername) {
            username.value = savedUsername;
        }

        // 设置暗黑模式
        document.documentElement.classList.add("dark");

        // 加载目录树
        loadDirectory("/");
    });

    // 加载指定路径的目录
    const loadDirectory = async (path: string): Promise<void> => {
        try {
            path = encodeURIComponent(path);
            const res = await axios.get(API_URL + "/directory", {
                params: {
                    path: path,
                },
            });

            if (res.status != 200) {
                alert(res.statusText);
                return;
            }

            // 将当前路径分解为多个详细路径并存储到 directoryList 中
            const pathParts: string[] = res.data.path.split("/");
            directoryList.value = [];
            // 添加根目录
            directoryList.value.push({ path: "/", name: "Home" });

            // 构建累积路径
            let accumulatedPath = "";
            for (let i = 1; i < pathParts.length; i++) {
                const item = pathParts[i];
                if (item) {
                    // 忽略空字符串
                    accumulatedPath += "/" + item;
                    directoryList.value.push({
                        path: accumulatedPath,
                        name: item,
                    });
                }
            }

            // 更新文件列表
            fileList.value = res.data.items;
        } catch (error) {
            console.error("loadDirectory:", error);
        }
    };

    // 播放视频
    const playVideo = async (videoPath: string): Promise<void> => {
        try {
            // 获取带令牌的视频URL
            const res = await axios.get(API_URL + "/video-url", {
                params: { path: videoPath },
            });

            if (res.status != 200) {
                alert(res.statusText);
                return;
            }

            const fileName = videoPath.split("/").pop() || videoPath;
            videoInfo.value = fileName;

            const videoElement: HTMLVideoElement = document.getElementById(
                "videoPlayer",
            ) as HTMLVideoElement;
            videoElement.setAttribute("controls", "true");
            const videoUrl: string = API_URL + res.data.url;
            videoElement.src = videoUrl;

            // 设置额外的安全属性
            videoElement.setAttribute("crossorigin", "anonymous");

            videoElement.load();

            // 显示视频信息
            // Token expires at: ${new Date(data.expiresAt).toLocaleString()}
        } catch (error) {
            console.error("playVideo:", error);
        }
    };

    const handleLogout = (): void => {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("username");
        localStorage.removeItem("token"); // 清除认证token
        router.push("/login");
    };

    const handleVideoClose = (): void => {
        const videoElement: HTMLVideoElement = document.getElementById(
            "videoPlayer",
        ) as HTMLVideoElement;
        videoElement.removeAttribute("controls");
        videoElement.pause();
        videoElement.src = "";
        videoElement.load();
        videoInfo.value = "";
    };
</script>

<style scoped>
    .main-container {
        width: 100vw;
        height: 100vh;
    }

    .main-layout {
        width: 100%;
        height: 100%;
    }

    .header-container {
        background: linear-gradient(135deg, #0e0d0d, #696565);
        color: white;
        padding: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        height: 50px !important;
    }

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 10px 0 20px;
        height: 100%;
        max-width: 100%;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .header-icon {
        font-size: 32px;
    }

    .header-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 18px;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #c9cdd4;
    }

    .main-content {
        padding: 0;
    }

    .split-layout {
        height: 100%;
        margin: 0 !important;
    }

    .left-panel {
        padding: 0 !important;
    }

    .right-panel {
        border-left: 1px solid #2d2d2d;
        padding: 0 !important;
    }

    .directory-card {
        border-radius: 0;
        border: none;
        display: flex;
        flex-direction: column;
        background-color: transparent;
    }

    .directory-header {
        display: flex;
        flex-wrap: nowrap;
        padding: 5px 12px;
        overflow: auto;
        border-radius: 8px;
        background-color: #2d2d2d;
    }

    .breadcrumb-container {
        display: flex;
        flex-wrap: nowrap;
    }

    .directory-container {
        display: flex;
        flex-direction: column;
        font-weight: 10;
        font-size: 14px;
        padding: 10px;
        overflow: auto;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .player-card {
        border-radius: 0;
        border: none;
        display: flex;
        flex-direction: column;
        background-color: transparent;
    }

    .player-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
    }

    .player-header-title {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        text-wrap: nowrap;
        text-overflow: ellipsis;
    }

    .player-header-buttons {
        display: flex;
        justify-content: center;
        flex-wrap: nowrap;
    }

    .player-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 5px;
    }

    .video-player {
        width: 100%;
        aspect-ratio: 16/9;
        border-radius: 8px;
        background-color: #101010;
        box-shadow: 0px 0px 10px rgba(167, 165, 165, 0.5);
    }

    .player-footer {
        text-align: center;
        font-size: 12px;
        margin-top: 10px;
    }
</style>
