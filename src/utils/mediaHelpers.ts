export interface ParsedVideoSource {
  kind: 'youtube' | 'vimeo' | 'direct';
  src: string;
}

export function parseFrontPageVideoUrl(rawUrl?: string | null): ParsedVideoSource | null {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  // Allow local data:video/* uploads or direct relative/https video files
  if (url.startsWith('data:video/')) {
    return { kind: 'direct', src: url };
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        return { kind: 'youtube', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` };
      }
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return { kind: 'youtube', src: parsed.toString() };
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) {
          return { kind: 'youtube', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` };
        }
      }
      const v = parsed.searchParams.get('v');
      if (v) {
        return { kind: 'youtube', src: `https://www.youtube.com/embed/${encodeURIComponent(v)}?rel=0` };
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
      }
    }

    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || url.startsWith('/')) {
      return { kind: 'direct', src: url };
    }
  } catch {
    if (url.startsWith('/')) {
      return { kind: 'direct', src: url };
    }
  }

  return null;
}

export async function processPosterUploadFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, WebP, or SVG) for the poster.');
  }

  if (file.type === 'image/svg+xml') {
    if (file.size > 160 * 1024) {
      throw new Error('SVG poster files must be under 160 KB.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read SVG poster file.'));
      reader.readAsDataURL(file);
    });
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Poster image file must be under 10 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(120, Math.round((img.width || maxDim) * scale));
        const height = Math.max(120, Math.round((img.height || maxDim) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let output = canvas.toDataURL('image/webp', quality);
        while (output.length > 165000 && quality > 0.45) {
          quality -= 0.1;
          output = canvas.toDataURL('image/jpeg', quality);
        }
        if (output.length > 220000) {
          reject(new Error('Poster image is still too large after compression. Try a smaller image or paste an image URL.'));
          return;
        }
        resolve(output);
      };
      img.onerror = () => reject(new Error('Unable to decode poster image file.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read selected poster image.'));
    reader.readAsDataURL(file);
  });
}

export async function readSmallVideoFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Please choose a valid video file (MP4, WebM, or MOV).');
  }
  if (file.size > 420 * 1024) {
    throw new Error(
      'Uploaded video exceeds the 420 KB inline limit. For larger videos, paste a YouTube, Vimeo, or hosted MP4 link.'
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected video file.'));
    reader.readAsDataURL(file);
  });
}

export const MAX_FACE_IMAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function formatMediaBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isLikelyImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|avif|bmp|svg|ico)$/i.test(file.name);
}

/**
 * Optimizes a face portrait up to 2 GB via ObjectURL -> Canvas so even very large
 * camera/DSLR images do not exhaust browser memory before saving to profile storage.
 */
export async function optimizeFaceImageForProfile(
  file: File,
  focalY: 'top' | 'center' = 'top'
): Promise<string> {
  if (!isLikelyImageFile(file)) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP, GIF, AVIF, or SVG).');
  }
  if (file.size <= 0) {
    throw new Error('The selected image file is empty.');
  }
  if (file.size > MAX_FACE_IMAGE_BYTES) {
    throw new Error(`Image exceeds the 2 GB maximum limit (${formatMediaBytes(file.size)} selected).`);
  }

  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    if (file.size > 180 * 1024) {
      throw new Error('SVG face avatar files must be under 180 KB.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read SVG face image.'));
      reader.readAsDataURL(file);
    });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to decode selected image format in browser.'));
      el.src = objectUrl;
    });

    const targetSize = 512;
    const srcW = Math.max(1, img.naturalWidth || img.width || targetSize);
    const srcH = Math.max(1, img.naturalHeight || img.height || targetSize);
    const squareCrop = Math.min(srcW, srcH);

    // Center horizontally; shift slightly toward top when focalY === 'top' to keep face & forehead framed cleanly
    const sx = Math.max(0, Math.round((srcW - squareCrop) / 2));
    const sy =
      focalY === 'top'
        ? Math.max(0, Math.round((srcH - squareCrop) * 0.18))
        : Math.max(0, Math.round((srcH - squareCrop) / 2));

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas rendering context is unavailable in this browser.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, squareCrop, squareCrop, 0, 0, targetSize, targetSize);

    let quality = 0.86;
    let output = canvas.toDataURL('image/webp', quality);
    if (!output.startsWith('data:image/webp')) {
      output = canvas.toDataURL('image/jpeg', quality);
    }

    while (output.length > 180000 && quality > 0.45) {
      quality -= 0.1;
      output = canvas.toDataURL('image/jpeg', quality);
    }

    if (output.length > 235000) {
      throw new Error('Face image could not be compressed small enough for database sync. Please try another photo.');
    }

    return output;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
