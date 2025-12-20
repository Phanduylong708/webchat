import { useEffect, useRef } from "react";

interface MediaVideoProps {
  // The MediaStream to render. When null/undefined, the element will clear its srcObject.
  stream?: MediaStream | null;
  // Mute the element (recommended for local/self preview to avoid echo).
  muted?: boolean;
  // Keep playback inline on mobile (prevents full-screen takeover on iOS Safari).
  playsInline?: boolean;
  className?: string;
}
/**
 * MediaVideo
 * A tiny reusable component that safely attaches a MediaStream to a <video> element.
 * - Handles autoplay policies by ignoring play() rejections.
 * - Cleans up srcObject and pauses the element on unmount or when the stream changes.
 * - Stays DOM-only; does not manage stream lifecycle (start/stop) – callers own the stream.
 */
export function MediaVideo({
  stream = null,
  muted = true,
  playsInline = true,
  className,
}: MediaVideoProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    // Type-safe assignment for srcObject (not part of the standard TS lib typings)
    const typedVideo = videoElement as HTMLVideoElement & { srcObject: MediaStream | null };
    // Attach (or clear) the provided MediaStream
    typedVideo.srcObject = stream ?? null;
    // If we have a stream, attempt to play; ignore autoplay policy rejections
    if (stream) {
      const playPromise: Promise<void> | undefined = videoElement.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => {});
      }
    }
    // Cleanup: clear srcObject and pause to avoid lingering media activity
    return () => {
      typedVideo.srcObject = null;
      try {
        videoElement.pause();
      } catch {
        // ignore pause errors (some browsers may throw if not yet playing)
      }
    };
  }, [stream]);
  // Muted + playsInline are important defaults for local/self preview UX
  return <video ref={videoRef} autoPlay muted={muted} playsInline={playsInline} className={className} />;
}
export default MediaVideo;
