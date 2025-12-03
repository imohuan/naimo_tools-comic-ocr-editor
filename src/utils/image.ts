export const getImageDimensions = (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
      URL.revokeObjectURL(objectUrl);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error ?? new Error("图片尺寸读取失败"));
    };

    img.src = objectUrl;
  });
};

/**
 * 将 overlayImageUrl 指定的图片绘制到 baseImageUrl 指定的图片上
 * @param baseImageUrl 底图 URL
 * @param overlayImageUrl 覆盖图 URL
 * @param x 覆盖位置 x
 * @param y 覆盖位置 y
 * @param width 覆盖宽度
 * @param height 覆盖高度
 * @returns 合成后的图片 Blob URL
 */
export const compositeImages = (
  baseImageUrl: string,
  overlayImageUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    const overlayImg = new Image();

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        draw();
      }
    };

    baseImg.onload = checkLoaded;
    baseImg.onerror = () => reject(new Error("底图加载失败"));

    overlayImg.onload = checkLoaded;
    overlayImg.onerror = () => reject(new Error("覆盖图加载失败"));

    baseImg.crossOrigin = "anonymous";
    overlayImg.crossOrigin = "anonymous";

    baseImg.src = baseImageUrl;
    overlayImg.src = overlayImageUrl;

    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth || baseImg.width;
      canvas.height = baseImg.naturalHeight || baseImg.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建画布上下文"));
        return;
      }

      // 绘制底图
      ctx.drawImage(baseImg, 0, 0);

      // 绘制覆盖图
      ctx.drawImage(overlayImg, x, y, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("图片合成失败"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, "image/png");
    };
  });
};
