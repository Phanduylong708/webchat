## Phase 5 – Video Calling: Working Plan (Draft)

### 1) Signaling (Server)
- Add `call.handler.js` and wire in `sockets/index.js`.
- Rooms: `user_{id}`, `conversation_{id}` (existing), **call room** `call_{callId}` for active calls.
- Events (reuse 5 chính, lý do qua reason):  
  - `call:initiate` (with `callId`, `conversationId`, caller info) emit to conversation room for ring.  
  - `call:offer` / `call:answer` / `call:candidate` bridge via `call_{callId}` (socket.to).  
  - `call:end` với `reason` (hangup | declined | cancelled | timeout | error).  
- Server state tối thiểu: `callId -> { conversationId, members, status, timeout }`; auto timeout (30s) nếu chưa ai accept; cleanup on end.
- Validation: auth socket, member of conversation, không tự gọi chính mình, không join call nếu đã “declined”.
- Resilience: bật `connectionStateRecovery` (Socket.IO 4.6+) để tự khôi phục room; nếu `socket.recovered` true thì bỏ qua rejoin thủ công, nếu false thì rejoin conversation/call room như cũ.
- Logging: track `reason` và thời gian thiết lập (initiate -> first media flowing) để debug.

### 2) Client Signaling Layer
- Socket hooks/lớp “CallSignaling” chịu trách nhiệm emit/listen các event trên.
- Pre-warm: caller tạo PeerConnection + offer + ICE ngay sau initiate; callee tạo PC và gather ICE trước, chỉ add tracks/answer sau khi Accept.
- Mỗi event đính `{ callId, conversationId, from, to?, sdp?, candidate?, reason? }`; queue ICE nếu remote chưa set.

### 3) WebRTC Core Integration
- Dùng `MeshRTCManager` cho peer connections; `MediaStreamManager` cho user/screen media.
- Khi Accept: lấy user media (hoặc reuse preview), setRemote(offer) → setLocal(answer) → flush ICE.
- ICE/SDP gửi qua call room; hỗ trợ renegotiation (re-offer) khi bật/tắt cam/screen.
- Handle multi-device: mọi socket của user nhận ring; chỉ socket Accept join call room.

### 4) UI/UX & Controls (MVP)
- In-call overlay: local/remote tiles, status, timer.
- Ring popup: caller info, Accept/Decline (Decline = `call:end` reason=declined).
- Controls: mute/unmute, toggle cam, switch mic/cam, screen share on/off, hangup.
- Late join: nút “Join call” nếu cuộc gọi còn active (join call room).
- Error/edge: hiển thị lý do end (declined/busy/timeout/error).

### 5) Testing & Rollout
- Manual matrix: 1-1 và nhóm (3+), multi-tab cùng user, decline/accept/timeout, hangup từ hai phía, screen share toggle.
- Network edge: ICE fail, TURN unavailable, offer/answer out-of-order, late ICE.
- Logs/metrics: đếm reason kết thúc, thời gian thiết lập.

### 6) Nice-to-have (sau MVP)
- Persist last call summary (duration, reason) cho UI history.
- Auto-reconnect/re-offer khi ICE disconnected.
- Active speaker detection, layout auto-switch.
