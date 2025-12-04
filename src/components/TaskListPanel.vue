<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-2 text-xs text-gray-500">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-700">任务列表</span>
          <span class="text-gray-400">
            共 {{ tasks.length }} 个，进行中 {{ runningCount }} 个，等待
            {{ pendingCount }} 个
          </span>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model.trim="keyword"
            type="text"
            placeholder="输入关键字搜索"
            class="px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            class="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            :disabled="tasks.length === runningCount"
            @click="handleClear"
          >
            清空列表
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-for="kindOption in kindFilters"
          :key="kindOption.value"
          class="px-2 py-0.5 rounded border text-xs"
          :class="
            filterKind === kindOption.value
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          "
          @click="filterKind = kindOption.value"
        >
          {{ kindOption.label }}
        </button>
      </div>
    </div>

    <div
      v-if="filteredTasks.length === 0"
      class="py-10 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded"
    >
      暂无对应任务
    </div>

    <div
      v-else
      class="max-h-[420px] overflow-y-auto border border-gray-100 rounded-md divide-y divide-gray-100 bg-white"
    >
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="px-3 py-2 flex items-center justify-between text-xs gap-3"
      >
        <div class="flex-1 flex flex-col gap-0.5 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium"
              :class="
                task.kind === 'ocr'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-indigo-50 text-indigo-600'
              "
            >
              {{ task.kind === "ocr" ? "OCR" : "音频" }}
            </span>
            <span class="text-gray-700 truncate flex-1">
              {{ task.label }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-gray-400">
            <span>状态：{{ statusText(task.status) }}</span>
            <span v-if="task.errorMessage" class="text-red-500">
              {{ task.errorMessage }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <span
            v-if="task.status === 'running' || task.status === 'pending'"
            class="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"
          />
          <span class="text-[11px] text-gray-400 min-w-[60px] text-right">
            {{ formatTime(task.createdAt) }}
          </span>
          <div class="flex items-center gap-1">
            <button
              v-if="task.status === 'pending'"
              class="px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
              type="button"
              @click="handleRemove(task.id)"
            >
              删除
            </button>
            <button
              v-else-if="task.status === 'running'"
              class="px-2 py-0.5 rounded border text-gray-600"
              :class="
                task.kind === 'audio'
                  ? 'border-red-300 hover:bg-red-50'
                  : 'border-gray-200 cursor-not-allowed opacity-60'
              "
              type="button"
              :disabled="task.kind !== 'audio'"
              @click="task.kind === 'audio' && handleStop(task.id)"
            >
              {{ task.kind === "audio" ? "停止" : "无法停止" }}
            </button>
            <button
              v-else
              class="px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
              type="button"
              @click="handleRemove(task.id)"
            >
              移除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useTaskStore } from "../stores/taskStore";
import type { TaskKind } from "../stores/taskStore";

const taskStore = useTaskStore();
const { tasks } = storeToRefs(taskStore);

const runningCount = computed(
  () => tasks.value.filter((task) => task.status === "running").length
);
const pendingCount = computed(
  () => tasks.value.filter((task) => task.status === "pending").length
);

const filterKind = ref<"all" | TaskKind>("all");
const keyword = ref("");

const kindFilters = [
  { label: "全部", value: "all" as const },
  { label: "仅 OCR", value: "ocr" as TaskKind },
  { label: "仅音频", value: "audio" as TaskKind },
];

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    const matchKind =
      filterKind.value === "all" || task.kind === filterKind.value;
    const matchKeyword = keyword.value
      ? task.label.toLowerCase().includes(keyword.value.toLowerCase())
      : true;
    return matchKind && matchKeyword;
  });
});

const statusText = (status: string) => {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "进行中";
    case "success":
      return "已完成";
    case "error":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
};

const formatTime = (timestamp: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const h = `${date.getHours()}`.padStart(2, "0");
  const m = `${date.getMinutes()}`.padStart(2, "0");
  const s = `${date.getSeconds()}`.padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const handleRemove = (taskId: string) => {
  taskStore.removeTaskRecord(taskId);
};

const handleStop = (taskId: string) => {
  taskStore.stopTask(taskId);
};

const handleClear = () => {
  taskStore.clearTasks();
};
</script>

<style scoped></style>
