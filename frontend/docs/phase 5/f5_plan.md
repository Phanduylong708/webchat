# WebRTC Integration Plan - Mesh Topology

## Tổng hợp Quyết định Kiến trúc

### Core Decisions

1. **RTCProvider init**: Khi join call thành công (call:join ACK success)
2. **Signaling flow**: Peer mới tạo offer cho tất cả existing peers (full mesh)
3. **Reconnection**: Bỏ qua (xử lý sau)
4. **Cleanup**: removePeer() ngay + clear reference (browser tự cleanup MediaStream)
5. **Multi-tab**: Master-tab per callId (BroadcastChannel/localStorage lock)
6. **Local stream sync**: Manual sync (autoSyncMesh = false)
7. **Peer ID format**: `"${callId}_${userId}"` (ví dụ: "4e688ed4-bef9-4c01-9fdc-399d70334c71_123")
8. **ICE servers**: Hardcode cho dev (STUN server public)
9. **Signaling integration**: Hook riêng `useRTCSignaling.ts`
10. **Remote streams storage**: `Map<userId, MediaStream | null>`
11. **Error handling**: Hiển thị error state trong UI
12. **UI feedback**: Không loading state (chỉ avatar placeholder)

## Kiến trúc Tổng quan

```
CallPage
  ├── MediaProvider (local stream + toggle)
  ├── RTCProvider (peer connections + remote streams)
  │   └── MeshRTCManager instance (chỉ khởi ở master-tab)
  └── ActiveCallContent
      ├── useRTCSignaling (signaling handlers)
      └── GroupCallLayout
          └── ParticipantTile (nhận remoteStream từ RTCProvider)
```

## Luồng Dữ Liệu

### 1. Join Call Flow

```
User join call
  → call:join ACK success (có participants list)
  → **Yêu cầu:** local `userStream` phải sẵn sàng (AutoStartMedia đã gọi getUserMedia, user cấp quyền). Nếu chưa có, UI sẽ hiển thị prompt và **chưa** khởi tạo WebRTC cho tới khi stream có.
  → RTCProvider init MeshRTCManager (sau khi userStream ≠ null)
  → Bind MediaProvider (manual sync)
  → Peer mới: Loop qua participants → ensurePeer() → createOffer() cho mỗi existing peer
  → Emit "call:offer" events cho tất cả existing peers
```

### 2. Signaling Flow (Peer mới join)

```
Peer mới (sau join ACK success):
  → Loop qua participants list (filter self)
  → Với mỗi existing peer:
      → ensurePeer(peerId) → tạo RTCPeerConnection
      → createOffer() → emit "call:offer"

Existing peers nhận "call:join" event:
  → ensurePeer(newPeerId) sớm (Option A - để chống rơi ICE candidates)
  → KHÔNG createOffer() (peer mới sẽ tạo)
  → Đợi "call:offer" event

Existing peers nhận "call:offer":
  → handleRemoteOffer(peerId, offer)
  → Tạo answer
  → Emit "call:answer"

Peer mới nhận "call:answer":
  → handleRemoteAnswer(peerId, answer)
```

### 3. Remote Stream Flow

```
MeshRTCManager.onTrack(peerId, stream)
  → Parse peerId để lấy userId: const [callIdPart, userIdPart] = peerId.split('_'); const userId = parseInt(userIdPart, 10);
  → Update remoteStreamsMap.set(userId, stream)
  → UI re-render → ParticipantTile nhận remoteStream
```

### 4. Leave Call Flow

```
Participant leave
  → "call:leave" event
  → removePeer(peerId)
  → Clear remoteStreamsMap.delete(userId)
  → UI filter participant khỏi list
```

## Implementation Steps

### Step 1: Tạo RTCProvider và Context

**File mới: `frontend/src/contexts/rtcContext.ts`**

- Định nghĩa RTCContextValue interface:
  - `remoteStreams: Map<number, MediaStream | null>`
  - `connectionStates: Map<number, RTCPeerConnectionState>`
  - `errorStates: Map<number, string | null>`
  - `getManager(): MeshRTCManager | null`
  - `getRemoteStream(userId: number): MediaStream | null`

**File mới: `frontend/src/contexts/rtcProvider.tsx`**

- Quản lý MeshRTCManager lifecycle:
  - Init khi callId thay đổi (từ null → có giá trị)
  - Cleanup khi callId = null hoặc unmount
- State management:
  - `remoteStreamsMap: Map<number, MediaStream | null>`
  - `connectionStatesMap: Map<number, RTCPeerConnectionState>`
  - `errorStatesMap: Map<number, string | null>`
- Sync với MediaProvider:
  - Bind MeshRTCManager (không bật autoSyncMesh)
  - Manual sync khi userStream thay đổi (start/stop, không sync khi toggle mute)

**File mới: `frontend/src/hooks/context/useRTC.tsx`**

- Hook để consume RTCContext
- Throw error nếu dùng ngoài RTCProvider

### Step 2: Tạo useRTCSignaling Hook

**File mới: `frontend/src/hooks/sockets/useRTCSignaling.ts`**

- Listen socket events:
  - `call:offer`: handleRemoteOffer → create answer → emit `call:answer`
  - `call:answer`: handleRemoteAnswer
  - `call:candidate`: addIceCandidate
- Emit events khi MeshRTCManager callbacks:
  - `onIceCandidate`: emit `call:candidate`
  - **`onNegotiationNeeded`: KHÔNG đăng ký (hoặc đăng ký nhưng ignore)**
    - Lý do: createPeer() attach tracks và có thể trigger negotiationneeded
    - Nếu auto-offer trong callback → existing peers sẽ tạo offer → phá rule "peer mới offer"
    - Peer mới sẽ manual createOffer() sau khi ensurePeer()
    - Note: Có thể implement perfect negotiation sau (v2)
- Peer ID mapping:
  - Format: `"${callId}_${userId}"`
  - Parse peerId để extract userId: `const [callIdPart, userIdPart] = peerId.split('_'); const userId = parseInt(userIdPart, 10);`

**Note về ICE Candidates Queue:**

- MeshRTCManager đã tự động queue ICE candidates nếu peer tồn tại nhưng chưa có remoteDescription
- `addIceCandidate()` tự động push vào `pendingCandidates` nếu remoteDescription chưa set
- `handleRemoteOffer()` và `handleRemoteAnswer()` đều gọi `flushPendingCandidates()` sau khi setRemoteDescription
- **Không cần implement queue logic trong useRTCSignaling** - chỉ cần gọi `addIceCandidate()` bình thường, manager sẽ tự xử lý

### Step 3: Tích hợp vào CallPage

**Sửa: `frontend/src/pages/call/CallPage.tsx`**

- Wrap ActiveCallContent với RTCProvider
- RTCProvider props:
  - `callId`: từ useCall()
  - `currentUserId`: từ useAuth()
- Call useRTCSignaling trong ActiveCallContent

### Step 4: Implement Peer Connection Lifecycle

**Trong RTCProvider:**

**Peer mới (sau join ACK success):**

- Nếu đã có `userStream` từ MediaProvider ⇒ **gọi `meshManager.setLocalStream(userStream)` trước**
- Loop qua participants list (filter self)
- Với mỗi existing peer:
  - Parse peerId: `"${callId}_${existingUserId}"`
  - ensurePeer(peerId) → tạo RTCPeerConnection (có thể trigger negotiationneeded, nhưng ignore)
  - **Manual createOffer()** → emit `call:offer` với { callId, fromUserId, toUserId, offer }
  - Note: Không dựa vào onNegotiationNeeded callback (tạm thời ignore trong v1)

**Existing peers (nhận call:join event):**

- Parse peerId: `"${callId}_${newUserId}"`
- **Option A (khuyến nghị)**: ensurePeer(peerId) sớm để chống rơi ICE candidates
  - Tạo RTCPeerConnection nhưng chưa có tracks
  - Đợi offer từ peer mới
- **KHÔNG** createOffer() khi nhận call:join (peer mới sẽ tạo)
- Chỉ handleRemoteOffer() khi nhận `call:offer` event

**Khi participant leave (call:leave event):**

- Parse peerId từ userId: `"${callId}_${userId}"`
  - removePeer(peerId)
  - Clear remoteStreamsMap.delete(userId)
  - Clear connectionStatesMap.delete(userId)
  - Clear errorStatesMap.delete(userId)

### Step 5: Cập nhật GroupCallLayout

**Sửa: `frontend/src/pages/call/Group.tsx`**

- Sử dụng useRTC() để lấy:
  - `remoteStreamsMap`
  - `connectionStatesMap` (cho error handling)
  - `errorStatesMap`
- Map participants → remoteStream theo userId
- Truyền remoteStream vào ParticipantTile

### Step 6: Cập nhật ParticipantTile

**Sửa: `frontend/src/components/call/ParticipantTile.tsx`**

- Nhận props:
  - `remoteStream?: MediaStream | null`
  - `connectionState?: RTCPeerConnectionState`
  - `errorState?: string | null`
- Logic hiển thị:
  - `isMe && showSelfVideo` → MediaVideo với selfStream
  - `!isMe && remoteStream` → MediaVideo với remoteStream
  - `!isMe && errorState` → Hiển thị error icon/message
  - Else → Avatar placeholder (không loading state)

### Step 7: Manual Sync Local Stream

**Trong RTCProvider:**

- Listen userStream changes từ MediaProvider
- Khi userStream thay đổi (start/stop):
  - Gọi `meshManager.setLocalStream(userStream)`
- Không sync khi toggle mute (stream không đổi)

### Step 8: Error Handling

**Trong RTCProvider:**

- Listen MeshRTCManager callbacks:
  - `onPeerConnectionStateChange`: Update connectionStatesMap
  - `onIceConnectionStateChange`: Nếu "failed" → set errorState
  - `onError`: Set errorState cho peer

**Trong ParticipantTile:**

- Hiển thị error icon nếu errorState có giá trị
- Tooltip/message: "Connection failed" hoặc error message

## Multi-Tab Master Election (per callId)

- Cơ chế: BroadcastChannel (fallback localStorage) khóa `call_<callId>_master`.
- Tab đầu tiên set khóa ⇒ trở thành **master-tab** và init RTCProvider.
- Tab mới nếu thấy khóa đã tồn tại ⇒ **không** init RTC, chỉ hiển thị UI read-only.
- Khi master unload/crash: dùng `beforeunload` + heartbeat (5 s) để giải phóng khóa; tab khác giành quyền và init RTC.
- **Không** dùng Page Visibility cho việc pause WebRTC. Call-tab vẫn gửi/nhận media dù user chuyển qua Gmail/tab khác.

## Technical Details

### Peer ID Format

- **Format**: `"${callId}_${userId}"`
  - `callId`: UUID string (ví dụ: "4e688ed4-bef9-4c01-9fdc-399d70334c71")
  - `userId`: Integer (ví dụ: 123)
- **Example**: `"4e688ed4-bef9-4c01-9fdc-399d70334c71_123"`
- **Parse**:
  ```typescript
  const [callIdPart, userIdPart] = peerId.split("_");
  const userId = parseInt(userIdPart, 10); // userIdPart là string "123"
  ```
- **Lưu ý**: KHÔNG có prefix "user-" trong format. Chỉ là `${callId}_${userId}` trực tiếp.

### ICE Servers (Hardcode cho dev)

```typescript
const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
```

### onNegotiationNeeded Handling (v1)

**Quyết định: Tạm thời không dùng onNegotiationNeeded callback**

- **Lý do**:
  - `createPeer()` → `attachLocalTracks()` → `addTrack()` → trigger `negotiationneeded`
  - Nếu existing peers gọi `ensurePeer()` sớm (Option A) → trigger `negotiationneeded`
  - Nếu auto-createOffer trong callback → existing peers sẽ tạo offer → phá rule "peer mới offer"
- **Implementation**:
  - Không đăng ký `onNegotiationNeeded` callback trong RTCProvider config
  - Hoặc đăng ký nhưng ignore (không xử lý)
  - Peer mới sẽ **manual createOffer()** sau khi `ensurePeer()`
- **Future (v2)**: Có thể implement perfect negotiation pattern sau

## Files to Create/Modify

### New Files

1. `frontend/src/contexts/rtcContext.ts`
2. `frontend/src/contexts/rtcProvider.tsx`
3. `frontend/src/hooks/context/useRTC.tsx`
4. `frontend/src/hooks/sockets/useRTCSignaling.ts`
5. `frontend/src/types/rtc.type.ts`

### Modified Files

1. `frontend/src/pages/call/CallPage.tsx` - Wrap RTCProvider, call useRTCSignaling
2. `frontend/src/pages/call/Group.tsx` - Consume remoteStreamsMap
3. `frontend/src/components/call/ParticipantTile.tsx` - Nhận remoteStream prop, error handling

## Testing Strategy

1. **Unit Tests**: RTCProvider logic, useRTCSignaling handlers
2. **Integration Tests**: Full signaling flow (offer → answer → candidate)
3. **E2E Tests**: 2 users join call → see each other's video
4. **Edge Cases**:

   - Tab switch (active/inactive)
   - Participant leave mid-negotiation
   - Network failure scenarios

## Future Enhancements

1. Reconnection handling (ICE restart)
2. ICE servers từ env/API
3. Connection quality monitoring (RTCStatsReport)
4. Adaptive bitrate
5. SFU migration (nếu mesh không scale)
