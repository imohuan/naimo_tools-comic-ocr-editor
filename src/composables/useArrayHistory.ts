import { ref, computed, watch, type Ref } from "vue";

interface UseArrayHistoryOptions {
  // 最大历史记录数量，超出后从头部移除
  maxSize?: number;
  // 防抖时间（毫秒），用于合并短时间内的多次修改
  debounce?: number;
  // 外部控制：当该标记为 true 时，忽略当前变更（例如从 Store 同步到本地时）
  ignoreRef?: Ref<boolean>;
}

interface UseArrayHistoryResult {
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  undo: () => void;
  redo: () => void;
  dispose: () => void;
}

/**
 * 通用数组历史记录 hooks
 * 仅依赖浅层数组 + 显式拷贝，避免 deep 监听的性能开销
 */
export function useArrayHistory(
  source: Ref<Record<string, any>[]>,
  options: UseArrayHistoryOptions = {}
): UseArrayHistoryResult {
  const history = ref<Record<string, any>[][]>([]);
  const historyIndex = ref(-1);

  const maxSize = options.maxSize ?? 50;
  const debounceMs = options.debounce ?? 200;

  // 标志位：当前是否处于恢复历史过程，防止形成循环保存
  let isRestoring = false;
  let saveTimer: number | null = null;

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.value.length - 1);

  const cloneList = (list: Record<string, any>[]): Record<string, any>[] =>
    (list || []).map((item) => ({ ...(item as any) }));

  const saveSnapshot = () => {
    if (isRestoring) return;
    if (options.ignoreRef?.value) return;

    const current = cloneList(source.value || []);

    // 第一次保存：初始化历史
    if (historyIndex.value === -1 || history.value.length === 0) {
      history.value = [current];
      historyIndex.value = 0;
      return;
    }

    // 如果当前内容和最近一次快照完全一致，则不保存
    const last = history.value[historyIndex.value];
    if (last && JSON.stringify(last) === JSON.stringify(current)) {
      return;
    }

    // 移除当前索引之后的所有历史记录（分支）
    history.value = history.value.slice(0, historyIndex.value + 1);

    // 添加新的快照
    history.value.push(current);

    // 限制历史记录大小
    if (history.value.length > maxSize) {
      history.value.shift();
    } else {
      historyIndex.value++;
    }
  };

  const saveSnapshotDebounced = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveSnapshot();
    }, debounceMs);
  };

  const undo = () => {
    if (!canUndo.value) return;
    historyIndex.value--;
    const snapshot = history.value[historyIndex.value];
    if (!snapshot) return;

    isRestoring = true;
    source.value = cloneList(snapshot) as any;
    // 下一轮事件循环再允许保存，避免本次赋值触发保存
    setTimeout(() => {
      isRestoring = false;
    }, 0);
  };

  const redo = () => {
    if (!canRedo.value) return;
    historyIndex.value++;
    const snapshot = history.value[historyIndex.value];
    if (!snapshot) return;

    isRestoring = true;
    source.value = cloneList(snapshot) as any;
    setTimeout(() => {
      isRestoring = false;
    }, 0);
  };

  const stopWatch = watch(
    source,
    () => {
      saveSnapshotDebounced();
    },
    { deep: false }
  );

  const dispose = () => {
    stopWatch();
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    history.value = [];
    historyIndex.value = -1;
  };

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    dispose,
  };
}
