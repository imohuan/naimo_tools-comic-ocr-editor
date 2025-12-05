import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useOcrStore } from "./ocrStore";
import type { ImageItem, OcrTextDetail, OcrTextResult } from "../types";
import { useEdgeTts } from "../composables/useEdgeTts";
import { useNotify } from "../composables/useNotify";
import { useNaimoStore } from "./naimoStore";

export type TaskKind = "ocr" | "audio";
export type TaskStatus = "pending" | "running" | "success" | "error" | "cancelled";

export interface TaskItem {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  imageId?: string;
  detailId?: string;
  label: string;
  errorMessage?: string | null;
}

type TaskRunner = {
  taskId: string;
  kind: TaskKind;
  execute: () => Promise<void>;
  abort?: () => void;
};

const generateTaskId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

export type OcrApplyResultFn = (
  prev: OcrTextResult | null,
  next: OcrTextResult
) => OcrTextResult;

type TaskProgressState = {
  loading: boolean;
  error: string | null;
};

export const useTaskStore = defineStore("task-store", () => {
  const ocrStore = useOcrStore();
  const { generateAudioUrl } = useEdgeTts();
  const { error: notifyError } = useNotify();
  const naimoStore = useNaimoStore();

  const tasks = ref<TaskItem[]>([]);
  const queues: Record<TaskKind, TaskRunner[]> = {
    ocr: [],
    audio: [],
  };
  const pendingRunners = new Map<string, TaskRunner>();
  const runningRunners = new Map<string, TaskRunner>();

  const runningCounts = ref({
    ocr: 0,
    audio: 0,
  });

  const audioConcurrency = ref(2);
  const progressStates = ref<Record<string, TaskProgressState>>({});
  const defaultProgressState: TaskProgressState = { loading: false, error: null };

  const setTaskProgress = (
    key: string,
    patch: Partial<TaskProgressState>
  ) => {
    const prev = progressStates.value[key] || defaultProgressState;
    progressStates.value = {
      ...progressStates.value,
      [key]: {
        ...prev,
        ...patch,
      },
    };
  };

  const clearTaskProgress = (key: string) => {
    if (!(key in progressStates.value)) return;
    const { [key]: _removed, ...rest } = progressStates.value;
    progressStates.value = rest;
  };

  const getProgressByKey = (key: string): TaskProgressState => {
    return progressStates.value[key] || defaultProgressState;
  };

  // 检查特定detail是否在等待队列中
  const isPendingAudioTask = (detailId: string): boolean => {
    return tasks.value.some(task =>
      task.kind === 'audio' &&
      task.detailId === detailId &&
      task.status === 'pending'
    );
  };

  // 检查特定image是否在OCR等待队列中
  const isPendingOcrTask = (imageId: string): boolean => {
    return tasks.value.some(task =>
      task.kind === 'ocr' &&
      task.imageId === imageId &&
      task.status === 'pending'
    );
  };

  // 检查特定detail是否已有音频任务（等待中或运行中）
  const hasAudioTask = (detailId: string): boolean => {
    return tasks.value.some(task =>
      task.kind === 'audio' &&
      task.detailId === detailId &&
      (task.status === 'pending' || task.status === 'running')
    );
  };

  // 检查特定image是否已有OCR任务（等待中或运行中）
  const hasOcrTask = (imageId: string): boolean => {
    return tasks.value.some(task =>
      task.kind === 'ocr' &&
      task.imageId === imageId &&
      (task.status === 'pending' || task.status === 'running')
    );
  };

  const addTask = (partial: Omit<TaskItem, "id" | "createdAt" | "updatedAt">) => {
    const now = Date.now();
    const task: TaskItem = {
      id: generateTaskId(),
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    tasks.value.unshift(task);
    return task;
  };

  const updateTask = (taskId: string, patch: Partial<TaskItem>) => {
    const idx = tasks.value.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const now = Date.now();
    tasks.value[idx] = {
      ...tasks.value[idx],
      ...patch,
      updatedAt: now,
    };
  };

  const findDetailById = (imageId: string, detailId: string) => {
    const image = ocrStore.images.find((img) => img.id === imageId);
    if (!image?.ocrResult?.details?.length) return null;
    const index = image.ocrResult.details.findIndex((d) => d.id === detailId);
    if (index === -1) return null;
    const detail = image.ocrResult.details[index];
    return { image, detail, index };
  };

  const updateDetailById = (
    imageId: string,
    detailId: string,
    updater: (detail: OcrTextDetail) => void
  ) => {
    const found = findDetailById(imageId, detailId);
    if (!found) return;
    const { image, index } = found;
    if (!image.ocrResult) return;
    const nextDetails = [...image.ocrResult.details];
    const target = { ...nextDetails[index] };
    updater(target);
    nextDetails[index] = target;
    image.ocrResult = {
      ...image.ocrResult,
      details: nextDetails,
    };
  };

  const enqueueRunner = (runner: TaskRunner) => {
    queues[runner.kind].push(runner);
    pendingRunners.set(runner.taskId, runner);
    processQueue(runner.kind);
  };

  const processQueue = (kind: TaskKind) => {
    const limit = kind === "ocr" ? 1 : Math.max(1, audioConcurrency.value);
    if (runningCounts.value[kind] >= limit) return;
    const runner = queues[kind].shift();
    if (!runner) return;

    pendingRunners.delete(runner.taskId);
    runningRunners.set(runner.taskId, runner);
    runningCounts.value = {
      ...runningCounts.value,
      [kind]: runningCounts.value[kind] + 1,
    };

    updateTask(runner.taskId, { status: "running", errorMessage: null });

    runner
      .execute()
      .then(() => {
        updateTask(runner.taskId, { status: "success", errorMessage: null });
      })
      .catch((error: any) => {
        if (error?.name === "AbortError") {
          updateTask(runner.taskId, {
            status: "cancelled",
            errorMessage: "任务已取消",
          });
        } else {
          const msg =
            typeof error?.message === "string"
              ? error.message
              : "任务执行失败";
          updateTask(runner.taskId, {
            status: "error",
            errorMessage: msg,
          });
        }
      })
      .finally(() => {
        runningRunners.delete(runner.taskId);
        runningCounts.value = {
          ...runningCounts.value,
          [kind]: Math.max(0, runningCounts.value[kind] - 1),
        };
        processQueue(kind);
      });
  };

  const cancelPendingTask = (taskId: string) => {
    const runner = pendingRunners.get(taskId);
    if (!runner) return false;
    const queue = queues[runner.kind];
    const idx = queue.findIndex((item) => item.taskId === taskId);
    if (idx !== -1) {
      queue.splice(idx, 1);
    }
    pendingRunners.delete(taskId);
    updateTask(taskId, {
      status: "cancelled",
      errorMessage: "任务已取消",
    });
    return true;
  };

  const removeTaskRecord = (taskId: string) => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task || task.status === "running") return false;
    if (task.status === "pending") {
      cancelPendingTask(taskId);
    }
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
    return true;
  };

  const clearTasks = () => {
    // 先取消所有待执行任务
    tasks.value
      .filter((task) => task.status === "pending")
      .forEach((task) => cancelPendingTask(task.id));
    // 仅保留运行中的任务
    tasks.value = tasks.value.filter((task) => task.status === "running");
  };

  const stopTask = (taskId: string) => {
    const runner = runningRunners.get(taskId);
    if (!runner || runner.kind !== "audio" || !runner.abort) return false;
    runner.abort();
    return true;
  };

  // 删除特定detail的音频任务（等待中或运行中）
  const cancelAudioTask = (detailId: string): boolean => {
    // 先检查等待中的任务
    const pendingTask = tasks.value.find(task =>
      task.kind === 'audio' &&
      task.detailId === detailId &&
      task.status === 'pending'
    );

    if (pendingTask) {
      return cancelPendingTask(pendingTask.id);
    }

    // 再检查运行中的任务
    const runningTask = tasks.value.find(task =>
      task.kind === 'audio' &&
      task.detailId === detailId &&
      task.status === 'running'
    );

    if (runningTask) {
      return stopTask(runningTask.id);
    }

    return false;
  };

  const setAudioConcurrency = (value: number) => {
    const next = Math.max(1, value);
    audioConcurrency.value = next;
    processQueue("audio");
  };

  const createAudioRunner = (
    imageId: string,
    detailId: string
  ): TaskRunner | null => {
    const found = findDetailById(imageId, detailId);
    if (!found) return null;
    const { detail } = found;

    const text = (detail.translatedText || detail.text || "").toString().trim();
    if (!text) return null;

    const voice =
      (detail.voiceRole && detail.voiceRole.trim()) || "zh-CN-XiaoxiaoNeural";

    const task = addTask({
      kind: "audio",
      status: "pending",
      imageId,
      detailId,
      label: `音频生成 - ${text.slice(0, 16)}`,
    });

    let abortController: AbortController | null = null;

    const runner: TaskRunner = {
      taskId: task.id,
      kind: "audio",
      execute: async () => {
        abortController = new AbortController();

        setTaskProgress(detailId, { loading: true, error: null });

        // 保存旧的音频 URL，在新音频成功生成后再销毁（这是用户主动触发的重新生成操作）
        let oldAudioUrl: string | null = null;
        const foundAgain = findDetailById(imageId, detailId);
        if (foundAgain?.detail.audioUrl && foundAgain.detail.audioUrl.startsWith("blob:")) {
          oldAudioUrl = foundAgain.detail.audioUrl;
        }

        try {
          let audioUrl: string | null = null;
          let audioFilePath: string | null = null;
          const image = ocrStore.images.find((img) => img.id === imageId);

          if (naimoStore.isProjectMode && image?.path && detailId) {
            // 项目模式：使用本地音频生成
            console.log('[taskStore.createAudioRunner] 项目模式：开始生成音频', {
              imagePath: image.path,
              detailId,
              text: text.substring(0, 50) + '...',
              voice
            });

            const audioBuffer = await naimoStore.generateAudio(text, {
              voice,
              rate: '+0%',
              volume: '+0%',
              pitch: '+0Hz',
            });

            if (audioBuffer) {
              console.log('[taskStore.createAudioRunner] 音频生成成功，开始保存', {
                bufferSize: audioBuffer.length
              });
              // 立即保存音频文件到本地
              audioFilePath = await naimoStore.saveAudioFile(detailId, audioBuffer);
              if (audioFilePath) {
                console.log('[taskStore.createAudioRunner] 音频文件保存成功，获取 URL', {
                  audioFilePath
                });
                audioUrl = await naimoStore.getAudioUrl(audioFilePath);
                // 立即保存音频文件信息到配置
                console.log('[taskStore.createAudioRunner] 保存音频文件信息到配置', {
                  imagePath: image.path,
                  detailId,
                  audioFilePath
                });
                const saveInfoSuccess = await naimoStore.saveAudioFileInfo(image.path, detailId, audioFilePath);
                if (saveInfoSuccess) {
                  console.log('[taskStore.createAudioRunner] ✅ 音频保存流程完成', {
                    audioUrl: audioUrl ? '已生成' : '未生成',
                    audioFilePath
                  });
                } else {
                  console.error('[taskStore.createAudioRunner] ⚠️ 音频文件已保存，但保存配置信息失败');
                }
              } else {
                console.error('[taskStore.createAudioRunner] ❌ 音频文件保存失败');
                throw new Error('音频文件保存失败');
              }
            } else {
              console.error('[taskStore.createAudioRunner] ❌ 音频生成失败，返回 null');
              throw new Error('音频生成失败');
            }
          } else {
            // 浏览器模式：使用网络音频生成
            const generatedUrl = await generateAudioUrl(text, voice, {
              signal: abortController.signal,
            });
            audioUrl = generatedUrl || null;
            // 注意：浏览器模式下无法直接保存到本地文件系统，只能创建 blob URL
          }

          // 新音频成功生成后，销毁旧的音频 URL
          if (oldAudioUrl && audioUrl && oldAudioUrl.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(oldAudioUrl);
            } catch (e) {
              console.warn("销毁旧音频 URL 失败:", e);
            }
          }

          updateDetailById(imageId, detailId, (d) => {
            d.audioUrl = audioUrl || null;
            d.audioPath = audioFilePath || undefined;
          });
          clearTaskProgress(detailId);
        } catch (error: any) {
          const msg =
            error?.name === "AbortError"
              ? "任务已取消"
              : typeof error?.message === "string"
                ? error.message
                : "生成音频失败";
          setTaskProgress(detailId, {
            loading: false,
            error: msg,
          });
          // 错误状态已通过 taskStore 的 progress 系统处理，无需更新 detail
          // 使用 Naive UI notify 弹出错误提示
          notifyError(`音频生成失败：${msg}`);
          if (error?.name !== "AbortError") {
            throw error;
          }
          throw error;
        } finally {
          abortController = null;
        }
      },
      abort: () => {
        abortController?.abort();
      },
    };

    return runner;
  };

  const startAudioForDetail = (imageId: string, detailId: string) => {
    // 检查是否已存在该detail的音频任务（等待中或运行中）
    if (hasAudioTask(detailId)) {
      // 如果是等待中的任务，取消并替换
      const existingPendingTask = tasks.value.find(task =>
        task.kind === 'audio' &&
        task.detailId === detailId &&
        task.status === 'pending'
      );

      if (existingPendingTask) {
        cancelPendingTask(existingPendingTask.id);
        // 创建新任务替换
        const runner = createAudioRunner(imageId, detailId);
        if (!runner) return;
        enqueueRunner(runner);
      }
      // 如果是运行中的任务，不做任何操作，不允许重复添加
      return;
    }

    // 没有现有任务，直接创建新任务
    const runner = createAudioRunner(imageId, detailId);
    if (!runner) return;
    enqueueRunner(runner);
  };

  const startBatchAudioForImage = (
    imageId: string,
    mode: "skipDone" | "forceAll" = "skipDone"
  ) => {
    const image = ocrStore.images.find((img) => img.id === imageId);
    if (!image?.ocrResult?.details?.length) return;
    const targets = (image.ocrResult.details as OcrTextDetail[]).filter(
      (detail) => {
        if (!detail.id) return false;
        if (mode === "skipDone" && detail.audioUrl) return false;
        return true;
      }
    );
    targets.forEach((detail) => {
      if (detail.id) {
        startAudioForDetail(imageId, detail.id);
      }
    });
  };

  const startBatchAudioForAllImages = (
    mode: "skipDone" | "forceAll" = "skipDone"
  ) => {
    const list = (ocrStore.images || []) as ImageItem[];
    list.forEach((img) => {
      if (!img?.ocrResult?.details?.length) return;
      startBatchAudioForImage(img.id, mode);
    });
  };

  type OcrRunnerOptions = {
    withAudio?: boolean;
    audioMode?: "skipDone" | "forceAll";
  };

  const createOcrRunner = (
    image: ImageItem,
    applyResult: OcrApplyResultFn,
    options?: OcrRunnerOptions
  ): TaskRunner => {
    const task = addTask({
      kind: "ocr",
      status: "pending",
      imageId: image.id,
      label: `OCR - ${image.file?.name || image.id}`,
    });

    return {
      taskId: task.id,
      kind: "ocr",
      execute: async () => {
        await ocrStore.runOcrTask(image.id, image.file, applyResult);
        if (options?.withAudio) {
          startBatchAudioForImage(image.id, options.audioMode);
        }
      },
    };
  };

  const startOcrForImage = (
    image: ImageItem,
    applyResult: OcrApplyResultFn,
    options?: OcrRunnerOptions
  ) => {
    // 检查是否已存在该image的OCR任务（等待中或运行中）
    if (hasOcrTask(image.id)) {
      // 如果是等待中的任务，取消并替换
      const existingPendingTask = tasks.value.find(task =>
        task.kind === 'ocr' &&
        task.imageId === image.id &&
        task.status === 'pending'
      );

      if (existingPendingTask) {
        cancelPendingTask(existingPendingTask.id);
        // 创建新任务替换
        const runner = createOcrRunner(image, applyResult, options);
        enqueueRunner(runner);
      }
      // 如果是运行中的任务，不做任何操作，不允许重复添加
      return;
    }

    // 没有现有任务，直接创建新任务
    const runner = createOcrRunner(image, applyResult, options);
    enqueueRunner(runner);
  };

  const startBatchOcr = (
    mode: "skipDone" | "forceAll" = "skipDone",
    options?: OcrRunnerOptions
  ) => {
    const list = (ocrStore.images || []).filter(
      (img) => img && img.file
    ) as ImageItem[];
    list.forEach((img) => {
      if (mode === "skipDone" && img.ocrResult) return;
      startOcrForImage(
        img,
        (_prev, next) => next,
        options
          ? {
            ...options,
            audioMode: options.audioMode || mode,
          }
          : undefined
      );
    });
  };

  const startBatchAudioForCurrentImage = (
    mode: "skipDone" | "forceAll" = "skipDone"
  ) => {
    const image = ocrStore.currentImage;
    if (!image) return;
    startBatchAudioForImage(image.id, mode);
  };

  const canBatchOcr = computed(() => ocrStore.images.length > 0);
  const canBatchAudio = computed(() => {
    const img = ocrStore.currentImage;
    return !!(img && img.ocrResult && img.ocrResult.details.length > 0);
  });

  const runningTasks = computed(() =>
    tasks.value.filter((task) => task.status === "running")
  );

  return {
    tasks,
    runningTasks,
    audioConcurrency,
    progressStates: computed(() => progressStates.value),
    canBatchOcr,
    canBatchAudio,
    startOcrForImage,
    startBatchOcr,
    startAudioForDetail,
    startBatchAudioForCurrentImage,
    startBatchAudioForAllImages,
    cancelPendingTask,
    stopTask,
    removeTaskRecord,
    clearTasks,
    setAudioConcurrency,
    getProgressByKey,
    isPendingAudioTask,
    isPendingOcrTask,
    hasAudioTask,
    hasOcrTask,
    cancelAudioTask,
    clearTaskProgress,
  };
});

