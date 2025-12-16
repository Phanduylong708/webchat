import { createContext } from "react";
import type { MediaContextValue } from "@/types/media.type";

export const MediaContext = createContext<MediaContextValue | null>(null);
