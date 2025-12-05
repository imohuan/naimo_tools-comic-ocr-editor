import { defineStore } from "pinia";
import type { ImageItem, OcrTextDetail } from "../types";
import { useOcrStore } from "./ocrStore";
import { generateSilentAudio } from "../utils/audio";
import { getImageDimensions, getImageDimensionsFromUrl } from "../utils/image";
import type { SequencePlaybackItem } from "../components/AudioSequencePlayer.vue";

type PlaylistScope = "current" | "all";

const PRELOAD_BATCH_SIZE = 3;

export const usePlaybackStore = defineStore("playback-store", () => {
  const ocrStore = useOcrStore();

  const resolveImageMeta = async (image: ImageItem) => {
    await ocrStore.ensureProcessedImageUrl(image);
    await ocrStore.ensureImageUrl(image);
    const src = image.processedImageUrl || image.url;
    if (!src) {
      throw new Error("无法获取当前图片资源");
    }
    const { width, height } = image.file
      ? await getImageDimensions(image.file)
      : await getImageDimensionsFromUrl(src);

    return { src, width, height };
  };

  const buildPlaylistForImages = async (
    images: ImageItem[]
  ): Promise<SequencePlaybackItem[]> => {
    if (!images.length) {
      throw new Error("当前没有可用图片");
    }

    const { blob, duration: silentDuration } = await generateSilentAudio(3);
    const silentAudioUrl = URL.createObjectURL(blob);

    const result: SequencePlaybackItem[] = [];
    const pending: Promise<void>[] = [];

    const buildForImage = async (image: ImageItem) => {
      await ocrStore.ensureAudioUrls(image);
      const { src, width, height } = await resolveImageMeta(image);

      if (!image.ocrResult || !image.ocrResult.details?.length) {
        result.push({
          image: src,
          audio: silentAudioUrl,
          text: "",
          rect: null,
          imageWidth: width,
          imageHeight: height,
          duration: silentDuration,
        });
        return;
      }

      image.ocrResult.details.forEach((detail) => {
        result.push({
          image: src,
          audio: detail.audioUrl || "",
          text: detail.translatedText || detail.text || "",
          rect: {
            minX: detail.minX,
            minY: detail.minY,
            maxX: detail.maxX,
            maxY: detail.maxY,
          },
          imageWidth: width,
          imageHeight: height,
          duration: detail.audioDuration ?? null,
        });
      });
    };

    for (const image of images) {
      pending.push(buildForImage(image));
      if (pending.length >= PRELOAD_BATCH_SIZE) {
        await Promise.all(pending.splice(0, pending.length));
      }
    }
    await Promise.all(pending);

    return result;
  };

  const buildPlaylist = async (scope: PlaylistScope) => {
    if (scope === "current") {
      const current = ocrStore.currentImage;
      if (!current) throw new Error("当前没有可用图片");
      return buildPlaylistForImages([current]);
    }
    return buildPlaylistForImages(ocrStore.images);
  };

  const buildCurrentImagePlaylist = () => buildPlaylist("current");
  const buildGlobalPlaybackPlaylist = () => buildPlaylist("all");

  return {
    buildCurrentImagePlaylist,
    buildGlobalPlaybackPlaylist,
  };
});

