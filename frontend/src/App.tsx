import { AuthProvider } from "@/contexts/authContext";
import { useAuth } from "@/hooks/useAuth";
import { Outlet } from "react-router-dom";
import React from "react";

function AppContent() {
  const { checkAuth } = useAuth();

  React.useEffect(() => {
    checkAuth();
  }, []);

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
