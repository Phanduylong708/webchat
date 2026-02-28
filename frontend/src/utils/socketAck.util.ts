import type { Socket } from "socket.io-client";

type EmitWithAckTimeoutParams<TAck, TSuccessAck extends TAck> = {
  socket: Socket;
  event: string;
  payload: unknown;
  timeoutMs: number;
  timeoutErrorMessage: string;
  isSuccess: (ack: TAck) => ack is TSuccessAck;
  getErrorMessage: (ack: TAck) => string;
  onTimeout?: () => void;
  onFailureAck?: (ack: TAck) => void;
};

export function emitWithAckTimeout<TAck, TSuccessAck extends TAck>({
  socket,
  event,
  payload,
  timeoutMs,
  timeoutErrorMessage,
  isSuccess,
  getErrorMessage,
  onTimeout,
  onFailureAck,
}: EmitWithAckTimeoutParams<TAck, TSuccessAck>): Promise<TSuccessAck> {
  return new Promise<TSuccessAck>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout?.();
      reject(new Error(timeoutErrorMessage));
    }, timeoutMs);

    socket.emit(event, payload, (ack: TAck) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (isSuccess(ack)) {
        resolve(ack);
        return;
      }

      onFailureAck?.(ack);
      reject(new Error(getErrorMessage(ack)));
    });
  });
}
