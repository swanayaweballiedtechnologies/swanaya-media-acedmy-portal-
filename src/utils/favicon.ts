const DEFAULT_FAVICON = '/favicon.svg';

function isSafeImageSrc(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function applyDocumentFavicon(faviconUrl?: string | null) {
  if (typeof document === 'undefined') return;
  const href = faviconUrl && isSafeImageSrc(faviconUrl) ? faviconUrl.trim() : DEFAULT_FAVICON;

  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
  ];

  let updatedAny = false;
  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLLinkElement>(selector).forEach((link) => {
      link.href = href;
      if (href.endsWith('.svg') || href.startsWith('data:image/svg+xml')) {
        link.type = 'image/svg+xml';
      } else if (href.startsWith('data:image/png') || href.endsWith('.png')) {
        link.type = 'image/png';
      } else {
        link.removeAttribute('type');
      }
      updatedAny = true;
    });
  });

  if (!updatedAny) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    document.head.appendChild(link);
  }
}

export async function processLogoUploadFile(
  file: File,
  maxDimension: number
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, SVG, or ICO).');
  }

  // Keep SVG/ICO directly if reasonably small
  if (file.type === 'image/svg+xml' || file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') {
    if (file.size > 150 * 1024) {
      throw new Error('SVG/ICO files must be under 150 KB.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    });
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image file must be under 5 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(16, Math.round((img.width || maxDimension) * scale));
        const height = Math.max(16, Math.round((img.height || maxDimension) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/png');
        if (compressed.length > 220000) {
          resolve(canvas.toDataURL('image/webp', 0.85));
        } else {
          resolve(compressed);
        }
      };
      img.onerror = () => reject(new Error('Unable to decode image file.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}
