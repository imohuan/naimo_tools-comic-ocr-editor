import { ref, Ref } from "vue";
import { useRafFn } from "@vueuse/core";

export interface SmoothProgressOptions {
  /** 插值系数，控制平滑程度 (0-1)，默认 0.12 */
  interpolationFactor?: number;
  /** 最小差值阈值，低于此值时直接设置目标值，默认 0.005 */
  minDifferenceThreshold?: number;
  /** 重置阈值，当差值超过此值时直接重置，默认 0.8 */
  resetThreshold?: number;
}

export interface SmoothProgressReturn {
  /** 当前的平滑进度值 */
  smoothValue: Ref<number>;
  /** 是否正在进行平滑更新 */
  isSmoothing: Ref<boolean>;
  /** 启动平滑更新到指定值 */
  startSmoothing: (targetValue: number, getCurrentValue: () => number) => void;
  /** 停止平滑更新 */
  stopSmoothing: () => void;
  /** 直接设置值（不使用平滑过渡） */
  setValue: (value: number) => void;
  /** 重置平滑状态 */
  reset: () => void;
}

/**
 * 平滑进度条 hooks
 * 使用 requestAnimationFrame 实现流畅的数值过渡动画
 */
export function useSmoothProgress(
  options: SmoothProgressOptions = {}
): SmoothProgressReturn {
  const {
    interpolationFactor = 0.12,
    minDifferenceThreshold = 0.005,
    resetThreshold = 0.8,
  } = options;

  const smoothValue = ref(0);
  const isSmoothing = ref(false);
  let targetValueRef = 0;
  let getCurrentValueRef: (() => number) | null = null;
  let lastUpdateTime = 0;

  const { pause: stopRaf, resume: startRaf } = useRafFn(
    () => {
      if (!getCurrentValueRef) return;

      const currentTime = performance.now();
      const deltaTime = Math.min(currentTime - lastUpdateTime, 100); // 限制最大时间差
      lastUpdateTime = currentTime;

      const currentValue = getCurrentValueRef();
      const diff = targetValueRef - smoothValue.value;

      // 如果差值很小，直接设置目标值
      if (Math.abs(diff) <= minDifferenceThreshold) {
        smoothValue.value = targetValueRef;
        return;
      }

      // 使用基于时间的插值，确保不同帧率下的平滑性
      const timeBasedFactor = Math.min(interpolationFactor * deltaTime / 16.67, 1); // 基准60fps
      smoothValue.value += diff * timeBasedFactor;
    },
    { immediate: false }
  );

  const startSmoothing = (
    targetValue: number,
    getCurrentValue: () => number
  ) => {
    targetValueRef = targetValue;
    getCurrentValueRef = getCurrentValue;
    lastUpdateTime = performance.now();

    // 如果差值过大，直接重置到目标值
    if (Math.abs(targetValue - smoothValue.value) > resetThreshold) {
      smoothValue.value = targetValue;
    }

    if (!isSmoothing.value) {
      isSmoothing.value = true;
      startRaf();
    }
  };

  const stopSmoothing = () => {
    stopRaf();
    isSmoothing.value = false;
    getCurrentValueRef = null;
  };

  const setValue = (value: number) => {
    smoothValue.value = value;
    targetValueRef = value;
  };

  const reset = () => {
    stopSmoothing();
    smoothValue.value = 0;
    targetValueRef = 0;
  };

  return {
    smoothValue,
    isSmoothing,
    startSmoothing,
    stopSmoothing,
    setValue,
    reset,
  };
}
