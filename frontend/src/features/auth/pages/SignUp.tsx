import React from "react";
import { FieldLabel, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/providers/useAuth";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

function SignUp(): React.JSX.Element {
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const { register, error, loading } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await register({ username, email, password });
    if (success) {
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-md">
        <div className="mb-5   text-center">
          <h1 className="text-2xl font-bold">Sign Up</h1>
          <p className="text-sm text-muted-foreground">Create a new account</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              type="text"
              id="username"
              name="username"
              placeholder="Choose a username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field className="mb-3">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              type="password"
              id="password"
              name="password"
              placeholder="Choose a password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button variant="link" asChild className="text-sm mb-0">
            <Link to="/login" className=" ">
              Already have an account? Log in
            </Link>
          </Button>
          <Button type="submit" disabled={loading} className="w-full mt-3">
            {loading ? "Creating..." : "Create Account"}
          </Button>

          {error && <p className="text-destructive text-sm text-center mt-1">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default SignUp;
