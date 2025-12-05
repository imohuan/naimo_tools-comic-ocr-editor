import { ref, type Ref } from 'vue';
import { useDebounceFn, watchDebounced } from '@vueuse/core';
import { useNaimoStore } from '../stores/naimoStore';
import { isFunction } from 'lodash-es';

/**
 * 通用的 JSON 存储 composable
 * 类似于 vueuse 的 useLocalStorage，但保存到文件系统
 * 
 * @param jsonPath JSON 文件路径（文件夹路径，会保存为 config.json）
 * @param dataRef 要保存的数据 ref
 * @param options 配置选项
 * @returns 存储控制对象
 */
export function useStoreToJSON<T = any>(
  jsonPath: Ref<string | null>,
  dataRef: Ref<T>,
  options: {
    watchEffect?: (data: Ref<T>) => any
    debounce?: number; // 防抖延迟，默认 500ms
    immediate?: boolean; // 是否立即读取，默认 true
    onRead?: (data: T | null) => void; // 读取完成回调
    onWrite?: (success: boolean) => void; // 写入完成回调
    serializer?: (data: T) => any; // 序列化函数，将数据转换为保存格式
    deserializer?: (data: any) => T | Promise<T>; // 反序列化函数，将读取的数据转换为目标格式（支持异步）
  } = {}
) {
  const {
    debounce: debounceDelay = 500,
    immediate = true,
    onRead,
    onWrite,
    serializer,
    deserializer,
  } = options;

  const naimoStore = useNaimoStore();
  const isSaving = ref(false);
  const isLoading = ref(false);
  const lastSaveTime = ref<Date | null>(null);
  const lastLoadTime = ref<Date | null>(null);
  const error = ref<string | null>(null);

  /**
   * 读取 JSON 文件
   */
  const read = async (): Promise<T | null> => {
    if (!jsonPath.value || !naimoStore.isAvailable) {
      return null;
    }

    try {
      isLoading.value = true;
      error.value = null;

      const api = window.myPluginAPI;
      if (!api) {
        throw new Error('API 不可用');
      }

      const config = await api.readConfig(jsonPath.value);
      lastLoadTime.value = new Date();

      if (config) {
        const data = deserializer ? await deserializer(config) : (config as T);
        if (onRead) {
          onRead(data);
        }
        return data;
      } else if (deserializer) {
        const data = await deserializer(config)
        if (onRead) {
          onRead(data);
        }
        return data
      }


      return null;
    } catch (err: any) {
      const errorMsg = err.message || '读取文件失败';
      error.value = errorMsg;
      console.error('[useStoreToJSON.read]', errorMsg, err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 写入 JSON 文件
   */
  const write = async (data?: T): Promise<boolean> => {
    if (!jsonPath.value || !naimoStore.isAvailable) {
      return false;
    }

    try {
      isSaving.value = true;
      error.value = null;

      const api = (window as any).myPluginAPI;
      if (!api) {
        throw new Error('API 不可用');
      }

      const dataToSave = data !== undefined ? data : dataRef.value;
      const serializedData = serializer ? serializer(dataToSave) : dataToSave;

      const success = await api.writeConfig(jsonPath.value, serializedData);

      if (success) {
        lastSaveTime.value = new Date();
        if (onWrite) {
          onWrite(true);
        }
      } else {
        throw new Error('写入失败');
      }

      return success;
    } catch (err: any) {
      const errorMsg = err.message || '写入文件失败';
      error.value = errorMsg;
      console.error('[useStoreToJSON.write]', errorMsg, err);
      if (onWrite) {
        onWrite(false);
      }
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * 防抖保存函数（使用 vueuse 的 useDebounceFn）
   */
  const saveDebounced = useDebounceFn(() => {
    if (!jsonPath.value || !naimoStore.isAvailable) {
      return;
    }
    write();
  }, debounceDelay);

  /**
   * 监听数据变化并自动保存（使用 vueuse 的 watchDebounced）
   * watchDebounced 返回一个停止监听的函数
   */
  let watchStopHandle: (() => void) | null = null;

  /**
   * 开始监听数据变化并自动保存
   */
  const startWatching = () => {
    if (watchStopHandle) {
      return; // 已经在监听
    }
    watchStopHandle = watchDebounced(
      () => isFunction(options.watchEffect) ? options.watchEffect(dataRef) : dataRef,
      () => {
        if (!jsonPath.value || !naimoStore.isAvailable) {
          return;
        }
        write();
      },
      {
        debounce: debounceDelay,
        deep: true,
      }
    );
  };

  /**
   * 停止监听
   */
  const stopWatching = () => {
    if (watchStopHandle) {
      watchStopHandle();
      watchStopHandle = null;
    }
  };

  /**
   * 初始化：读取数据并开始监听
   */
  const init = async (_immediate: boolean = immediate) => {
    if (_immediate) {
      const data = await read();
      if (data !== null) {
        // 使用 lodash-es 的 merge 合并读取的数据到 dataRef
        // const result = merge({}, dataRef.value, data) as T;
        dataRef.value = data
      }
    }
    startWatching();
  };

  return {
    // 状态
    isSaving,
    isLoading,
    lastSaveTime,
    lastLoadTime,
    error,

    // 方法
    read,
    write,
    startWatching,
    stopWatching,
    saveDebounced,
    init,
  };
}

