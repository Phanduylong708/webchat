import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "@/features/auth/pages/LoginPage";
import SignUp from "@/features/auth/pages/SignUp";
import HomePage from "@/pages/home/HomePage";
import ProtectedRoute from "@/app/ProtectedRoute";
import FriendsPage from "@/features/friends/pages/FriendsPage";
import ChatPage from "@/pages/chat/ChatPage";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const CallPage = lazy(() => import("@/features/call/pages/CallPage"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "",
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/friends" replace />,
          },
          {
            path: "friends",
            element: <FriendsPage />,
          },
          { path: "chat", element: <ChatPage /> },
        ],
      },
      {
        path: "call/:callId",
        element: (
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <CallPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignUp /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
