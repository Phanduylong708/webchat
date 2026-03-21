import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/features/auth/providers/useAuth";
import { Outlet } from "react-router-dom";
function HomePage() {
  const { loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-[minmax(56px,80px)_minmax(0,1fr)] h-screen">
      <Sidebar />
      <Outlet />
    </div>
  );
}

export default HomePage;
