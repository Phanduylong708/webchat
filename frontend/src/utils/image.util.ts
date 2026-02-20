/**
 * Avatar Size Guide (follow Tailwind's 8px spacing scale for consistency):
 *
 *   Compact  — size-8  (32px): inline/dense contexts (message bubbles, small tiles)
 *   Standard — size-10 (40px): list items (conversations, friends, sidebar triggers)
 *   Featured — size-24 (96px): detail/profile views (profile dialog, friend profile)
 *
 * When adding a new avatar, pick the tier that matches the context.
 * Always pass the CSS display size to getOptimizedAvatarUrl() — it auto-doubles for retina.
 */

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

/**
 * Returns the first two characters of a username, uppercased,
 * for use as an avatar fallback label.
 */
export function getAvatarFallback(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

/**
 * Message Image Optimization
 *
 * DB stores the original Cloudinary URL.
 * Rendering uses a transformed URL for performance:
 *   - "bubble": chat thumbnail — constrained width, auto quality/format/DPR
 *   - "full":   lightbox / detail view — larger, higher quality
 *
 * Non-Cloudinary URLs are returned unchanged.
 *
 * Caveats:
 *   - Assumes the URL has no existing transforms (Phase A returns clean upload URLs).
 *     If the URL already contains transforms, Cloudinary will chain them.
 *   - Signed URLs would be invalidated by transform insertion; not an issue
 *     currently since Phase A uses unsigned secure_url.
 */

type MessageImageMode = "bubble" | "full";

const MESSAGE_IMAGE_TRANSFORMS: Record<MessageImageMode, string> = {
  bubble: "w_400,c_limit,f_auto,q_auto,dpr_auto",
  full: "w_1200,c_limit,f_auto,q_auto,dpr_auto",
};

export function getOptimizedMessageImageUrl(
  url: string,
  mode: MessageImageMode
): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${MESSAGE_IMAGE_TRANSFORMS[mode]}/`);
}
