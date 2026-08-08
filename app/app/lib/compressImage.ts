/**
 * Compress an image File to a JPEG under maxSizeKB using canvas.
 * Falls back to the original file if it's not an image or already small.
 */
export async function compressImage(
  file: File,
  maxWidthPx = 1920,
  maxSizeKB = 800,
  quality = 0.82,
  timeoutMs = 8000,
): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  // Already small enough — skip
  if (file.size <= maxSizeKB * 1024) return file;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: File) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      console.warn("[upload-client] compressImage timeout, using original file", { name: file.name, size: file.size, type: file.type, timeoutMs });
      finish(file);
    }, timeoutMs);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale down maintaining aspect ratio
      let { width, height } = img;
      if (width > maxWidthPx) {
        height = Math.round((height * maxWidthPx) / width);
        width = maxWidthPx;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.warn("[upload-client] canvas context unavailable, using original file");
        finish(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { finish(file); return; }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );
          finish(compressed);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn("[upload-client] image decode failed, using original file", { name: file.name, size: file.size, type: file.type });
      finish(file);
    };
    img.src = url;
  });
}
