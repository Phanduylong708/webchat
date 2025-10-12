import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

function HomePage() {
  const { user, logout, loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Welcome to WebChat</h1>
      {user ? (
        <div className="text-center">
          <p className="text-lg mb-2">Hello, {user.username}!</p>
          <p className="text-sm text-gray-600">{user.email}</p>
          <Button variant="destructive" onClick={logout}>
            Logout
          </Button>
        </div>
      ) : (
        <p className="text-lg">Please log in or register to continue.</p>
      )}
    </div>
  );
}

export default HomePage;
