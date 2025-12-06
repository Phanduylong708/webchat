import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage.tsx";
import SignUp from "./pages/auth/SignUp.tsx";
import HomePage from "./pages/home/HomePage.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import FriendsPage from "./pages/home/FriendsPage.tsx";
import ChatPage from "./pages/chat/ChatPage.tsx";
import CallPage from "./pages/call/CallPage.tsx";

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
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
