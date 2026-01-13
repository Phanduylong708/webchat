import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MediaProvider } from "@/contexts/mediaProvider";
import { useMedia } from "@/hooks/context/useMedia";
import type { ReactNode } from "react";

// Mock MediaStreamManager
const mockStartScreenShare = vi.fn();
const mockStopScreenShare = vi.fn();
const mockGetUserStream = vi.fn();
const mockDispose = vi.fn();

let capturedCallbacks: {
  onStreamUpdated?: (stream: MediaStream | null, source: "user" | "screen") => void;
  onError?: (error: { code: string; message: string }) => void;
  onTrackEnded?: (kind: "audio" | "video", source: "user" | "screen") => void;
};

vi.mock("@/lib/videocall/mediaStreamManager", () => {
  return {
    MediaStreamManager: class MockMediaStreamManager {
      constructor(config: { callbacks?: typeof capturedCallbacks }) {
        capturedCallbacks = config.callbacks || {};
      }
      startScreenShare = mockStartScreenShare;
      stopScreenShare = mockStopScreenShare;
      getUserStream = mockGetUserStream;
      dispose = mockDispose;
      getSelectedDevices = () => ({});
    },
  };
});

// Mock navigator.mediaDevices to enable MediaProvider initialization
const mockMediaDevices = {
  getUserMedia: vi.fn(),
  getDisplayMedia: vi.fn(),
  enumerateDevices: vi.fn().mockResolvedValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: mockMediaDevices,
  writable: true,
  configurable: true,
});

// Helper: create mock MediaStream
function createMockMediaStream(
  tracks: Array<{ kind: "audio" | "video"; enabled?: boolean }> = []
): MediaStream {
  const mockTracks = tracks.map((t) => ({
    kind: t.kind,
    enabled: t.enabled ?? true,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    label: "",
  }));

  return {
    getTracks: () => mockTracks,
    getVideoTracks: () => mockTracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => mockTracks.filter((t) => t.kind === "audio"),
  } as unknown as MediaStream;
}

// Wrapper for renderHook
function wrapper({ children }: { children: ReactNode }) {
  return <MediaProvider>{children}</MediaProvider>;
}

describe("MediaProvider - Screen Share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallbacks = {};
    mockStartScreenShare.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Start Flow", () => {
    it("startScreenShare calls manager.startScreenShare with correct options", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.startScreenShare();
      });

      expect(mockStartScreenShare).toHaveBeenCalledWith({
        textDetailProfile: true,
        constraints: { audio: true },
      });
    });

    it("screenStream state updates when manager fires onStreamUpdated", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.screenStream).toBeNull();

      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);

      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });

      expect(result.current.screenStream).toBe(mockScreenStream);
    });

    it("videoSource changes to 'screen' when screenStream is set", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.videoSource).toBe("camera");

      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);

      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });

      expect(result.current.videoSource).toBe("screen");
    });
  });

  describe("Stop Flow", () => {
    it("stopScreenShare calls manager.stopScreenShare", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // First start a screen share
      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);
      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });

      // Then stop it
      act(() => {
        result.current.stopScreenShare();
      });

      expect(mockStopScreenShare).toHaveBeenCalled();
    });

    it("screenStream becomes null after stop", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Start screen share
      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);
      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });
      expect(result.current.screenStream).toBe(mockScreenStream);

      // Stop via callback (simulating manager behavior)
      act(() => {
        capturedCallbacks.onStreamUpdated?.(null, "screen");
      });

      expect(result.current.screenStream).toBeNull();
    });

    it("videoSource reverts to 'camera' when screenStream is null", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Start screen share
      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);
      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });
      expect(result.current.videoSource).toBe("screen");

      // Stop screen share
      act(() => {
        capturedCallbacks.onStreamUpdated?.(null, "screen");
      });

      expect(result.current.videoSource).toBe("camera");
    });
  });

  describe("Error Handling", () => {
    it("permission denied sets lastError with code 'permission-denied'", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      const permissionError = {
        code: "permission-denied" as const,
        message: "User denied permission",
      };

      act(() => {
        capturedCallbacks.onError?.(permissionError);
      });

      expect(result.current.lastError?.code).toBe("permission-denied");
    });

    it("startScreenShare when already sharing sets 'unsupported' error", async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Simulate active screen share
      const mockScreenStream = createMockMediaStream([{ kind: "video" }]);
      act(() => {
        capturedCallbacks.onStreamUpdated?.(mockScreenStream, "screen");
      });

      // Try to start again
      await act(async () => {
        await result.current.startScreenShare();
      });

      expect(result.current.lastError?.code).toBe("unsupported");
      expect(result.current.lastError?.message).toContain("already active");
    });
  });

  describe("Busy Guard", () => {
    it("isStartingScreenShare is true during startScreenShare", async () => {
      let resolveStart: () => void;
      const startPromise = new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
      mockStartScreenShare.mockImplementation(() => startPromise);

      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.isStartingScreenShare).toBe(false);

      // Start without awaiting
      let startScreenSharePromise: Promise<void>;
      act(() => {
        startScreenSharePromise = result.current.startScreenShare();
      });

      // Should be busy now
      expect(result.current.isStartingScreenShare).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolveStart!();
        await startScreenSharePromise;
      });

      expect(result.current.isStartingScreenShare).toBe(false);
    });

    it("isStartingScreenShare resets to false on error", async () => {
      mockStartScreenShare.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.startScreenShare();
      });

      expect(result.current.isStartingScreenShare).toBe(false);
    });

    it("concurrent startScreenShare calls are ignored", async () => {
      let resolveStart: () => void;
      const startPromise = new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
      mockStartScreenShare.mockImplementation(() => startPromise);

      const { result } = renderHook(() => useMedia(), { wrapper });

      // First call
      let firstCall: Promise<void>;
      act(() => {
        firstCall = result.current.startScreenShare();
      });

      // Second call while first is in progress
      await act(async () => {
        await result.current.startScreenShare();
      });

      // Only one call should have been made
      expect(mockStartScreenShare).toHaveBeenCalledTimes(1);

      // Cleanup
      await act(async () => {
        resolveStart!();
        await firstCall;
      });
    });
  });
});
