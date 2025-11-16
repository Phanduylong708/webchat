import type { AuthContextType } from "@/types/auth.type";
import { AuthContext } from "@/contexts/authContext";
import React from "react";

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
