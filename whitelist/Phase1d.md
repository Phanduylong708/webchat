# Phase 1d: Presence & Cursors (High-Level Plan)

### Goal
- Thêm “presence” tối thiểu cho whiteboard: thấy con trỏ người khác theo thời gian thực + màu nhận diện theo user, và highlight object khi mình select để tăng cảm giác “đang cùng thao tác”.

### Scope (will ship in 1d)
- Cursor realtime sync 2 chiều qua `Socket.IO` (throttle).
- Overlay hiển thị remote cursors trên canvas (arrow marker), tự fade/remove khi im lặng 3s.
- User color: mỗi user có màu ổn định trong call (dùng để tô cursor + dùng cho highlight).
- Object highlight: khi local select object trên Fabric, hiển thị viền/feedback theo `myColor` (client-side visual only).

### Explicit Decisions (locked)
- No username label cạnh cursor.
- Drop cursor events trước khi nhận snapshot (cursor là ephemeral, không replay).
- Remote cursor key theo `userId` (multi-tab cùng user: last-write-wins).
- Không render “local ghost cursor” (chỉ remote cursors).
- Cursor chỉ gửi/hiển thị khi pointer nằm trong vùng canvas; rời canvas thì clear ngay.
- Throttle mặc định ~60–75ms (có thể tune sau bằng test).

### Non-goals (Phase 1d)
- Không làm zoom/pan/transform math; cursor positions theo hệ tọa độ 1:1 hiện tại.
- Không thay đổi semantics sync object (snapshot-first, optimistic apply, stale-ack self-heal giữ nguyên).
- Không làm “global presence” (join/leave roster UI), chỉ cursor + color + local highlight.

### Architecture / Ownership
- Cursor state là ephemeral, không đưa vào `WhiteboardProvider` context để tránh re-render nặng.
- **Ownership đề xuất:**
  - `useWhiteboardSync`: chịu trách nhiệm emit/listen event cursor (transport + throttle + canSync gating).
  - `useWhiteboardOrchestration`: giữ `remoteCursors` map + timestamp, cung cấp dữ liệu cho UI.
  - `Whiteboard`/`WhiteboardCanvas`: bắt pointer move/enter/leave để trigger emit, và render overlay component.
- **Cursor buffering policy:** trước snapshot thì drop (không enqueue chung với object pending queue) để tránh overflow/join-loop.

### UX Expectations
- Khi 2 users cùng mở whiteboard trong call, mỗi người thấy con trỏ người kia di chuyển mượt, màu nhất quán.
- Khi user kia ngừng gửi cursor > 3s, cursor tự mờ rồi biến mất; khi họ move lại thì hiện lại.
- Khi local user rời canvas (pointer leave/blur/unmount), remote clients thấy cursor biến mất nhanh (clear).

### Quality Gates / Regression Safety
- **Không phá các invariants:**
  - Stale-ack ref bridge `CallPage` ↔ `Whiteboard`.
  - Unmount whiteboard when inactive.
  - Screen share precedence (screenshare > whiteboard).
  - Layout constraints (min-w-0, scroll container correctness).
- Cursor không được làm tăng rủi ro “re-join loop” (đặc biệt pre-snapshot).

### Verification
- **Test trong 2 entrypoints:**
  - `/call/:callId` (primary).
  - `/dev/whiteboard?ui=1&callId=...` (dev harness).
- **Test basic scenarios:** join late, switch tab, pointer leave/return, idle > 3s, screen share starts (whiteboard auto-close), local-only mode (no callId) không crash.

# High-Level Tasks
Step 19: Add Cursor Sync (Transport + Presence State Wiring, No UI Yet)
Objective
- Thiết lập pipeline cursor realtime ổn định: inbound wb:cursor → update presence state; outbound API sẵn để emit cursor (leading throttle 60–75ms), nhưng chưa render UI overlay (Step 20).
- Đảm bảo cursor là “ephemeral”: pre-snapshot thì drop (không buffer), không được làm đầy pending queue / gây re-join loop.
- Giữ nguyên toàn bộ invariants hiện tại (stale-ack bridge, unmount when inactive, screenshare precedence, layout).
Files
- Create: frontend/src/hooks/whiteboard/useCursorPresence.ts (new)
- Modify: frontend/src/hooks/whiteboard/useWhiteboardSync.ts
- Modify: frontend/src/hooks/whiteboard/useWhiteboardOrchestration.ts
- Modify (wiring only, không UI): frontend/src/components/whiteboard/Whiteboard.tsx
Non-goals (explicit)
- Chưa tạo WhiteboardCursors overlay (Step 20).
- Không thêm username label, không local ghost cursor.
- Không đổi backend event contract, không thay semantics sync object.
Implementation Notes (must follow)
- Cursor inbound MUST NOT đi qua pending queue (drop pre-snapshot; sau snapshot thì dispatch thẳng).
- Key remote cursors theo userId (multi-tab cùng user: last-write-wins).
- Throttle outbound: leading-edge (emit ngay) với khoảng 60–75ms; có thể tune sau khi test.
- Clear cursor phải “ngay”: hỗ trợ emitCursor(null) để Step 20 gọi khi pointer leave/blur; pre-existing unmount clear trong sync có thể giữ như safety net.
Proposed Contracts
- useCursorPresence(params) trả về tối thiểu:
  - handleRemoteCursor(userId, position, color) (để feed từ sync inbound)
  - emitCursor(position|null) (leading throttle; clear không throttle)
  - remoteCursors (Map/array) + timestamps (phục vụ Step 20 render + fade 3s)
Acceptance Criteria / Checklist
- Cursor inbound không bao giờ làm tăng pendingEventsRef và không thể trigger overflow → requestJoin() chỉ vì cursor spam.
- Không tạo double socket listeners cho wb:cursor (listener vẫn chỉ ở useWhiteboardSync).
- API outbound chuẩn bị sẵn (leading throttle), nhưng Step 19 chưa cần hook DOM events.
- TS compile, không phá flow whiteboard hiện tại.
Definition of Done
- Có hook presence tách riêng + wiring inbound hoàn chỉnh; Step 20 chỉ việc “render + hook pointer events”.
---
Atomic Execution Tasks for Step 19
Task 19.1: Add useCursorPresence Hook (State + TTL + Throttle API)
Objective
- Tạo nơi “single responsibility” quản lý remote cursor state + TTL (3s) + API emit cursor throttle.
File
- Create: frontend/src/hooks/whiteboard/useCursorPresence.ts
Non-goals
- Không socket.on("wb:cursor") trong hook này.
- Không render UI.
Implementation Notes
- State shape gợi ý: Map<UserID, { userId, color, position, lastSeenAt }>
- TTL: sau 3s không update thì mark hidden/remove (cách làm cụ thể tùy agent, miễn không leak timers).
- emitCursor:
  - Leading throttle 60–75ms cho position != null
  - Clear (null) phải emit ngay (không throttle)
Acceptance
- Hook pure về listener; không phụ thuộc whiteboard provider; không gây re-render toàn app.
---
Task 19.2: Make Cursor Inbound Drop Pre-Snapshot (Avoid Pending Queue)
Objective
- Sửa useWhiteboardSync để cursor events không đi vào pendingEventsRef khi chưa ready.
File
- Modify: frontend/src/hooks/whiteboard/useWhiteboardSync.ts
Implementation Notes
- Ở handler wb:cursor: nếu chưa hasSnapshotRef.current hoặc chưa isReadyToApply → return (drop).
- Sau ready → gọi thẳng callbacksRef.current.onCursorUpdate(...).
- Không dùng bufferOrDispatch cho cursor nữa (để cursor không “ăn” MAX_PENDING_EVENTS).
Acceptance
- Không còn risk cursor flood làm pendingEventsRef overflow và gọi requestJoin().
---
Task 19.3: Orchestration Remains Thin, Accept External onCursorUpdate
Objective
- Giữ orchestration “bridge” đúng tinh thần, không phình state vào đây.
File
- Modify: frontend/src/hooks/whiteboard/useWhiteboardOrchestration.ts
Implementation Notes
- Thêm param onCursorUpdate (optional hoặc required) vào UseWhiteboardOrchestrationParams và pass xuống useWhiteboardSync.
- Bỏ stub internal onCursorUpdate no-op (hoặc chỉ làm default no-op nếu param không truyền).
Acceptance
- Orchestration vẫn chỉ wiring + staleAck handling, không chứa cursor state.
---
Task 19.4: Wire Presence Hook Into Whiteboard (No UI Render Yet)
Objective
- Nối inbound cursor từ sync vào useCursorPresence.handleRemoteCursor để state chạy thật.
File
- Modify: frontend/src/components/whiteboard/Whiteboard.tsx
Implementation Notes
- Khởi tạo useCursorPresence({ socket, callId, isActive, canSync, ttlMs: 3000, throttleMs: 75 })
- Truyền handleRemoteCursor vào orchestration param onCursorUpdate.
- Chưa render remoteCursors (Step 20 mới dùng), nhưng wiring phải có thật.
Acceptance
- Whiteboard hoạt động như cũ; không thêm listener; không thay lifecycle.


### IMPLEMENTATION PHASES. IMPORTANT

# Step 19.1 (Batch A): Create useCursorPresence Hook (State + TTL/Fade + Throttle Emit API)

### Objective
- Tạo hook “single responsibility” quản lý presence/cursors:
  - Giữ `remoteCursors` state theo `userId` (position + color + timestamps).
  - TTL: sau 3s không update thì chuyển sang trạng thái “stale” để Step 20 fade; sau một khoảng grace thì remove khỏi state.
  - Cung cấp API outbound `emitCursor(position|null)` với throttle leading-edge 60–75ms; clear (`null`) phải emit ngay (không throttle).
- Hook không tự attach socket listeners inbound; inbound sẽ được feed từ `useWhiteboardSync` (Batch B).

### File
- **Create:** `frontend/src/hooks/whiteboard/useCursorPresence.ts`

### Non-goals (explicit)
- Không `socket.on("wb:cursor")` / không listen inbound trong hook này (tránh double listener).
- Không render UI (Step 20 mới render).
- Không phụ thuộc `WhiteboardProvider` context (không đẩy cursor vào provider).
- Không làm zoom/pan transform math (positions là 1:1 canvas coords).

### Implementation Notes (must follow)
- **Key remote cursor:** `userId` (multi-tab cùng user: last-write-wins).
- **State shape đề xuất** (export để Step 20 dùng):
  - `RemoteCursorPresence = { userId, color, position, lastSeenAt, staleSince }`
  - `staleSince`: `number | null` (null khi fresh; set khi vượt TTL để UI fade).
- **TTL policy:**
  - `ttlMs = 3000` (locked).
  - `removeGraceMs` (đề xuất 1000–2000ms) để kịp fade trước khi remove.
  - Cleanup nên dùng một interval (vd 250ms hoặc 500ms), không tạo timer per-user.
- **handleRemoteCursor(userId, position, color):**
  - `position === null` → remove ngay entry (cursor clear).
  - `position !== null` → upsert entry, set `lastSeenAt=now`, `staleSince=null`, update color.
- **emitCursor(position|null):**
  - Guard: chỉ emit khi `socket && callId && isActive && canSync`.
  - Leading throttle cho `position !== null` với `throttleMs` mặc định 75ms (có thể config).
  - `position === null` clear ngay, không throttle; cũng nên cancel pending throttle timer nếu có.
- Hook nên reset internal throttling timers khi `callId` đổi hoặc khi `isActive`/`canSync` false (để không emit lạc call).

### Proposed Hook Contract
- **Input params** (tối thiểu):
  - `socket: Socket | null`
  - `callId: string | null`
  - `isActive: boolean`
  - `canSync: boolean`
  - `ttlMs?: number` (default 3000)
  - `removeGraceMs?: number` (default 1500)
  - `throttleMs?: number` (default 75)
- **Output:**
  - `remoteCursors: RemoteCursorPresence[]` (hoặc `Map<UserId, ...>` nhưng array dễ render overlay).
  - `handleRemoteCursor: (userId, position, color) => void`
  - `emitCursor: (position: CursorPosition | null) => void`
  - Optional: `clearAllRemoteCursors: () => void` (useful khi `callId` đổi).

### Acceptance Criteria / Checklist
- Hook compile TS, không attach socket listeners inbound.
- `remoteCursors` update đúng cho 3 case: update, clear-by-null, stale-after-3s.
- TTL logic không leak interval/timers (cleanup đúng on unmount).
- `emitCursor` không vượt rate throttle; clear (`null`) gửi ngay.
- Không introduce dependency vào provider/context; chỉ pure hook.

### Definition of Done
- Tạo xong `frontend/src/hooks/whiteboard/useCursorPresence.ts` với exports rõ ràng.
- Có unit-level “self-consistency” qua code review: không listener inbound, có cleanup interval, throttle leading-edge, TTL 3s + grace remove.

> **Ghi chú:** Batch A chỉ tạo hook + API; chưa có chỗ gọi `handleRemoteCursor` hay `emitCursor` (Batch B/C mới wiring), nên agent không cần manual test UI ở batch này.