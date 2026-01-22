<template>
  <div class="main-container">
    <el-container class="main-layout">
      <!-- 头部区域 -->
      <el-header class="main-header">
        <div class="header-content">
          <div class="header-left">
            <el-icon class="header-icon"><Monitor /></el-icon>
            <h1 class="header-title">VODEE</h1>
          </div>
          <div class="header-right">
            <div class="user-info">
              <el-icon><User /></el-icon>
              <span>{{ username }}</span>
            </div>
            <el-button type="danger" size="small" @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              <!-- 退出 -->
            </el-button>
          </div>
        </div>
      </el-header>

      <!-- 主内容区域 -->
      <el-main class="main-content">
        <!-- 使用Element Plus的响应式栅格系统 -->
        <el-row :gutter="0" class="split-layout">
          <!-- 左侧栏 - 文件目录树 -->
          <el-col :xs="6" :sm="6" :md="6" :lg="6" :xl="6" class="left-panel">
            <el-card class="directory-card" shadow="hover">
              <div class="directory-container">
                <div class="directory-tree">
                  <div v-if="loading" class="loading-container">
                    <el-icon class="loading-icon"><Loading /></el-icon>
                    <span>加载中...</span>
                  </div>
                  <div v-else-if="error" class="error-container">
                    <el-icon class="error-icon"><Warning /></el-icon>
                    <span>{{ error }}</span>
                    <el-button type="primary" size="small" @click="refreshDirectory">
                      重试
                    </el-button>
                  </div>
                  <el-tree
                    v-else
                    :data="directoryData"
                    :props="treeProps"
                    node-key="id"
                    highlight-current
                    :expand-on-click-node="false"
                    @node-click="handleNodeClick"
                    class="custom-tree"
                    :default-expanded-keys="expandedKeys"
                  >
                    <template #default="{ node, data }">
                      <span class="tree-node">
                        <el-icon v-if="data.type === 'directory'">
                          <FolderOpened v-if="node.expanded" />
                          <Folder v-else />
                        </el-icon>
                        <el-icon v-else>
                          <Document />
                        </el-icon>
                        <span class="node-label">{{ data.name }}</span>
                        <span v-if="data.type === 'file'" class="file-size">
                          {{ formatFileSize(data.size) }}
                        </span>
                      </span>
                    </template>
                  </el-tree>
                </div>
              </div>
            </el-card>
          </el-col>

          <!-- 右侧栏 - 视频播放器 -->
          <el-col :xs="18" :sm="18" :md="18" :lg="18" :xl="18" class="right-panel">
            <el-card class="player-card" shadow="hover">
              <div class="player-container">
                <div class="video-player-wrapper" v-if="currentVideo">
                  <!-- 这里将使用vue-video-player -->
                  <div class="video-placeholder">
                    <el-icon class="play-icon"><VideoPlay /></el-icon>
                    <p>视频播放区域 - {{ currentVideo.name }}</p>
                    <p class="placeholder-note">(实际项目中需要安装和配置vue-video-player)</p>
                    <div class="video-actions">
                      <el-button type="primary" @click="playVideo">
                        <el-icon><VideoPlay /></el-icon>
                        播放视频
                      </el-button>
                      <el-button @click="downloadVideo">
                        <el-icon><Download /></el-icon>
                        下载
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else class="video-player-wrapper">
                  <div class="no-video">
                    <el-icon class="no-video-icon"><VideoCamera /></el-icon>
                    <p>未选择视频文件</p>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Monitor,
  User,
  SwitchButton,
  Folder,
  FolderOpened,
  Document,
  VideoPlay,
  VideoCamera,
  Download,
  Refresh,
  Loading,
  Warning,
} from '@element-plus/icons-vue'
import type Node from 'element-plus/es/components/tree/src/model/node'
import { ElMessage } from 'element-plus'

// 接口定义
interface FileItem {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedTime?: string
  children?: FileItem[]
  parentId?: string
}

// API配置
// const API_BASE_URL = 'http://localhost:3000/api' // 根据实际后端地址修改
const API_BASE_URL = '/api' // 根据实际后端地址修改

// 响应式数据
const username = ref('管理员')
const router = useRouter()
const directoryData = ref<FileItem[]>([])
const currentVideo = ref<FileItem | null>(null)
const loading = ref(false)
const error = ref('')
const expandedKeys = ref<string[]>([])

const treeProps = {
  children: 'children',
  label: 'name',
}

// 格式化文件大小
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 从服务器获取目录树
const fetchDirectoryTree = async (): Promise<void> => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/files/tree`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`, // 如果有认证
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      directoryData.value = data.data
      // 自动展开根目录
      if (directoryData.value.length > 0) {
        expandedKeys.value = directoryData.value.map((item) => item.id)
      }
      ElMessage.success('目录加载成功')
    } else {
      throw new Error(data.message || '获取目录失败')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络错误，请检查后端服务是否启动'
    ElMessage.error('加载目录失败: ' + error.value)
  } finally {
    loading.value = false
  }
}

// 刷新目录
const refreshDirectory = (): void => {
  fetchDirectoryTree()
}

// 处理节点点击
const handleNodeClick = (data: FileItem, node: Node) => {
  if (data.type === 'file') {
    // 检查是否是视频文件
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v']
    const isVideo = videoExtensions.some((ext) => data.name.toLowerCase().endsWith(ext))

    if (isVideo) {
      currentVideo.value = data
      ElMessage.success(`已选择视频: ${data.name}`)
    } else {
      ElMessage.warning('请选择视频文件（支持格式: mp4, avi, mkv, mov, wmv, flv, webm, m4v）')
    }
  } else {
    // 如果是目录，可以展开/收起
    if (node.expanded) {
      node.collapse()
    } else {
      node.expand()
    }
  }
}

// 播放视频
const playVideo = async (): Promise<void> => {
  if (!currentVideo.value) {
    ElMessage.warning('请先选择视频文件')
    return
  }

  try {
    // 这里可以调用后端API获取视频流URL
    const response = await fetch(`${API_BASE_URL}/files/stream/${currentVideo.value.id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      // 实际播放逻辑，这里只是示例
      ElMessage.info(`开始播放: ${currentVideo.value?.name}`)
      console.log('播放视频URL:', data.streamUrl)
    } else {
      throw new Error('获取视频流失败')
    }
  } catch (err) {
    ElMessage.error('播放失败: ' + (err instanceof Error ? err.message : '未知错误'))
  }
}

// 下载视频
const downloadVideo = (): void => {
  if (!currentVideo.value) {
    ElMessage.warning('请先选择视频文件')
    return
  }

  // 创建下载链接
  const downloadUrl = `${API_BASE_URL}/files/download/${currentVideo.value.id}`
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = currentVideo.value.name
  link.click()

  ElMessage.success('开始下载视频')
}

onMounted(() => {
  // 检查登录状态
  const isLoggedIn = localStorage.getItem('isLoggedIn')
  const savedUsername = localStorage.getItem('username')

  if (!isLoggedIn) {
    router.push('/login')
    return
  }

  if (savedUsername) {
    username.value = savedUsername
  }

  // 设置暗黑模式
  document.documentElement.classList.add('dark')

  // 加载目录树
  fetchDirectoryTree()
})

const handleLogout = (): void => {
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('username')
  localStorage.removeItem('token') // 清除认证token
  router.push('/login')
}
</script>

<style scoped>
.main-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #141414;
}

.main-layout {
  width: 100%;
  height: 100%;
}

.main-header {
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
  height: calc(100vh - 50px);
  overflow: hidden;
}

/* 修复el-row和el-col的布局冲突 - 让Element Plus栅格系统正常工作 */
.split-layout {
  height: 100%;
  margin: 0 !important;
}

.left-panel {
  height: 100%;
  padding: 0 !important;
}

.right-panel {
  height: 100%;
  padding: 0 !important;
}

.directory-card {
  height: 100%;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: column;
  background-color: #1f1f1f;
}

.player-card {
  height: 100%;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: column;
  background-color: #1f1f1f;
}

.directory-card :deep(.el-card__body),
.player-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 5px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid #434343;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.directory-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.directory-tree {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 12px;
  color: #c9cdd4;
}

.loading-icon {
  font-size: 32px;
  color: #409eff;
  animation: spin 1s linear infinite;
}

.error-icon {
  font-size: 32px;
  color: #f56c6c;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.custom-tree {
  background: transparent;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  width: 100%;
}

.node-label {
  font-size: 12px;
  color: #c9cdd4;
  flex: 1;
}

.file-size {
  font-size: 10px;
  color: #909399;
  margin-left: auto;
}

.player-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.video-player-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  min-height: 400px;
}

.video-placeholder {
  text-align: center;
  color: #fff;
  padding: 20px;
}

.play-icon {
  font-size: 48px;
  color: #409eff;
  margin-bottom: 16px;
}

.video-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

.no-video {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #909399;
}

.no-video-icon {
  font-size: 48px;
  color: #606266;
}

.placeholder-note {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

/* 响应式设计优化 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 20px;
    flex-direction: column;
    gap: 12px;
    height: auto;
    padding: 12px 20px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .main-header {
    height: auto !important;
  }

  .main-content {
    height: calc(100vh - 120px);
  }

  .card-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .header-actions {
    align-self: flex-end;
  }

  .video-actions {
    flex-direction: column;
    align-items: center;
  }
}

@media (max-width: 576px) {
  .video-player-wrapper {
    min-height: 300px;
  }

  .play-icon {
    font-size: 36px;
  }

  .directory-tree {
    padding: 0 8px 8px 8px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .video-player-wrapper {
    min-height: 250px;
  }

  .play-icon {
    font-size: 32px;
  }

  .video-info p {
    font-size: 10px;
  }

  .node-label {
    font-size: 10px;
  }
}

/* 防止内容溢出 */
.directory-card :deep(.el-card__body),
.player-card :deep(.el-card__body) {
  overflow: hidden;
}

/* 滚动条优化 */
.directory-tree::-webkit-scrollbar {
  width: 4px;
}

.directory-tree::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.directory-tree::-webkit-scrollbar-track {
  background: #2d2d2d;
}

/* 暗黑模式下的滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>
