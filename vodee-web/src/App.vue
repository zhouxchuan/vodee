<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'

onMounted(() => {
    // 设置暗黑模式
    document.documentElement.classList.add('dark')
})
</script>

<template>
    <RouterView />
</template>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    height: 100%;
    overflow: hidden;
}

body {
    font-family:
        'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
    line-height: 1.6;
    color: #c9cdd4;
    background-color: #141414;
}

#app {
    width: 100%;
    height: 100%;
}

/* 暗黑模式下的全局滚动条样式 */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: #2d2d2d;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: #777;
}

/* 全局响应式字体大小 */
@media (max-width: 480px) {
    html {
        font-size: 10px;
    }
}

@media (max-width: 768px) {
    html {
        font-size: 10px;
    }
}

@media (min-width: 1920px) {
    html {
        font-size: 12px;
    }
}

@media (min-width: 2560px) {
    html {
        font-size: 14px;
    }
}

@media (min-width: 3840px) {
    html {
        font-size: 16px;
    }
}

/* 暗黑模式下的全局样式 */
.dark {
    color-scheme: dark;
}

/* 确保Element Plus组件在暗黑模式下正确显示 */
.el-button {
    transition: all 0.3s ease;
}

.el-card {
    background-color: #1f1f1f;
    border: 1px solid #434343;
}

.el-input__inner {
    background-color: #2d2d2d !important;
    border-color: #434343 !important;
    color: #c9cdd4 !important;
}

.el-input__inner::placeholder {
    color: #909399 !important;
}

.el-form-item__label {
    color: #c9cdd4 !important;
}

.el-tree {
    background-color: transparent !important;
}

.el-tree-node__content:hover {
    background-color: #2d2d2d !important;
}

.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
    background-color: #2d2d2d !important;
}
</style>
