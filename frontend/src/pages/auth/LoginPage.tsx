import React from "react";
import { FieldLabel, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
function LoginPage(): React.JSX.Element {
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { login, error, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await login({ identifier, password });
    if (success) {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-sm text-gray-600">
            Enter your credentials to access
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="identifier">Email or Username</FieldLabel>
            <Input
              type="text"
              id="identifier"
              name="identifier"
              placeholder="Enter your email or username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button
            variant={"link"}
            type="button"
            className="hover:cursor-pointer self-center"
            disabled={loading}
          >
            <Link to="/signup">Don't have an account? Sign up</Link>
          </Button>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>

          {error && (
            <div className="text-red-600 text-sm text-center mt-1">{error}</div>
          )}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
