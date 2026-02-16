/**
 * Inserts Cloudinary transformation parameters into a Cloudinary URL
 * to fetch a resized avatar instead of the full-resolution original.
 *
 * - c_fill: crop to fill the target dimensions, maintaining aspect ratio
 * - g_face: auto-detect and center on faces
 * - f_auto: serve the best format for the browser (WebP, AVIF, etc.)
 * - q_auto: let Cloudinary choose optimal quality
 * - Size is doubled for retina (2x) displays
 *
 * If the URL is not a Cloudinary URL, it is returned unchanged.
 */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  displaySize: number
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("/upload/")) return url;

  const retinaSize = displaySize * 2;
  return url.replace(
    "/upload/",
    `/upload/w_${retinaSize},h_${retinaSize},c_fill,g_face,f_auto,q_auto/`
  );
}
