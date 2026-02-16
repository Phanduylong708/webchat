import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { getOptimizedAvatarUrl } from "@/utils/image.util";

interface StackedAvatarUser {
  id: number;
  username: string;
  avatar: string | null;
}

interface StackedAvatarsProps {
  /** Array of users whose avatars will be stacked */
  users: StackedAvatarUser[];
  /** Max number of avatars to display (default: 3) */
  max?: number;
  /** Individual avatar diameter in px (default: 28) */
  size?: number;
  /** Horizontal overlap offset in px (default: 10) */
  overlap?: number;
}

/**
 * Renders overlapping stacked avatars for group conversations.
 *
 * Each subsequent avatar is offset to the right, creating a cluster
 * that instantly communicates "group" visually.
 */
export function StackedAvatars({ users, max = 3, size = 28, overlap = 10 }: StackedAvatarsProps) {
  const visible = users.slice(0, max);
  const width = (visible.length - 1) * overlap + size;

  if (visible.length === 0) return null;

  return (
    <div className="relative shrink-0" style={{ width: `${width}px`, height: `${size}px` }}>
      {visible.map((user, i) => (
        <Avatar
          key={user.id}
          className="absolute border-2 border-background"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${i * overlap}px`,
            zIndex: max - i,
          }}
        >
          <AvatarImage src={getOptimizedAvatarUrl(user.avatar, size)} />
          <AvatarFallback className="text-[10px]">{user.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
