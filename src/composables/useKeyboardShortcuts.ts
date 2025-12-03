type ShortcutHandler = () => void;

const shortcuts = new Map<string, ShortcutHandler>();

const normalizeKey = (key: string): string => {
  return key.toLowerCase().replace(/\s+/g, "");
};

const parseShortcut = (
  shortcut: string
): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} => {
  const parts = shortcut.toLowerCase().split("+");
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;
  let key = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "ctrl" || trimmed === "control") {
      ctrl = true;
    } else if (trimmed === "shift") {
      shift = true;
    } else if (trimmed === "alt") {
      alt = true;
    } else if (trimmed === "meta" || trimmed === "cmd") {
      meta = true;
    } else {
      key = trimmed;
    }
  }

  return { ctrl, shift, alt, meta, key };
};

const handleKeyDown = (event: KeyboardEvent) => {
  // 忽略在输入框中的快捷键
  const target = event.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  const key = event.key.toLowerCase();

  // 遍历所有注册的快捷键
  for (const [shortcut, handler] of shortcuts.entries()) {
    const parsed = parseShortcut(shortcut);
    const normalizedKey = normalizeKey(parsed.key);

    // 处理特殊键
    let keyMatch = false;
    if (normalizedKey === "=" || normalizedKey === "+") {
      keyMatch = key === "=" || key === "+";
    } else if (normalizedKey === "-" || normalizedKey === "_") {
      keyMatch = key === "-" || key === "_";
    } else if (normalizedKey === "delete") {
      keyMatch = key === "delete";
    } else if (normalizedKey === "backspace") {
      keyMatch = key === "backspace";
    } else if (normalizedKey === "0") {
      keyMatch = key === "0";
    } else if (normalizedKey === "o") {
      keyMatch = key === "o";
    } else if (normalizedKey === ",") {
      keyMatch = key === ",";
    } else if (normalizedKey === "r") {
      keyMatch = key === "r";
    } else if (normalizedKey === "q") {
      keyMatch = key === "q";
    } else if (normalizedKey === "x") {
      keyMatch = key === "x";
    } else if (normalizedKey === "s") {
      keyMatch = key === "s";
    } else {
      keyMatch = key === normalizedKey;
    }

    if (!keyMatch) continue;

    // 检查修饰键
    const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

    // 如果快捷键需要 Ctrl，则检查 Ctrl 或 Cmd（Mac）
    // 如果快捷键不需要 Ctrl（单键），则确保没有修饰键被按下
    let ctrlMatch: boolean;
    if (parsed.ctrl) {
      ctrlMatch = hasCtrlOrMeta;
    } else {
      // 单键快捷键：确保没有修饰键
      ctrlMatch = !hasCtrlOrMeta && !event.shiftKey && !event.altKey;
    }

    const shiftMatch = parsed.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = parsed.alt ? event.altKey : !event.altKey;

    if (ctrlMatch && shiftMatch && altMatch) {
      event.preventDefault();
      handler();
      break;
    }
  }
};

let isListenerAttached = false;

const attachListener = () => {
  if (!isListenerAttached) {
    window.addEventListener("keydown", handleKeyDown);
    isListenerAttached = true;
  }
};

const detachListener = () => {
  if (isListenerAttached && shortcuts.size === 0) {
    window.removeEventListener("keydown", handleKeyDown);
    isListenerAttached = false;
  }
};

export const useKeyboardShortcuts = () => {
  const registerShortcut = (shortcut: string, handler: ShortcutHandler) => {
    if (!shortcut || shortcut.trim() === "") {
      return; // 忽略空字符串
    }
    const normalized = normalizeKey(shortcut);
    shortcuts.set(normalized, handler);
    attachListener();
  };

  const unregisterShortcut = (shortcut: string) => {
    if (!shortcut || shortcut.trim() === "") {
      return; // 忽略空字符串
    }
    const normalized = normalizeKey(shortcut);
    shortcuts.delete(normalized);
    detachListener();
  };

  return {
    registerShortcut,
    unregisterShortcut,
  };
};
