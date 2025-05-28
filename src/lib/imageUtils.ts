
"use client";

export async function resizeToDimensions(
  originalFile: File,
  targetWidth: number,
  targetHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (targetWidth <= 0 || targetHeight <= 0) {
      return reject(new Error("Target dimensions must be positive."));
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(img.src); // Clean up before rejecting
        return reject(new Error('Could not get canvas context'));
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(img.src); // Clean up after drawing

      const mimeType = originalFile.type && ['image/jpeg', 'image/png', 'image/webp'].includes(originalFile.type)
        ? originalFile.type
        : 'image/png';
      
      const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas toBlob returned null'));
          }
          resolve(new File([blob], originalFile.name, { type: mimeType, lastModified: Date.now() }));
        },
        mimeType,
        quality
      );
    };
    img.onerror = (errorEvent) => {
      URL.revokeObjectURL(img.src); // Clean up
      const errorMsg = errorEvent instanceof Event ? "Image load failed (generic event)" : errorEvent.toString();
      reject(new Error(`Image loading failed: ${errorMsg}`));
    };
    img.src = URL.createObjectURL(originalFile);
  });
}
