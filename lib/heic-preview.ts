export function isHeicFile(fileName: string, mimeType = "") {
  return /image\/(heic|heif)/i.test(mimeType) || /\.(heic|heif)$/i.test(fileName);
}

export async function createBrowserPreviewUrl(url: string, fileName: string, mimeType: string) {
  if (!isHeicFile(fileName, mimeType)) return { url, revoke: false };

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${fileName} for preview.`);
  const source = await response.blob();
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({ blob: source, toType: "image/jpeg", quality: 0.9 });
  const preview = Array.isArray(converted) ? converted[0] : converted;
  return { url: URL.createObjectURL(preview), revoke: true };
}
