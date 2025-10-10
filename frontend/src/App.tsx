import { AuthProvider } from "@/contexts/authContext";
import { useAuth } from "@/hooks/useAuth";
import React from "react";

function TestAuth() {
  const { user, loading, error, checkAuth, login } = useAuth();

  // Log để xem state
  console.log("Auth State:", { user, loading, error });

  // Test checkAuth on mount
  React.useEffect(() => {
    checkAuth();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Auth Test</h1>
      <p>Loading: {loading ? "Yes" : "No"}</p>
      <p>User: {user ? user.username : "Not logged in"}</p>
      <p>Error: {error || "None"}</p>
      <button
        type="button"
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() =>
          login({ identifier: "phanduylong708@gmail.com", password: "adu115" })
        }
      >
        Test Login
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TestAuth />
    </AuthProvider>
  );
}
