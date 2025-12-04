import { createDiscreteApi } from "naive-ui";

type NotifyType = "success" | "error" | "warning" | "info";

// 使用 Naive UI 提供的脱离上下文 API
const { notification } = createDiscreteApi(["notification"]);

// 使用 Naive UI 的 Notification 统一封装一个简单的通知 Hook
export function useNotify() {
  const notify = (
    message: string,
    type: NotifyType = "info",
    duration = 3000
  ) => {
    const n = (notification as any)[type] || notification.info;
    n({
      content: message,
      duration,
    });
  };

  const success = (message: string, duration?: number) =>
    notify(message, "success", duration);

  const error = (message: string, duration?: number) =>
    notify(message, "error", duration);

  const warning = (message: string, duration?: number) =>
    notify(message, "warning", duration);

  const info = (message: string, duration?: number) =>
    notify(message, "info", duration);

  return {
    notify,
    success,
    error,
    warning,
    info,
  };
}

