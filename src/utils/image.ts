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
