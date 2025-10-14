import SideBar from "@/components/layout/SideBar";
import { useAuth } from "@/hooks/useAuth";
import { Outlet } from "react-router-dom";
function HomePage() {
  const { loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-[minmax(56px,80px)_1fr] h-screen">
      <SideBar />
      <Outlet />
    </div>
  );
}

export default HomePage;
