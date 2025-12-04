export type MergeProgressFn = (message: string) => void;

export interface MergeAudioOptions {
  /** 进度回调，便于在 UI 中展示状态 */
  onProgress?: MergeProgressFn;
  /** 复用已存在的 AudioContext，避免重复创建 */
  audioContext?: AudioContext;
  /** 输出通道数，默认 2（双声道） */
  outputChannels?: number;
}

/**
 * 将 AudioBuffer 转换为 WAV Blob
 * 完全参考 `audio.js` 中的实现
 */
export const bufferToWave = (abuffer: AudioBuffer, len: number): Blob => {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels: Float32Array[] = [];
  let i: number;
  let sample: number;
  let offset = 0;
  let pos = 0;

  // 写入 WAV 头部
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // 写入交错数据 (Interleaved PCM)
  for (i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < len) {
    for (i = 0; i < numOfChan; i++) {
      // clamp float32 to int16 range
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // convert to 16-bit signed integer
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

/**
 * 合并多个音频文件为一个 WAV Blob
 * 流程完全参考 `audio.js` 中的 `mergeAudio`，去掉了 React 相关逻辑
 */
export const mergeAudioFiles = async (
  files: File[],
  options: MergeAudioOptions = {}
): Promise<{ blob: Blob; durations: number[] }> => {
  if (!files || files.length === 0) {
    throw new Error("音频文件列表为空");
  }

  const { onProgress, audioContext, outputChannels = 2 } = options;

  // 初始化 / 复用 AudioContext
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("当前环境不支持 Web Audio API");
  }

  const ctx = audioContext ?? new AudioCtx();
  const createdContext = !audioContext;

  try {
    const audioBuffers: AudioBuffer[] = [];
    const durations: number[] = [];

    // 1. 解码所有文件
    for (let i = 0; i < files.length; i++) {
      onProgress?.(`正在解码第 ${i + 1} / ${files.length} 个文件...`);
      const arrayBuffer = await files[i].arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffers.push(decodedBuffer);
      durations.push(decodedBuffer.duration);
    }

    onProgress?.("正在合并音频数据...");

    // 2. 计算总长度
    let totalLength = 0;
    audioBuffers.forEach((buf) => (totalLength += buf.length));

    // 3. 创建输出 Buffer
    const outputBuffer = ctx.createBuffer(
      outputChannels,
      totalLength,
      ctx.sampleRate
    );

    // 4. 将数据拷贝到输出 Buffer (拼接)
    let offset = 0;
    audioBuffers.forEach((buf) => {
      for (let channel = 0; channel < outputChannels; channel++) {
        // 获取输出通道的数据引用
        const outputData = outputBuffer.getChannelData(channel);

        // 如果源文件通道少于当前需要的通道 (例如单声道源 -> 双声道输出)
        // 我们复用单声道数据。如果源文件有多通道，直接对应。
        const inputData = buf.getChannelData(
          channel < buf.numberOfChannels ? channel : 0
        );

        // 高效拷贝
        outputData.set(inputData, offset);
      }
      offset += buf.length;
    });

    onProgress?.("正在封装为 WAV 文件...");

    // 5. 编码为 WAV Blob
    const wavBlob = bufferToWave(outputBuffer, totalLength);
    onProgress?.("完成！");
    return { blob: wavBlob, durations };
  } catch (error: any) {
    onProgress?.("处理出错: " + (error?.message ?? "未知错误"));
    throw error;
  } finally {
    // 如果是内部新建的 AudioContext，使用后关闭以释放资源
    if (createdContext) {
      ctx.close().catch(() => {
        // 忽略关闭失败
      });
    }
  }
};
