import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScreenShareRTC } from "@/hooks/rtc/useScreenShareRTC";

// Mock AudioContext for audio mixing tests
const mockConnect = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCreateMediaStreamSource = vi.fn(() => ({ connect: mockConnect }));
const mockDestinationStream = {
  getAudioTracks: () => [{ kind: "audio", label: "MediaStreamAudioDestinationNode", stop: vi.fn() }],
};
const mockCreateMediaStreamDestination = vi.fn(() => ({ stream: mockDestinationStream }));

class MockAudioContext {
  createMediaStreamSource = mockCreateMediaStreamSource;
  createMediaStreamDestination = mockCreateMediaStreamDestination;
  close = mockClose;
}
vi.stubGlobal("AudioContext", MockAudioContext);

// Mock MediaStream constructor
class MockMediaStream {
  private tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
}
vi.stubGlobal("MediaStream", MockMediaStream);

// Helper: create mock track
function createMockTrack(kind: "audio" | "video"): MediaStreamTrack {
  return {
    kind,
    enabled: true,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    label: "",
  } as unknown as MediaStreamTrack;
}

// Helper: create mock stream with tracks
function createMockStream(trackKinds: Array<"audio" | "video">): MediaStream {
  const tracks = trackKinds.map(createMockTrack);
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  } as unknown as MediaStream;
}

describe("useScreenShareRTC", () => {
  let mockSetLocalStream: ReturnType<typeof vi.fn>;
  let mockGetManager: ReturnType<typeof vi.fn>;
  let mockStopScreenShare: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetLocalStream = vi.fn().mockResolvedValue(undefined);
    mockGetManager = vi.fn(() => ({ setLocalStream: mockSetLocalStream }));
    mockStopScreenShare = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Stream Switch (Start)", () => {
    // VALUABLE: Verifies outbound stream contains screen video (core requirement)
    it("outbound stream sent to manager contains screen video track", () => {
      const screenStream = createMockStream(["video"]);
      const screenVideoTrack = screenStream.getVideoTracks()[0];

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream: null,
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      expect(mockSetLocalStream).toHaveBeenCalledTimes(1);
      const outboundStream = mockSetLocalStream.mock.calls[0][0];
      expect(outboundStream.getVideoTracks()).toContain(screenVideoTrack);
    });

    // VALUABLE: Verifies mic audio is included when available (user expectation)
    it("outbound stream includes audio when userStream has mic", () => {
      const userStream = createMockStream(["audio"]);
      const screenStream = createMockStream(["video"]);

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream,
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      // AudioContext should be created for mixing (verify via method call)
      expect(mockCreateMediaStreamSource).toHaveBeenCalled();
    });
  });

  describe("Stream Restore (Stop)", () => {
    // VALUABLE: Verifies camera is restored after screen share ends (spec requirement)
    it("restores userStream when screenStream becomes null", () => {
      const userStream = createMockStream(["video", "audio"]);

      const { rerender } = renderHook(
        ({ screenStream }) =>
          useScreenShareRTC({
            getManager: mockGetManager,
            isManagerReady: true,
            userStream,
            screenStream,
            stopScreenShare: mockStopScreenShare,
          }),
        { initialProps: { screenStream: createMockStream(["video"]) } }
      );

      mockSetLocalStream.mockClear();

      // Screen share stops
      rerender({ screenStream: null });

      expect(mockSetLocalStream).toHaveBeenCalledWith(userStream);
    });

    // VALUABLE: Edge case - no camera scenario (spec: "screen share works without active camera")
    it("calls setLocalStream(null) when no userStream to restore", () => {
      const { rerender } = renderHook(
        ({ screenStream }) =>
          useScreenShareRTC({
            getManager: mockGetManager,
            isManagerReady: true,
            userStream: null,
            screenStream,
            stopScreenShare: mockStopScreenShare,
          }),
        { initialProps: { screenStream: createMockStream(["video"]) } }
      );

      mockSetLocalStream.mockClear();

      rerender({ screenStream: null });

      expect(mockSetLocalStream).toHaveBeenCalledWith(null);
    });
  });

  describe("Audio Mixing", () => {
    // VALUABLE: Verifies both audio sources are connected (spec: "mix mic + screen audio")
    it("connects both mic and screen audio to mixer when both present", () => {
      const userStream = createMockStream(["audio"]);
      const screenStream = createMockStream(["video", "audio"]);

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream,
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      // Should create sources for both mic and screen audio
      expect(mockCreateMediaStreamSource).toHaveBeenCalledTimes(2);
      // Both should connect to destination
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    // VALUABLE: Edge case - user unchecked audio box in picker (spec note)
    it("skips screen audio mixing when screen has no audio track", () => {
      const userStream = createMockStream(["audio"]);
      const screenStream = createMockStream(["video"]); // No audio

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream,
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      // Only mic source created
      expect(mockCreateMediaStreamSource).toHaveBeenCalledTimes(1);
    });

    // VALUABLE: Edge case - no mic and no screen audio → video only
    it("outbound stream has video only when no mic and no screen audio", () => {
      const screenStream = createMockStream(["video"]); // No audio

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream: null, // No camera/mic
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      const outboundStream = mockSetLocalStream.mock.calls[0][0];
      expect(outboundStream.getVideoTracks().length).toBe(1);
      expect(outboundStream.getAudioTracks().length).toBe(0);
      // AudioContext should NOT be created when no audio sources
      expect(mockCreateMediaStreamSource).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    // VALUABLE: Resource leak prevention (AudioContext must be closed)
    it("closes AudioContext when screen share stops", () => {
      const userStream = createMockStream(["audio"]);

      const { rerender } = renderHook(
        ({ screenStream }) =>
          useScreenShareRTC({
            getManager: mockGetManager,
            isManagerReady: true,
            userStream,
            screenStream,
            stopScreenShare: mockStopScreenShare,
          }),
        { initialProps: { screenStream: createMockStream(["video"]) } }
      );

      // Stop screen share
      rerender({ screenStream: null });

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("Guards", () => {
    // VALUABLE: Prevents duplicate calls (race condition protection)
    it("track.onended triggers stopScreenShare only once", () => {
      const screenStream = createMockStream(["video"]);
      const screenVideoTrack = screenStream.getVideoTracks()[0];

      let capturedEndHandler: () => void;
      (screenVideoTrack.addEventListener as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, handler: () => void) => {
          if (event === "ended") capturedEndHandler = handler;
        }
      );

      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: true,
          userStream: null,
          screenStream,
          stopScreenShare: mockStopScreenShare,
        })
      );

      // Simulate browser "Stop sharing" button
      capturedEndHandler!();
      capturedEndHandler!(); // Second call should be ignored

      expect(mockStopScreenShare).toHaveBeenCalledTimes(1);
    });

    // VALUABLE: Hook should not run when manager not ready
    it("does nothing when isManagerReady is false", () => {
      renderHook(() =>
        useScreenShareRTC({
          getManager: mockGetManager,
          isManagerReady: false,
          userStream: null,
          screenStream: createMockStream(["video"]),
          stopScreenShare: mockStopScreenShare,
        })
      );

      expect(mockSetLocalStream).not.toHaveBeenCalled();
    });

    // VALUABLE: Hook should not run when manager is null
    it("does nothing when getManager returns null", () => {
      renderHook(() =>
        useScreenShareRTC({
          getManager: () => null,
          isManagerReady: true,
          userStream: null,
          screenStream: createMockStream(["video"]),
          stopScreenShare: mockStopScreenShare,
        })
      );

      expect(mockSetLocalStream).not.toHaveBeenCalled();
    });
  });
});
