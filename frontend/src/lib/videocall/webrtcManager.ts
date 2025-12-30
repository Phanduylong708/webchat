"use strict";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Minimal logger interface matching methods actually used by MeshRTCManager.
 * All methods are optional; defaults to console if not provided.
 */
export interface MeshRTCLogger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug?: (...args: any[]) => void;
}

/**
 * Configuration options for MeshRTCManager constructor.
 * All properties are optional.
 */
export interface MeshRTCManagerConfig {
  /**
   * RTCConfiguration for peer connections (ICE servers, etc.)
   */
  rtcConfig?: RTCConfiguration;

  /**
   * Called when a local ICE candidate is generated for a peer.
   * Typically used to send the candidate to the remote peer via signaling.
   */
  onIceCandidate?: (peerId: string, candidate: RTCIceCandidate) => void;

  /**
   * Called when a remote track is received from a peer.
   */
  onTrack?: (peerId: string, stream: MediaStream, event: RTCTrackEvent) => void;

  /**
   * Called when a peer's connection state changes.
   */
  onPeerConnectionStateChange?: (
    peerId: string,
    state: RTCPeerConnectionState
  ) => void;

  /**
   * Called when a peer's ICE connection state changes.
   */
  onIceConnectionStateChange?: (
    peerId: string,
    state: RTCIceConnectionState
  ) => void;

  /**
   * Called when negotiation is needed for a peer.
   * Can be async - the manager will await this callback.
   * Typically used to create and send an offer to the remote peer.
   */
  onNegotiationNeeded?: (
    peerId: string,
    connection: RTCPeerConnection
  ) => Promise<void> | void;

  /**
   * Called immediately after a new peer connection is created.
   */
  onPeerCreated?: (peerId: string, connection: RTCPeerConnection) => void;

  /**
   * Called when a data channel is received from a peer.
   */
  onDataChannel?: (peerId: string, channel: RTCDataChannel) => void;

  /**
   * Called after a peer connection is removed and closed.
   */
  onPeerRemoved?: (peerId: string) => void;

  /**
   * Custom logger instance. Defaults to console.
   */
  logger?: MeshRTCLogger;
}

/**
 * Internal structure tracking each peer connection and its state.
 */
interface PeerData {
  connection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidate[];
  localTracksAdded: boolean;
  /**
   * Map of track kind ('audio' | 'video') to RTCRtpSender.
   * Used for replaceTrack() to avoid renegotiation when switching streams.
   */
  senders: Map<string, RTCRtpSender>;
}

// ============================================================================
// MeshRTCManager Class
// ============================================================================

/**
 * Manages WebRTC peer connections in a mesh topology.
 * Handles connection lifecycle, SDP negotiation, ICE candidates, and media tracks.
 *
 * ## Track Management
 * - Uses RTCRtpSender.replaceTrack() for seamless media switching without renegotiation
 * - Call setLocalStream() multiple times to switch cameras/microphones smoothly
 * - Pass null to setLocalStream() to remove all tracks cleanly
 * - Use replaceTrack() for advanced per-track control (e.g., mute video only)
 *
 * ## Example Usage
 * ```typescript
 * const manager = new MeshRTCManager({ rtcConfig: { iceServers: [...] } });
 *
 * // Initial stream setup
 * await manager.setLocalStream(stream1);
 *
 * // Switch camera seamlessly (no renegotiation!)
 * await manager.setLocalStream(stream2);
 *
 * // Temporarily remove all tracks
 * await manager.setLocalStream(null);
 *
 * // Advanced: Replace only video track for specific peer
 * await manager.replaceTrack('peer123', 'video', newVideoTrack);
 * ```
 */
export class MeshRTCManager {
  private rtcConfig: RTCConfiguration;
  private callbacks: {
    onIceCandidate?: (peerId: string, candidate: RTCIceCandidate) => void;
    onTrack?: (peerId: string, stream: MediaStream, event: RTCTrackEvent) => void;
    onPeerConnectionStateChange?: (
      peerId: string,
      state: RTCPeerConnectionState
    ) => void;
    onIceConnectionStateChange?: (
      peerId: string,
      state: RTCIceConnectionState
    ) => void;
    onNegotiationNeeded?: (
      peerId: string,
      connection: RTCPeerConnection
    ) => Promise<void> | void;
    onPeerCreated?: (peerId: string, connection: RTCPeerConnection) => void;
    onDataChannel?: (peerId: string, channel: RTCDataChannel) => void;
    onPeerRemoved?: (peerId: string) => void;
  };
  private logger: MeshRTCLogger;
  private localStream: MediaStream | null;
  private peerConnections: Map<string, PeerData>;

  constructor(config: MeshRTCManagerConfig = {}) {
    // Use nullish coalescing (??) to provide defaults for undefined/null values
    this.rtcConfig = config.rtcConfig ?? {};

    // Store all callbacks in a single object for easy access
    this.callbacks = {
      onIceCandidate: config.onIceCandidate,
      onTrack: config.onTrack,
      onPeerConnectionStateChange: config.onPeerConnectionStateChange,
      onIceConnectionStateChange: config.onIceConnectionStateChange,
      onNegotiationNeeded: config.onNegotiationNeeded,
      onPeerCreated: config.onPeerCreated,
      onDataChannel: config.onDataChannel,
      onPeerRemoved: config.onPeerRemoved,
    };

    // Default to console if no custom logger provided
    this.logger = config.logger ?? console;

    // Initialize state
    this.localStream = null;
    this.peerConnections = new Map();
  }

  /**
   * Sets or updates the local media stream.
   * Automatically attaches tracks to all existing peer connections.
   * Pass null to remove all tracks (calls replaceTrack(null) on all senders).
   *
   * @param stream - The MediaStream to set, or null to remove all tracks
   */
  async setLocalStream(stream: MediaStream | null): Promise<void> {
    this.localStream = stream;

    // If stream is null, replace all existing tracks with null
    if (stream === null) {
      for (const [peerId, peerData] of this.peerConnections.entries()) {
        for (const [kind, sender] of peerData.senders.entries()) {
          await sender.replaceTrack(null);
          if (this.logger?.debug) {
            this.logger.debug(`Removed ${kind} track for peer ${peerId} (stream set to null)`);
          }
        }
      }
      return;
    }

    // Update all existing peer connections with the new stream
    for (const [peerId, peerData] of this.peerConnections.entries()) {
      await this.attachLocalTracks(peerId, peerData);
    }
  }

  /**
   * Replaces a single track for a specific peer without renegotiation.
   * Useful for advanced scenarios like swapping just video or just audio.
   *
   * @param peerId - The peer connection ID
   * @param kind - The track kind ('audio' or 'video')
   * @param track - The new track to use, or null to remove the track
   * @throws Error if the peer doesn't exist or doesn't have a sender for the specified kind
   */
  async replaceTrack(
    peerId: string,
    kind: 'audio' | 'video',
    track: MediaStreamTrack | null
  ): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error(`Cannot replace track, peer ${peerId} not found`);
    }

    const sender = peerData.senders.get(kind);
    if (!sender) {
      throw new Error(`Cannot replace track, peer ${peerId} has no ${kind} sender`);
    }

    await sender.replaceTrack(track);
    if (this.logger?.debug) {
      if (track) {
        this.logger.debug(`Replaced ${kind} track for peer ${peerId}`);
      } else {
        this.logger.debug(`Removed ${kind} track for peer ${peerId}`);
      }
    }
  }

  /**
   * Checks if a peer connection exists for the given peer ID.
   */
  hasPeer(peerId: string): boolean {
    return this.peerConnections.has(peerId);
  }

  /**
   * Gets an existing peer connection or creates a new one if it doesn't exist.
   */
  ensurePeer(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      // Use non-null assertion (!) because we just checked the peer exists
      return this.peerConnections.get(peerId)!.connection;
    }
    // Create a new peer connection if it doesn't exist yet
    return this.createPeer(peerId);
  }

  /**
   * Creates an SDP offer for a peer connection.
   * Automatically sets it as the local description.
   */
  async createOffer(
    peerId: string,
    options?: RTCOfferOptions
  ): Promise<RTCSessionDescription> {
    const connection = this.ensurePeer(peerId);

    // Create the SDP offer
    const offer = await connection.createOffer(options);
    // Set it as our local description (starts ICE gathering)
    await connection.setLocalDescription(offer);

    // Verify the local description was set successfully
    // After successful setLocalDescription, this should never be null
    if (!connection.localDescription) {
      throw new Error(`Failed to set local description for peer ${peerId}`);
    }

    return connection.localDescription;
  }

  /**
   * Restarts ICE for a peer connection by creating a new offer with iceRestart flag.
   */
  async restartIce(
    peerId: string,
    options?: RTCOfferOptions
  ): Promise<RTCSessionDescription> {
    const connection = this.ensurePeer(peerId);
    if (typeof connection.restartIce === "function") {
      connection.restartIce();
      if (this.logger?.info) {
        this.logger.info(`Called restartIce() for peer ${peerId}`);
      }
    }
    const mergedOptions: RTCOfferOptions = {
      ...options,
      iceRestart: true,
    };
    const offer = await connection.createOffer(mergedOptions);
    await connection.setLocalDescription(offer);
    if (!connection.localDescription) {
      throw new Error(`Failed to set local description during ICE restart for peer ${peerId}`);
    }
    return connection.localDescription;
  }

  /**
   * Returns the raw RTCStatsReport for a peer connection.
   * Consumers can iterate over the report to extract:
   * - outbound-rtp / inbound-rtp (bitrate, packets, frame rate, etc.)
   * - candidate-pair (RTT, available bitrate)
   * - remote-inbound-rtp (remote jitter, packet loss)
   */
  async getStats(peerId: string): Promise<RTCStatsReport> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error(`Cannot get stats, peer ${peerId} not found`);
    }
    return peerData.connection.getStats();
  }

  /**
   * Handles a remote SDP offer, sets it as remote description, and creates an answer.
   */
  async handleRemoteOffer(
    peerId: string,
    remoteSdp: RTCSessionDescriptionInit,
    answerOptions?: RTCOfferOptions
  ): Promise<RTCSessionDescription> {
    const connection = this.ensurePeer(peerId);

    // Step 1: Set the remote offer as the remote description
    await connection.setRemoteDescription(new RTCSessionDescription(remoteSdp));

    // Step 2: Process any ICE candidates that arrived before the remote description
    // (candidates must be added after remote description is set)
    await this.flushPendingCandidates(peerId);

    // Step 3: Create an SDP answer based on the remote offer
    const answer = await connection.createAnswer(answerOptions);

    // Step 4: Set our answer as the local description
    await connection.setLocalDescription(answer);

    // Verify the local description was set successfully
    if (!connection.localDescription) {
      throw new Error(`Failed to set local description for answer to peer ${peerId}`);
    }

    return connection.localDescription;
  }

  /**
   * Handles a remote SDP answer by setting it as the remote description.
   */
  async handleRemoteAnswer(
    peerId: string,
    remoteSdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error(`Cannot apply answer, peer ${peerId} not found`);
    }
    await peerData.connection.setRemoteDescription(
      new RTCSessionDescription(remoteSdp)
    );
    await this.flushPendingCandidates(peerId);
  }

  /**
   * Adds an ICE candidate to a peer connection.
   * If remote description isn't set yet, queues the candidate for later.
   */
  async addIceCandidate(
    peerId: string,
    candidateInit: RTCIceCandidateInit | null
  ): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      if (this.logger?.warn) {
        this.logger.warn(`No peer ${peerId} for ICE candidate`);
      }
      return;
    }

    // Convert the init object to an RTCIceCandidate instance
    // null candidateInit represents an end-of-candidates signal
    const candidate = candidateInit ? new RTCIceCandidate(candidateInit) : null;

    if (!candidate) {
      return;
    }

    // ICE candidates can only be added after the remote description is set
    // If we don't have a remote description yet, queue the candidate for later
    if (!peerData.connection.remoteDescription) {
      peerData.pendingCandidates.push(candidate);
    } else {
      // Remote description is set, add the candidate immediately
      await peerData.connection.addIceCandidate(candidate);
    }
  }

  /**
   * Removes and closes a peer connection.
   */
  removePeer(peerId: string): void {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      return;
    }
    peerData.connection.close();
    this.peerConnections.delete(peerId);
    if (this.callbacks.onPeerRemoved) {
      this.callbacks.onPeerRemoved(peerId);
    }
  }

  /**
   * Disconnects and removes all peer connections.
   */
  disconnectAll(): void {
    for (const peerId of this.peerConnections.keys()) {
      this.removePeer(peerId);
    }
  }

  /**
   * Sets or clears the onIceCandidate callback dynamically.
   * Useful for hooks that need to register signaling after construction.
   */
  setOnIceCandidate(
    callback: ((peerId: string, candidate: RTCIceCandidate) => void) | undefined
  ): void {
    this.callbacks.onIceCandidate = callback;
  }

  /**
   * Creates a new RTCPeerConnection for a peer and initializes it.
   */
  private createPeer(peerId: string): RTCPeerConnection {
    // Create a new RTCPeerConnection with the configured settings
    const connection = new RTCPeerConnection(this.rtcConfig);

    // Initialize tracking data for this peer
    const peerData: PeerData = {
      connection,
      pendingCandidates: [], // Queue for candidates received before remote description
      localTracksAdded: false, // Flag to prevent duplicate track attachments
      senders: new Map(), // Track RTCRtpSenders for replaceTrack()
    };
    this.peerConnections.set(peerId, peerData);

    // Notify consumer that a new peer was created
    if (this.callbacks.onPeerCreated) {
      this.callbacks.onPeerCreated(peerId, connection);
    }

    // Attach local media tracks if available
    this.attachLocalTracks(peerId, peerData);

    // Set up all WebRTC event handlers
    this.wirePeerEvents(peerId, connection);

    // Listen for incoming data channels (always register, check callback inside)
    // This allows callbacks to be set dynamically after construction
    connection.addEventListener("datachannel", (event) => {
      if (this.callbacks.onDataChannel) {
        this.callbacks.onDataChannel(peerId, event.channel);
      }
    });

    return connection;
  }

  /**
   * Creates a data channel on a peer connection.
   */
  createDataChannel(
    peerId: string,
    label: string,
    options?: RTCDataChannelInit
  ): RTCDataChannel {
    const connection = this.ensurePeer(peerId);
    const channel = connection.createDataChannel(label, options);
    return channel;
  }

  /**
   * Attaches local media tracks to a peer connection.
   * Uses replaceTrack() for existing senders to avoid renegotiation,
   * or addTrack() for first-time attachment.
   */
  private async attachLocalTracks(peerId: string, peerData: PeerData): Promise<void> {
    // Skip if no local stream is set
    if (!this.localStream) {
      return;
    }

    // If tracks were already added, use replaceTrack to swap without renegotiation
    if (peerData.localTracksAdded) {
      // Build a map of new tracks by kind
      const newTracksByKind = new Map<string, MediaStreamTrack>();
      for (const track of this.localStream.getTracks()) {
        newTracksByKind.set(track.kind, track);
      }

      // Replace existing senders' tracks (or set to null if track kind disappeared)
      for (const [kind, sender] of peerData.senders.entries()) {
        const newTrack = newTracksByKind.get(kind) ?? null;
        await sender.replaceTrack(newTrack);
        if (this.logger?.debug) {
          if (newTrack) {
            this.logger.debug(`Replaced ${kind} track for peer ${peerId}`);
          } else {
            this.logger.debug(`Set ${kind} track to null for peer ${peerId} (track removed from stream)`);
          }
        }
      }

      // Add senders for any new track kinds that didn't exist before
      for (const [kind, track] of newTracksByKind.entries()) {
        if (!peerData.senders.has(kind)) {
          const sender = peerData.connection.addTrack(track, this.localStream);
          peerData.senders.set(kind, sender);
          if (this.logger?.debug) {
            this.logger.debug(`Added new ${kind} track to peer ${peerId}`);
          }
        }
      }
    } else {
      // First time adding tracks - use addTrack and store senders
      for (const track of this.localStream.getTracks()) {
        const sender = peerData.connection.addTrack(track, this.localStream);
        peerData.senders.set(track.kind, sender);
        if (this.logger?.debug) {
          this.logger.debug(`Attached ${track.kind} track to peer ${peerId}`);
        }
      }
      peerData.localTracksAdded = true;
    }
  }

  /**
   * Wires up event handlers for a peer connection.
   * All handlers check if callbacks exist before calling them (optional callbacks pattern).
   */
  private wirePeerEvents(peerId: string, connection: RTCPeerConnection): void {
    // Fired when a new ICE candidate is discovered
    // null candidate signals end of candidate gathering
    connection.onicecandidate = (event) => {
      if (this.callbacks.onIceCandidate && event.candidate) {
        this.callbacks.onIceCandidate(peerId, event.candidate);
      }
    };

    // Fired when ICE connection state changes (checking, connected, disconnected, etc.)
    connection.oniceconnectionstatechange = () => {
      if (this.callbacks.onIceConnectionStateChange) {
        this.callbacks.onIceConnectionStateChange(
          peerId,
          connection.iceConnectionState
        );
      }
    };

    // Fired when a remote track (audio/video) is received
    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (this.callbacks.onTrack && stream) {
        this.callbacks.onTrack(peerId, stream, event);
      }
    };

    // Fired when overall peer connection state changes (new, connecting, connected, failed, etc.)
    connection.onconnectionstatechange = () => {
      if (this.callbacks.onPeerConnectionStateChange) {
        this.callbacks.onPeerConnectionStateChange(
          peerId,
          connection.connectionState
        );
      }
    };

    // Fired when renegotiation is needed (track added/removed, etc.)
    connection.onnegotiationneeded = async () => {
      if (this.callbacks.onNegotiationNeeded) {
        try {
          // Await the callback (supports both sync and async callbacks)
          await this.callbacks.onNegotiationNeeded(peerId, connection);
        } catch (error) {
          // Log errors in the negotiation handler to prevent silent failures
          if (this.logger?.error) {
            this.logger.error(
              `Negotiation handler failed for peer ${peerId}:`,
              error
            );
          }
        }
      }
    };
  }

  /**
   * Flushes any ICE candidates that were queued before remote description was set.
   * WebRTC requires the remote description to be set before ICE candidates can be added.
   * This method processes the queue after the remote description becomes available.
   */
  private async flushPendingCandidates(peerId: string): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      return;
    }

    // Process all queued candidates in order (FIFO)
    while (peerData.pendingCandidates.length > 0) {
      const candidate = peerData.pendingCandidates.shift()!;
      // Non-null assertion (!) is safe because we just checked length > 0
      await peerData.connection.addIceCandidate(candidate);
    }
  }
}
