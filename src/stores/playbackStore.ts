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

    const lazyItems: SequencePlaybackItem[] = [];

    const createLazyItem = (
      image: ImageItem,
      detail?: OcrTextDetail
    ): SequencePlaybackItem => {
      const base: SequencePlaybackItem & {
        __loaded?: boolean;
        __loading?: Promise<void> | null;
        __lazyLoad?: () => Promise<void>;
      } = {
        image: "",
        audio: detail?.audioUrl || "",
        text: detail ? detail.translatedText || detail.text || "" : "",
        rect: detail
          ? {
            minX: detail.minX,
            minY: detail.minY,
            maxX: detail.maxX,
            maxY: detail.maxY,
          }
          : null,
        imageWidth: 0,
        imageHeight: 0,
        duration: detail?.audioDuration ?? (detail ? null : silentDuration),
      };

      const load = async () => {
        if (base.__loaded) return;
        if (base.__loading) {
          await base.__loading;
          return;
        }

        base.__loading = (async () => {
          await ocrStore.ensureAudioUrls(image);
          const { src, width, height } = await resolveImageMeta(image);
          base.image = src;
          base.imageWidth = width;
          base.imageHeight = height;
          if (!base.audio) {
            // 对无音频的文本使用静音补位
            base.audio = detail?.audioUrl || silentAudioUrl;
            base.duration = detail?.audioDuration ?? silentDuration;
          }
          base.__loaded = true;
        })();

        await base.__loading;
        base.__loading = null;
      };

      base.__lazyLoad = load;
      return base;
    };

    images.forEach((image) => {
      if (!image.ocrResult || !image.ocrResult.details?.length) {
        lazyItems.push(createLazyItem(image));
        return;
      }

      image.ocrResult.details.forEach((detail) => {
        lazyItems.push(createLazyItem(image, detail));
      });
    });

    // 仅预加载前几个，剩余的在播放器内按需加载
    const preloadList = lazyItems.slice(0, PRELOAD_BATCH_SIZE);
    await Promise.all(preloadList.map((item: any) => item.__lazyLoad?.()));

    return lazyItems;
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

