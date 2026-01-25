<template>
    <div class="video-player" :style="{ width: width, height: height }">
        <div class="video-container">
            <video
                ref="videoRef"
                :src="src"
                :poster="poster"
                :preload="preload"
                :autoplay="autoplay"
                @play="onPlay"
                @pause="onPause"
                @ended="onEnded"
                @timeupdate="onTimeUpdate"
                @progress="onProgress"
                @waiting="onWaiting"
                @playing="onPlaying"
                @error="onError"
                @loadstart="onLoadStart"
                @canplay="onCanPlay"
                @loadedmetadata="onLoadedMetaData"
                class="video-element"
                :style="{ objectFit: objectFit }"
            >
                <track v-for="track in tracks" :key="track.src" :src="track.src" :kind="track.kind" :srclang="track.srclang" :label="track.label" />
                您的浏览器不支持视频播放
            </video>

            <!-- 视频封面遮罩 -->
            <div v-if="showPoster && !isPlaying && currentTime === 0" class="video-poster-overlay" @click="handlePlay">
                <img :src="poster" alt="Video Poster" class="poster-image" />
            </div>
        </div>

        <!-- 控制栏 -->
        <div class="controls" :class="{ 'controls-hidden': !showControls }" @mouseenter="showControls = true" @mouseleave="hideControlsIfNotPlaying">
            <!-- 播放/暂停按钮 -->
            <button class="control-btn play-pause-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
                <span v-if="!isPlaying">▶</span>
                <span v-else>⏸</span>
            </button>

            <!-- 进度条 -->
            <div class="progress-container">
                <div class="progress-bar" @click="seekTo">
                    <div class="progress-loaded" :style="{ width: `${loadedPercentage}%` }"></div>
                    <div class="progress-played" :style="{ width: `${playedPercentage}%` }"></div>
                </div>
                <input type="range" class="progress-slider" :min="0" :max="duration || 100" v-model.number="currentTime" @input="onProgressInput" @change="onProgressChange" />
            </div>

            <!-- 时间显示 -->
            <div class="time-display">
                <span>{{ formatTime(currentTime) }}</span>
                <span>/</span>
                <span>{{ formatTime(duration) }}</span>
            </div>

            <!-- 音量控制 -->
            <button class="control-btn volume-btn" @click="toggleMute" :title="isMuted ? '取消静音' : '静音'">
                <span v-if="volume === 0 || isMuted">🔇</span>
                <span v-else-if="volume > 0.5">🔊</span>
                <span v-else>🔉</span>
            </button>

            <input type="range" class="volume-slider" :min="0" :max="1" step="0.01" v-model.number="volume" @input="onVolumeChange" />

            <!-- 全屏按钮 -->
            <button class="control-btn fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
                <span v-if="!isFullscreen">⛶</span>
                <span v-else>⛶</span>
            </button>
        </div>

        <!-- 加载指示器 -->
        <div v-if="isLoading" class="loading-indicator">
            <div class="spinner"></div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-message">
            {{ error }}
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

    // 定义类型
    interface Track {
        src: string;
        kind: string;
        srclang?: string;
        label: string;
    }

    interface Props {
        src: string;
        poster?: string;
        preload?: 'none' | 'metadata' | 'auto';
        autoplay?: boolean;
        showPoster?: boolean;
        objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
        tracks?: Track[];
        width?: string;
        height?: string;
        showControls?: boolean;
    }

    // 定义props
    const props = withDefaults(defineProps<Props>(), {
        poster: '',
        preload: 'metadata',
        autoplay: false,
        showPoster: true,
        objectFit: 'contain',
        tracks: () => [],
        width: '100%',
        height: 'auto',
        showControls: true,
    });

    // 定义emit事件
    const emit = defineEmits<{
        play: [];
        pause: [];
        ended: [];
        timeupdate: [time: number];
        error: [error: string];
        loadstart: [];
        canplay: [];
        loadedmetadata: [];
        progress: [];
    }>();

    // 响应式数据
    const videoRef = ref<HTMLVideoElement | null>(null);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(1);
    const isMuted = ref(false);
    const loadedPercentage = ref(0);
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const showControls = ref(props.showControls);
    const isFullscreen = ref(false);
    const controlsTimeout = ref<number | null>(null);

    // 计算属性
    const playedPercentage = computed(() => {
        if (!duration.value) return 0;
        return (currentTime.value / duration.value) * 100;
    });

    // 方法定义
    const togglePlay = () => {
        if (isPlaying.value) {
            pause();
        } else {
            play();
        }
    };

    const handlePlay = () => {
        play();
    };

    const play = async () => {
        if (videoRef.value) {
            try {
                await videoRef.value.play();
                emit('play');
            } catch (err) {
                console.error('播放失败:', err);
                error.value = '播放失败，请重试';
                emit('error', '播放失败，请重试');
            }
        }
    };

    const pause = () => {
        if (videoRef.value) {
            videoRef.value.pause();
            emit('pause');
        }
    };

    const seekTo = (event: MouseEvent) => {
        if (!videoRef.value) return;

        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const pos = (event.clientX - rect.left) / rect.width;
        const time = pos * duration.value;

        if (videoRef.value) {
            videoRef.value.currentTime = time;
            currentTime.value = time;
        }
    };

    const onProgressInput = () => {
        if (videoRef.value) {
            videoRef.value.currentTime = currentTime.value;
        }
    };

    const onProgressChange = () => {
        if (videoRef.value) {
            videoRef.value.currentTime = currentTime.value;
        }
    };

    const onVolumeChange = () => {
        if (videoRef.value) {
            videoRef.value.volume = volume.value;
            isMuted.value = volume.value === 0;
        }
    };

    const toggleMute = () => {
        isMuted.value = !isMuted.value;
        if (videoRef.value) {
            videoRef.value.muted = isMuted.value;
            if (isMuted.value) {
                volume.value = 0;
            } else {
                volume.value = 1;
            }
        }
    };

    const toggleFullscreen = () => {
        const videoContainer = document.querySelector('.video-container') as HTMLElement;

        if (!videoContainer) return;

        if (!isFullscreen.value) {
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if ((videoContainer as any).webkitRequestFullscreen) {
                (videoContainer as any).webkitRequestFullscreen();
            } else if ((videoContainer as any).msRequestFullscreen) {
                (videoContainer as any).msRequestFullscreen();
            }
            isFullscreen.value = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            } else if ((document as any).msExitFullscreen) {
                (document as any).msExitFullscreen();
            }
            isFullscreen.value = false;
        }
    };

    // 事件处理器
    const onPlay = () => {
        isPlaying.value = true;
        showControls.value = true;
        clearControlsTimeout();
        emit('play');
    };

    const onPause = () => {
        isPlaying.value = false;
        setControlsTimeout();
        emit('pause');
    };

    const onEnded = () => {
        isPlaying.value = false;
        currentTime.value = 0;
        emit('ended');
    };

    const onTimeUpdate = () => {
        if (videoRef.value) {
            currentTime.value = videoRef.value.currentTime;
            emit('timeupdate', currentTime.value);
        }
    };

    const onProgress = () => {
        if (videoRef.value && videoRef.value.buffered.length > 0) {
            const bufferedEnd = videoRef.value.buffered.end(videoRef.value.buffered.length - 1);
            loadedPercentage.value = (bufferedEnd / duration.value) * 100;
        }
        emit('progress');
    };

    const onWaiting = () => {
        isLoading.value = true;
    };

    const onPlaying = () => {
        isLoading.value = false;
    };

    const onError = (event: Event) => {
        error.value = '视频加载失败';
        console.error('视频错误:', event);
        emit('error', '视频加载失败');
    };

    const onLoadStart = () => {
        isLoading.value = true;
        emit('loadstart');
    };

    const onCanPlay = () => {
        isLoading.value = false;
        emit('canplay');
    };

    const onLoadedMetaData = () => {
        if (videoRef.value) {
            duration.value = videoRef.value.duration;
        }
        emit('loadedmetadata');
    };

    // 工具函数
    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || seconds < 0) return '00:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const hideControlsIfNotPlaying = () => {
        if (!isPlaying.value) {
            setControlsTimeout();
        }
    };

    const setControlsTimeout = () => {
        clearControlsTimeout();
        controlsTimeout.value = window.setTimeout(() => {
            if (!isPlaying.value) {
                showControls.value = false;
            }
        }, 3000) as unknown as number;
    };

    const clearControlsTimeout = () => {
        if (controlsTimeout.value) {
            clearTimeout(controlsTimeout.value);
            controlsTimeout.value = null;
        }
    };

    // 事件监听器管理
    const setupEventListeners = () => {
        if (!videoRef.value) return;

        videoRef.value.addEventListener('play', onPlay);
        videoRef.value.addEventListener('pause', onPause);
        videoRef.value.addEventListener('ended', onEnded);
        videoRef.value.addEventListener('timeupdate', onTimeUpdate);
        videoRef.value.addEventListener('progress', onProgress);
        videoRef.value.addEventListener('waiting', onWaiting);
        videoRef.value.addEventListener('playing', onPlaying);
        videoRef.value.addEventListener('error', onError);
        videoRef.value.addEventListener('loadstart', onLoadStart);
        videoRef.value.addEventListener('canplay', onCanPlay);
        videoRef.value.addEventListener('loadedmetadata', onLoadedMetaData);
    };

    const removeEventListeners = () => {
        if (!videoRef.value) return;

        videoRef.value.removeEventListener('play', onPlay);
        videoRef.value.removeEventListener('pause', onPause);
        videoRef.value.removeEventListener('ended', onEnded);
        videoRef.value.removeEventListener('timeupdate', onTimeUpdate);
        videoRef.value.removeEventListener('progress', onProgress);
        videoRef.value.removeEventListener('waiting', onWaiting);
        videoRef.value.removeEventListener('playing', onPlaying);
        videoRef.value.removeEventListener('error', onError);
        videoRef.value.removeEventListener('loadstart', onLoadStart);
        videoRef.value.removeEventListener('canplay', onCanPlay);
        videoRef.value.removeEventListener('loadedmetadata', onLoadedMetaData);
    };

    // 监听autoplay变化
    watch(
        () => props.autoplay,
        async (newAutoplay) => {
            if (newAutoplay && videoRef.value) {
                await nextTick();
                play();
            }
        },
    );

    // 监听src变化
    watch(
        () => props.src,
        (newSrc) => {
            if (videoRef.value) {
                videoRef.value.load();
            }
            // 重置状态
            isPlaying.value = false;
            currentTime.value = 0;
            duration.value = 0;
            error.value = null;
        },
    );

    // 生命周期钩子
    onMounted(() => {
        setupEventListeners();
        if (props.autoplay) {
            nextTick(() => {
                play();
            });
        }
    });

    onBeforeUnmount(() => {
        removeEventListeners();
        clearControlsTimeout();
    });

    // 导出公共方法供父组件调用
    defineExpose({
        play,
        pause,
        seekTo,
        currentTime,
        duration,
        volume,
        isPlaying,
        togglePlay,
    });
</script>

<style scoped>
    .video-player {
        position: relative;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        box-sizing: border-box;
    }

    .video-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .video-element {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: var(--object-fit, contain);
    }

    .video-poster-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #000;
    }

    .poster-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
        padding: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: opacity 0.3s ease;
        z-index: 10;
    }

    .controls-hidden {
        opacity: 0;
        pointer-events: none;
    }

    .control-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background 0.2s ease;
    }

    .control-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .progress-container {
        flex: 1;
        margin: 0 10px;
        position: relative;
    }

    .progress-slider {
        width: 100%;
        height: 5px;
        -webkit-appearance: none;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 5px;
        outline: none;
        position: absolute;
        top: -15px;
        margin-top: 15px;
    }

    .progress-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
    }

    .progress-bar {
        position: relative;
        height: 5px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 5px;
        cursor: pointer;
        margin-top: 5px;
    }

    .progress-loaded {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 5px;
        transition: width 0.1s ease;
    }

    .progress-played {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: #fff;
        border-radius: 5px;
        transition: width 0.1s ease;
    }

    .time-display {
        color: white;
        font-size: 14px;
        margin: 0 10px;
        white-space: nowrap;
    }

    .volume-slider {
        width: 60px;
        height: 5px;
        -webkit-appearance: none;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 5px;
        outline: none;
        margin-right: 10px;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
    }

    .loading-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 20;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .error-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 20;
    }

    /* 全屏样式 */
    .video-player:fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9999;
    }
</style>
