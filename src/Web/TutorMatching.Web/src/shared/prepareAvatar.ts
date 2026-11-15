export const MAX_AVATAR_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_DATA_LENGTH = 1_800_000;

// Store an avatar-sized image instead of the original full-resolution photo.
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).');
  if (file.size > MAX_AVATAR_FILE_BYTES) throw new Error('Choose an image up to 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('This image could not be opened. Try a JPG, PNG or WebP image.'); }
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare the image. Try again.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/webp', 0.85);
    if (result.length > MAX_AVATAR_DATA_LENGTH) result = canvas.toDataURL('image/jpeg', 0.7);
    if (result.length > MAX_AVATAR_DATA_LENGTH) throw new Error('This image could not be reduced enough. Try a different image.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
