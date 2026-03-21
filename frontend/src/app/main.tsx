import { StrictMode } from "react";
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
import CallPage from "@/features/call/pages/CallPage";
import WhiteboardTestPage from "@/features/whiteboard/pages/WhiteboardTestPage";
import { queryClient } from "@/lib/queryClient";

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
            <CallPage />
          </ProtectedRoute>
        ),
      },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignUp /> },
      // Dev routes - only accessible in development
      ...(import.meta.env.DEV ? [{ path: "dev/whiteboard", element: <WhiteboardTestPage /> }] : []),
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
