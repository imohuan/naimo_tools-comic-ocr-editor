import { ref } from "vue";
import { EdgeTTS, VoicesManager } from "edge-tts-universal";

export interface VoiceRoleOption {
  label: string;
  value: string;
}

// 常用中文播音人自定义名称映射（ShortName -> 中文名称）
const zhVoiceNameMap: Record<string, string> = {
  // 女声
  "zh-CN-XiaoxiaoNeural": "晓晓（女）",
  "zh-CN-XiaomeiNeural": "晓梅（女）",
  "zh-CN-XiaoyiNeural": "晓伊（女）",
  // 男声
  "zh-CN-YunhaoNeural": "云皓（男）",
  "zh-CN-YunfengNeural": "云枫（男）",
  "zh-CN-YunjianNeural": "云健（男）",
  "zh-CN-YunxiNeural": "云希（男）",
  "zh-CN-YunxiaNeural": "云夏（男）",
  "zh-CN-YunyangNeural": "云扬（男）",
};

// 文本转语音 Hook：在前端调用 Edge TTS 生成音频 URL（不自动播放），并提供播音人列表
export const useEdgeTts = () => {
  const loading = ref(false);
  const lastAudioUrl = ref<string | null>(null);
  const errorMessage = ref<string | null>(null);

  // 播音人选项（默认提供几个人声，避免网络失败时无数据）
  const voiceRoleOptions = ref<VoiceRoleOption[]>([
    { label: "自动选择", value: "" },
    {
      label: zhVoiceNameMap["zh-CN-XiaoxiaoNeural"],
      value: "zh-CN-XiaoxiaoNeural",
    },
    {
      label: zhVoiceNameMap["zh-CN-XiaomeiNeural"],
      value: "zh-CN-XiaomeiNeural",
    },
    {
      label: zhVoiceNameMap["zh-CN-YunhaoNeural"],
      value: "zh-CN-YunhaoNeural",
    },
    {
      label: zhVoiceNameMap["zh-CN-YunfengNeural"],
      value: "zh-CN-YunfengNeural",
    },
  ]);

  const voicesLoading = ref(false);

  // 从 edge-tts-universal 动态加载可用的中文播音人列表
  const loadVoiceRoleOptions = async () => {
    if (voicesLoading.value) return;
    voicesLoading.value = true;

    try {
      const manager = await VoicesManager.create();
      // 只取简体中文（Locale 为 zh-CN）的播音人，列表结构参考 edge.json
      const zhCnVoices = manager.find({ Locale: "zh-CN" });

      if (Array.isArray(zhCnVoices) && zhCnVoices.length > 0) {
        console.log({ zhCnVoices });

        voiceRoleOptions.value = [
          { label: "自动选择", value: "" },
          ...zhCnVoices.map((v) => {
            const shortName = (v.ShortName || "").trim();
            const mappedName =
              (shortName && zhVoiceNameMap[shortName]) ||
              v.FriendlyName ||
              shortName;

            return {
              label: mappedName,
              value: shortName,
            };
          }),
        ];
      }
    } catch (error) {
      // 加载失败时保持默认列表即可
      console.error("加载播音人列表失败:", error);
    } finally {
      voicesLoading.value = false;
    }
  };

  const revokeLastUrl = () => {
    if (lastAudioUrl.value) {
      URL.revokeObjectURL(lastAudioUrl.value);
      lastAudioUrl.value = null;
    }
  };

  /**
   * 生成音频并返回可播放的 URL（不主动播放）
   * @param text 文本内容
   * @param voice 语音角色（如 zh-CN-XiaoxiaoNeural）
   */
  const generateAudioUrl = async (text: string, voice?: string) => {
    const content = text?.trim();
    if (!content) return;

    loading.value = true;
    errorMessage.value = null;

    try {
      const tts = new EdgeTTS(
        content,
        voice && voice.trim() ? voice.trim() : "zh-CN-XiaoxiaoNeural"
      );

      // Simple API：synthesize 返回 { audio: Blob, subtitle: WordBoundary[] }
      const result = await tts.synthesize();
      const audioBlob = result.audio;

      revokeLastUrl();
      const audioUrl = URL.createObjectURL(audioBlob);
      lastAudioUrl.value = audioUrl;
      return audioUrl;
    } catch (error: any) {
      console.error("生成音频失败:", error);
      errorMessage.value =
        typeof error?.message === "string" ? error.message : "生成音频失败";
      // 将错误抛给调用方，便于外部更新状态
      throw error;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    audioUrl: lastAudioUrl,
    errorMessage,
    generateAudioUrl,
    voiceRoleOptions,
    voicesLoading,
    loadVoiceRoleOptions,
  };
};
