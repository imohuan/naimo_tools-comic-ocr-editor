/// <reference path="../typings/naimo.d.ts" />

import "./style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import App from "./App.vue";
import { useOcrConfigStore } from "./stores/configStore";

// ==================== 热重载 ====================
if (import.meta.hot) {
  import.meta.hot.on("preload-changed", async (data) => {
    console.log("📝 检测到 preload 变化:", data);
    try {
      const response = await fetch("/__preload_build");
      const result = await response.json();
      if (result.success) {
        console.log("✅ Preload 构建完成");
        await window.naimo.hot();
        console.log("🔄 Preload 热重载完成");
        location.reload();
      } else {
        console.error("❌ Preload 构建失败");
      }
    } catch (error) {
      console.error("❌ 触发 preload 构建失败:", error);
    }
  });
}

// ==================== 应用初始化 ====================

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(naive);

// 提前加载 OCR 配置，并同步音频并发等运行参数
const configStore = useOcrConfigStore(pinia);
configStore.loadConfig().finally(() => {
  app.mount("#app");
});
