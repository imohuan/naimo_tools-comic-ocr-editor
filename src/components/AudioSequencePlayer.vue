<template>
  <div
    class="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#05060a] text-white"
  >
    <!-- 画布区域：支持缩放 / 平移 -->
    <div
      ref="canvasWrapper"
      class="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
      @wheel.prevent="handleWheel"
      @mousemove="handlePointerMove"
    >
      <canvas
        ref="canvasRef"
        class="h-full w-full block"
        @mousedown="handleMouseDown"
      ></canvas>

      <!-- 加载 / 空状态 -->
      <div
        v-if="isPreparing"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm"
      >
        <span
          class="h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-transparent"
        ></span>
        <span>正在准备音频时间轴...</span>
      </div>
      <div
        v-else-if="!props.playlist.length"
        class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-gray-300"
      >
        暂无可播放的音频
      </div>
      <div
        v-else-if="preparationError"
        class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-1.5 text-xs shadow-lg"
      >
        {{ preparationError }}
      </div>

      <!-- 字幕 -->
      <div
        v-if="currentText"
        class="pointer-events-none absolute bottom-3 left-1/2 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/30 px-4 py-1.5 text-center text-sm shadow-xl backdrop-blur"
      >
        {{ currentText }}
      </div>

      <!-- 底部控制区：悬停时显示，离开 3s 后自动隐藏 -->
      <div
        v-show="showControls"
        class="absolute bottom-0 left-0 right-0 z-10 flex flex-col bg-gradient-to-t from-black/80 via-black/60 to-transparent px-2 pb-1 pt-1"
      >
        <!-- 时间轴（2px 高度） -->
        <div class="flex items-center gap-3 text-xs text-white/70">
          <div class="flex-1">
            <n-slider
              :value="timelineValue"
              :min="0"
              :max="Math.max(totalDuration, 0.01)"
              :step="0.01"
              :disabled="!canInteractTimeline"
              :style="{
                '--n-rail-height': '2px',
                '--n-handle-size': '10px',
              }"
              @update:value="handleTimelineUpdate"
            />
          </div>
        </div>

        <!-- 控制条：上一段 / 播放 / 下一段 + 右侧音量/倍速/全屏 -->
        <div class="mt-1 flex items-center justify-between gap-4 text-xs">
          <!-- 左侧：段控制 + 当前段落计数 -->
          <div class="flex items-center gap-2">
            <span class="text-[13px] text-white/60 font-mono flex gap-2 pl-2">
              <span>{{ currentIndex + 1 }}</span>
              <span>/</span>
              <span>{{ props.playlist.length || 0 }}</span>
            </span>

            <div class="flex items-center gap-1.5">
              <!-- 上一段 -->
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="currentIndex === 0 || isPreparing"
                @click="handlePrev"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M6 5v14" />
                  <path d="M18 5l-9 7 9 7" />
                </svg>
              </button>

              <!-- 播放 / 暂停 -->
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center text-emerald-400 transition hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="!canPlay"
                @click="togglePlay"
              >
                <svg
                  v-if="!isPlaying"
                  viewBox="0 0 24 24"
                  class="h-5 w-5"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              </button>

              <!-- 下一段 -->
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="currentIndex >= props.playlist.length - 1 || isPreparing"
                @click="handleNext"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 5v14" />
                  <path d="M6 5l9 7-9 7" />
                </svg>
              </button>
            </div>

            <div class="flex gap-2">
              <span class="w-14 text-right font-mono">
                {{ formatTime(displayedCurrentTime) }}
              </span>
              <span>/</span>
              <span class="w-14 font-mono">
                {{ formatTime(totalDuration) }}
              </span>
            </div>
          </div>

          <!-- 右侧：音量 / 倍速 / 全屏 -->
          <div class="flex items-center gap-4">
            <!-- 音量：悬浮垂直滑条 -->
            <div
              class="relative flex items-center"
              @mouseenter="showVolumePanel = true"
              @mouseleave="showVolumePanel = false"
            >
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-emerald-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M11 5L6 9H3v6h3l5 4z" />
                  <path d="M15.54 8.46A5 5 0 0 1 17 12a5 5 0 0 1-1.46 3.54" />
                </svg>
              </button>
              <div class="absolute bottom-7 left-1/2 -translate-x-1/2 h-2 w-10"></div>

              <div
                v-if="showVolumePanel"
                class="absolute bottom-9 left-1/2 z-20 -translate-x-1/2 rounded-2xl bg-[#252836] py-2 text-[11px] text-white/80 shadow-xl flex flex-col items-center w-10"
              >
                <span class="mt-2 text-xs leading-none">
                  {{ Math.round(volume * 100) }}
                </span>
                <div class="flex h-24 items-center -mt-2">
                  <input
                    v-model.number="volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    class="h-1 w-16 origin-center -rotate-90 cursor-pointer appearance-none rounded-full bg-white/20 accent-emerald-400"
                  />
                </div>
              </div>
            </div>

            <!-- 倍速：悬浮纵向列表（不使用 Popover） -->
            <div
              class="relative flex items-center"
              @mouseenter="showRatePanel = true"
              @mouseleave="showRatePanel = false"
            >
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-emerald-400"
              >
                <span class="text-[11px] font-medium">
                  {{ playbackRate.toFixed(2).replace(/\.00$/, "") }}x
                </span>
              </button>
              <div class="absolute bottom-7 left-1/2 -translate-x-1/2 h-2 w-10"></div>

              <div
                v-if="showRatePanel"
                class="absolute bottom-9 left-1/2 z-20 -translate-x-1/2 max-h-56 w-16 overflow-y-auto rounded-2xl bg-[#252836] py-1 text-[11px] text-white/80 shadow-xl"
              >
                <button
                  v-for="rate in rateOptions"
                  :key="rate"
                  type="button"
                  class="flex w-full items-center justify-center px-2 py-1 hover:bg-white/10"
                  :class="rate === playbackRate ? 'text-emerald-400 font-semibold' : ''"
                  @click="playbackRate = rate"
                >
                  {{ rate }}x
                </button>
              </div>
            </div>

            <!-- 全屏 -->
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-white"
              @click="toggleFullscreen"
            >
              <svg
                v-if="!isFullscreen"
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 3H5a2 2 0 0 0-2 2v4" />
                <path d="M15 3h4a2 2 0 0 1 2 2v4" />
                <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
                <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <audio
      ref="audioRef"
      class="hidden"
      preload="auto"
      @timeupdate="handleAudioTimeUpdate"
      @ended="handleAudioEnded"
      @loadedmetadata="handleAudioLoadedMetadata"
    ></audio>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  useElementHover,
  useTimeoutFn,
  useDebounceFn,
  useEventListener,
} from "@vueuse/core";
import { useSmoothProgress } from "../composables/useSmoothProgress";
import { NSlider } from "naive-ui";
import { mergeAudioFiles } from "../utils/audio";

export interface SequencePlaybackRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SequencePlaybackItem {
  image: string;
  audio: string;
  text: string;
  rect: SequencePlaybackRect | null;
  imageWidth: number;
  imageHeight: number;
  duration?: number | null;
}

const props = defineProps<{
  modelValue: boolean;
  playlist: SequencePlaybackItem[];
}>();

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const isActive = computed(() => props.modelValue);

const canvasWrapper = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const audioRef = ref<HTMLAudioElement>();

const durations = ref<number[]>([]);
const mergedAudioUrl = ref<string | null>(null);
const currentIndex = ref(0);
const isPlaying = ref(false);
const isPreparing = ref(false);
const preparationError = ref<string | null>(null);
const globalTime = ref(0);
const displayedCurrentTime = computed(() => globalTime.value);
const timelineValue = ref(0);
const isDraggingTimeline = ref(false);
const switchToken = ref(0);

// 使用平滑进度条 hooks
const {
  smoothValue: smoothTimelineValue,
  isSmoothing: isSmoothUpdating,
  startSmoothing,
  stopSmoothing,
  setValue: setSmoothValue,
  reset: resetSmoothProgress,
} = useSmoothProgress({
  interpolationFactor: 0.08, // 提高插值系数，使动画更流畅
  minDifferenceThreshold: 0.003, // 降低阈值，提高精度
  resetThreshold: 1.0, // 提高重置阈值，减少不必要的重置
});

// 视图缩放 / 平移
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const lastPanX = ref(0);
const lastPanY = ref(0);

// 控制区显隐：悬停时显示，离开 3 秒后隐藏
const showControls = ref(true);
const isHoveringCanvas = useElementHover(canvasWrapper);
const { start: startHideControlsTimer, stop: stopHideControlsTimer } = useTimeoutFn(
  () => {
    showControls.value = false;
  },
  3000,
  { immediate: false }
);

// 用户在画布区域有任何指针活动时，重置 3 秒隐藏计时
const handleUserActivity = () => {
  showControls.value = true;
  stopHideControlsTimer();
  startHideControlsTimer();
};

const handlePointerMove = () => {
  // 仅在仍然处于 hover 状态时认为是有效活动
  if (!isHoveringCanvas.value) return;
  handleUserActivity();
};

watch(
  isHoveringCanvas,
  (hovering) => {
    if (hovering) {
      // 鼠标进入：立刻显示并启动 3 秒静止隐藏计时
      handleUserActivity();
    } else {
      // 鼠标离开：开始 3 秒隐藏计时
      startHideControlsTimer();
    }
  },
  { immediate: true }
);

// 音量 / 倍速
const volume = ref(1);
const playbackRate = ref(1);

// 全屏状态
const isFullscreen = ref(false);
const showVolumePanel = ref(false);
const showRatePanel = ref(false);
const rateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

const totalDuration = computed(() =>
  durations.value.reduce(
    (sum, duration) => sum + (Number.isFinite(duration) ? duration : 0),
    0
  )
);

const clipOffsets = computed(() => {
  const offsets: number[] = [];
  let cursor = 0;
  durations.value.forEach((duration) => {
    offsets.push(cursor);
    cursor += Number.isFinite(duration) ? duration : 0;
  });
  return offsets;
});

const currentItem = computed(() => props.playlist[currentIndex.value] ?? null);
const currentText = computed(() => currentItem.value?.text ?? "");

const canPlay = computed(() => {
  return !isPreparing.value && props.playlist.length > 0 && totalDuration.value > 0;
});

const canInteractTimeline = computed(() => canPlay.value && !isPreparing.value);

const imageCache = new Map<string, HTMLImageElement>();

const resetPlayerState = () => {
  const audio = audioRef.value;
  if (audio) {
    audio.pause();
    audio.src = "";
  }
  if (mergedAudioUrl.value) {
    URL.revokeObjectURL(mergedAudioUrl.value);
    mergedAudioUrl.value = null;
  }
  currentIndex.value = 0;
  isPlaying.value = false;
  globalTime.value = 0;
  timelineValue.value = 0;
  resetSmoothProgress(); // 重置平滑进度条
  switchToken.value++;
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
};

const formatTime = (input: number) => {
  if (!Number.isFinite(input) || input < 0) return "00:00";
  const minutes = Math.floor(input / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(input % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const ensureImage = (url: string): Promise<HTMLImageElement> => {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  const wrapper = canvasWrapper.value;
  if (!canvas || !wrapper) return;
  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
};

const drawFrame = async () => {
  await nextTick();
  const canvas = canvasRef.value;
  const wrapper = canvasWrapper.value;
  if (!canvas || !wrapper) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  resizeCanvas();
  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const item = currentItem.value;
  if (!item) {
    ctx.restore();
    return;
  }

  try {
    const img = await ensureImage(item.image);
    const baseScale = Math.min(width / item.imageWidth, height / item.imageHeight);
    const scale = baseScale * zoom.value;
    const drawWidth = item.imageWidth * scale;
    const drawHeight = item.imageHeight * scale;
    const offsetX = (width - drawWidth) / 2 + panX.value;
    const offsetY = (height - drawHeight) / 2 + panY.value;

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // 只有当 rect 不为 null 时才绘制高亮框
    if (item.rect) {
      const rectWidth = (item.rect.maxX - item.rect.minX) * baseScale * zoom.value;
      const rectHeight = (item.rect.maxY - item.rect.minY) * baseScale * zoom.value;
      const rectX = offsetX + item.rect.minX * baseScale * zoom.value;
      const rectY = offsetY + item.rect.minY * baseScale * zoom.value;

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(2, 2 * scale);
      ctx.shadowColor = "rgba(239,68,68,0.5)";
      ctx.shadowBlur = 6;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    }
  } catch (error) {
    console.error("绘制图像失败", error);
  } finally {
    ctx.restore();
  }
};

const handleWheel = (event: WheelEvent) => {
  if (!currentItem.value) return;
  const delta = event.deltaY;
  const factor = delta > 0 ? 0.9 : 1.1;
  const next = Math.min(3, Math.max(0.5, zoom.value * factor));
  if (next === zoom.value) return;
  zoom.value = next;
  drawFrame();
};

const handleMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return;
  isPanning.value = true;
  lastPanX.value = event.clientX;
  lastPanY.value = event.clientY;
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
};

const handleMouseMove = (event: MouseEvent) => {
  if (!isPanning.value) return;
  const dx = event.clientX - lastPanX.value;
  const dy = event.clientY - lastPanY.value;
  lastPanX.value = event.clientX;
  lastPanY.value = event.clientY;
  panX.value += dx;
  panY.value += dy;
  drawFrame();
};

const handleMouseUp = () => {
  if (!isPanning.value) return;
  isPanning.value = false;
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
};

const prepareTimeline = async () => {
  if (!props.playlist.length) {
    durations.value = [];
    if (mergedAudioUrl.value) {
      URL.revokeObjectURL(mergedAudioUrl.value);
      mergedAudioUrl.value = null;
    }
    return;
  }

  console.log("播放列表", props.playlist);

  isPreparing.value = true;
  preparationError.value = null;
  try {
    // 如果播放项已经包含时长，先行填充时间轴，减少等待
    const presetDurations = props.playlist
      .map((item) => item.duration)
      .filter((d): d is number => Number.isFinite(d));
    if (presetDurations.length === props.playlist.length) {
      durations.value = presetDurations;
    }

    // 额外步骤：将整列音频合并为一个音频文件，供播放器统一播放
    const files: File[] = [];
    for (let i = 0; i < props.playlist.length; i++) {
      const url = props.playlist[i]?.audio;
      if (!url) continue;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`获取音频失败: ${response.status}`);
      }
      const blob = await response.blob();
      const file = new File([blob], `segment-${i}.wav`, {
        type: blob.type || "audio/wav",
      });
      files.push(file);
    }

    if (!files.length) {
      throw new Error("未能获取到有效的音频文件");
    }

    const { blob: mergedBlob, durations: mergedDurations } = await mergeAudioFiles(files);
    console.log("Merged audio durations:", mergedDurations);
    durations.value = mergedDurations;

    if (mergedAudioUrl.value) {
      URL.revokeObjectURL(mergedAudioUrl.value);
    }
    mergedAudioUrl.value = URL.createObjectURL(mergedBlob);

    const audio = audioRef.value;
    if (audio && mergedAudioUrl.value) {
      audio.pause();
      audio.src = mergedAudioUrl.value;
      audio.load();
    }
  } catch (error: any) {
    preparationError.value =
      typeof error?.message === "string" ? error.message : "时间轴准备失败";
    durations.value = [];
    if (mergedAudioUrl.value) {
      URL.revokeObjectURL(mergedAudioUrl.value);
      mergedAudioUrl.value = null;
    }
  } finally {
    isPreparing.value = false;
  }
};

const startPlaybackSession = async () => {
  if (!isActive.value) return;
  if (!props.playlist.length) return;
  await prepareTimeline();
  // 合并音频后从头开始准备播放（不自动播放）
  const audio = audioRef.value;
  if (audio) {
    try {
      audio.currentTime = 0;
    } catch {
      // 忽略设置失败
    }
  }
  await drawFrame();
};

const togglePlay = async () => {
  if (!canPlay.value) return;
  const audio = audioRef.value;
  if (!audio) return;

  if (isPlaying.value) {
    audio.pause();
    isPlaying.value = false;
    // 停止平滑更新，同步到当前实际时间
    stopSmoothing();
    const currentTime = audio.currentTime || 0;
    const [clamped] = getTimeForInfo(currentTime);
    setSmoothValue(clamped);
    timelineValue.value = clamped;
    return;
  }

  try {
    await audio.play();
    isPlaying.value = true;
    // 播放开始时立即启动平滑更新
    const currentTime = audio.currentTime || 0;
    const [clamped] = getTimeForInfo(currentTime);
    startSmoothing(clamped, () => {
      const current = audio.currentTime || 0;
      return Math.min(current, totalDuration.value);
    });
  } catch (error) {
    console.warn("无法播放音频", error);
    isPlaying.value = false;
  }
};

const handlePrev = async () => {
  if (currentIndex.value === 0) {
    await seekTo(0);
    return;
  }
  const offsets = clipOffsets.value;
  const target = offsets[currentIndex.value - 1] ?? 0;
  await seekTo(target);
};

const handleNext = async () => {
  if (currentIndex.value >= props.playlist.length - 1) {
    await seekTo(totalDuration.value);
    return;
  }
  const offsets = clipOffsets.value;
  const target = offsets[currentIndex.value + 1] ?? 0;
  await seekTo(target);
};

/** 获取当前时间的索引 */
const getTimeForInfo = (time: number): [number, number] => {
  const total = totalDuration.value;
  if (total <= 0) return [0, 0];

  const clamped = Math.min(Math.max(time, 0), total);
  const offsets = clipOffsets.value;

  // 根据目标时间定位到对应片段索引
  let targetIndex = offsets.length - 1;
  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i];
    const end = start + (durations.value[i] ?? 0);
    if (clamped < end || i === offsets.length - 1) {
      targetIndex = i;
      break;
    }
  }

  // console.log("获取INDEX", time, clamped, JSON.stringify(offsets), targetIndex);
  return [clamped, targetIndex];
};

const seekTo = async (time: number, autoPlay = isPlaying.value) => {
  if (!canPlay.value) return;
  const audio = audioRef.value;
  if (!audio) return;
  const total = totalDuration.value;
  if (total <= 0) return;
  // 根据目标时间定位到对应片段索引
  const [clamped, targetIndex] = getTimeForInfo(time);
  currentIndex.value = targetIndex;
  globalTime.value = clamped;
  timelineValue.value = clamped;
  setSmoothValue(clamped); // 同步平滑值

  try {
    audio.currentTime = clamped;
  } catch {
    // 忽略设置失败
  }

  if (autoPlay && clamped < total) {
    try {
      await audio.play();
      isPlaying.value = true;
    } catch (error) {
      console.warn("音频播放失败", error);
      isPlaying.value = false;
    }
  } else if (!autoPlay) {
    audio.pause();
    isPlaying.value = false;
  }
};

// 音量 / 倍速联动 audio 元素
watch(
  () => volume.value,
  (val) => {
    const audio = audioRef.value;
    if (!audio) return;
    const v = Math.min(1, Math.max(0, Number.isFinite(val) ? val : 1));
    audio.volume = v;
  },
  { immediate: true }
);

watch(
  () => playbackRate.value,
  (val) => {
    const audio = audioRef.value;
    if (!audio) return;
    const rate = Number.isFinite(val) && val > 0 ? val : 1;
    audio.playbackRate = rate;
  },
  { immediate: true }
);

const handleTimelineChange = useDebounceFn(() => {
  isDraggingTimeline.value = false;
}, 1000);

const handleTimelineUpdate = async (value: number | [number, number]) => {
  if (Array.isArray(value)) return;
  isDraggingTimeline.value = true;
  timelineValue.value = value;
  setSmoothValue(value); // 同步平滑值
  // 支持拖拽时实时预览（Scrubbing）
  await seekTo(value, false);
  handleTimelineChange();
};

const handleAudioTimeUpdate = (_e: Event) => {
  if (!canPlay.value) return;
  if (isDraggingTimeline.value) return;
  const audio = audioRef.value;
  if (!audio) return;

  const time = audio.currentTime || 0;
  const [clamped, targetIndex] = getTimeForInfo(time);

  // 播放时使用平滑更新，暂停时直接更新
  if (isPlaying.value) {
    // 启动平滑更新，提供实时的当前时间获取函数
    startSmoothing(clamped, () => {
      const currentTime = audio.currentTime || 0;
      return Math.min(currentTime, totalDuration.value);
    });
  } else {
    // 暂停时停止平滑更新并直接设置值
    stopSmoothing();
    setSmoothValue(clamped);
    timelineValue.value = clamped;
  }

  globalTime.value = clamped;
  currentIndex.value = targetIndex;
};

const handleAudioLoadedMetadata = () => {
  const audio = audioRef.value;
  if (!audio) return;
  const current = audio.currentTime || 0;
  const clamped = Math.min(current, totalDuration.value);
  globalTime.value = clamped;
  timelineValue.value = clamped;
};

const handleAudioEnded = () => {
  const audio = audioRef.value;
  if (!audio) return;
  isPlaying.value = false;
  globalTime.value = totalDuration.value;
  timelineValue.value = totalDuration.value;
  // 停止平滑更新并设置最终值
  stopSmoothing();
  setSmoothValue(totalDuration.value);
  audio.pause();
};

// 键盘快捷键：空格播放 / 暂停，小键盘左右 / 方向键左右 ±0.4s，Ctrl + 左右切换上一段 / 下一段
const KEY_SEEK_STEP = 0.4;

const handleKeydown = async (event: KeyboardEvent) => {
  if (!isActive.value) return;

  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;
  const isEditable =
    target?.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT";

  // 输入区域内不处理快捷键，避免干扰输入
  if (isEditable) return;

  const { code, ctrlKey } = event;

  // 空格：播放 / 暂停
  if (code === "Space") {
    event.preventDefault();
    await togglePlay();
    return;
  }

  const isLeft = code === "ArrowLeft" || code === "Numpad4";
  const isRight = code === "ArrowRight" || code === "Numpad6";

  if (!isLeft && !isRight) return;

  event.preventDefault();

  // Ctrl + 左右：切换上一段 / 下一段
  if (ctrlKey) {
    if (isLeft) {
      await handlePrev();
    } else if (isRight) {
      await handleNext();
    }
    return;
  }

  // 默认：时间轴 ±0.4s
  const delta = isLeft ? -KEY_SEEK_STEP : KEY_SEEK_STEP;
  await seekTo(globalTime.value + delta);
};

const toggleFullscreen = async () => {
  const wrapper = canvasWrapper.value;
  if (!wrapper) return;

  try {
    if (!isFullscreen.value) {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await wrapper.requestFullscreen();
      isFullscreen.value = true;
    } else {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      isFullscreen.value = false;
    }
  } catch (error) {
    console.warn("切换全屏失败", error);
  }
};

// 监听全屏变更（兼容用户按 Esc 退出）
if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", () => {
    const wrapper = canvasWrapper.value;
    isFullscreen.value = !!wrapper && document.fullscreenElement === wrapper;
  });
}

watch(
  () => props.playlist,
  async () => {
    resetPlayerState();
    if (isActive.value) {
      await nextTick();
      startPlaybackSession();
    }
  },
  { deep: true }
);

watch(
  () => isActive.value,
  async (active) => {
    if (active) {
      await nextTick();
      startPlaybackSession();
    } else {
      resetPlayerState();
    }
  },
  { immediate: true }
);

watch(currentIndex, () => {
  drawFrame();
});

watch(globalTime, (value) => {
  if (!isDraggingTimeline.value && !isSmoothUpdating.value) {
    timelineValue.value = value;
    setSmoothValue(value);
  }
});

// 监听平滑值变化，更新 timelineValue 和相关状态
watch(smoothTimelineValue, (value) => {
  if (isSmoothUpdating.value && !isDraggingTimeline.value) {
    timelineValue.value = value;
    // 同步更新全局时间和当前索引
    const [clamped, targetIndex] = getTimeForInfo(value);
    globalTime.value = clamped;
    currentIndex.value = targetIndex;
  }
});

watch(
  () => canvasWrapper.value,
  (wrapper, _, onCleanup) => {
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
      drawFrame();
    });
    observer.observe(wrapper);
    onCleanup?.(() => observer.disconnect());
  }
);

onBeforeUnmount(() => {
  resetPlayerState();
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
});

useEventListener(window, "keydown", handleKeydown);
</script>

<style scoped>
.asp-root {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #05060a;
  color: #ffffff;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-image: radial-gradient(
      circle at 20% 20%,
      rgba(56, 189, 248, 0.15),
      transparent
    ),
    radial-gradient(circle at 80% 0%, rgba(147, 51, 234, 0.2), transparent),
    radial-gradient(circle at 50% 80%, rgba(248, 113, 113, 0.18), transparent);
}

.asp-stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.asp-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(5, 6, 10, 0.9));
}

.asp-canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.asp-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.6);
  text-align: center;
}

.asp-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: transparent;
  border-radius: 999px;
  animation: asp-spin 1s linear infinite;
}

@keyframes asp-spin {
  to {
    transform: rotate(360deg);
  }
}

.asp-toast {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.asp-caption {
  position: absolute;
  left: 50%;
  bottom: 112px;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  font-size: 0.9rem;
  text-align: center;
  max-width: 80%;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

.asp-control-panel {
  position: relative;
  z-index: 10;
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.4), transparent);
}

.asp-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.asp-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asp-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.asp-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.asp-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.asp-play-btn {
  height: 44px;
  padding: 0 28px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  color: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.asp-play-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.asp-play-btn--start {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.asp-play-btn--stop {
  background: linear-gradient(135deg, #f87171, #ef4444);
}

.asp-play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.asp-counter {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
}

.asp-timeline {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.asp-time {
  width: 64px;
  text-align: center;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}
</style>
