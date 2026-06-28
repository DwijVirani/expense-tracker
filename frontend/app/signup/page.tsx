"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "aws-amplify/auth";
import "@/lib/amplify";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
        },
      });
      router.push("/login?verified=pending");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-foreground">
            Create account
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Start tracking your expenses
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Confirm password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/50">
            After signup, check your email to verify your account before signing in.
          </p>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Have an account?{" "}
            <Link
              href="/login"
              className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
