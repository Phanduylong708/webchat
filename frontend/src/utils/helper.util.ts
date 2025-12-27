// File for generic/not specific helper functions

// Helper function to format last seen time
export default function formatLastSeen(date: string | null): string {
  if (!date) return "recently";

  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "recently";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Parse peerId to extract userId.
 * PeerId format: "${callId}_${userId}" (e.g., "4e688ed4-bef9-4c01-9fdc-399d70334c71_123")
 *
 * @param peerId - The peer ID string in format "callId_userId"
 * @returns The userId as a number
 */
export function parsePeerId(peerId: string): number {
  const parts = peerId.split("_");
  return parseInt(parts[1], 10);
}
