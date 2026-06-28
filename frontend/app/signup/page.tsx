"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "aws-amplify/auth";
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader className="pb-4">
          <CardTitle className="font-mono text-sm tracking-widest text-zinc-400 uppercase">
            $ expense-tracker --signup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                email
              </label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                confirm password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-red-400 border border-red-900 bg-red-950/30 rounded px-3 py-2">
                error: {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-mono text-sm"
            >
              {loading ? "creating account..." : "create account"}
            </Button>
          </form>

          <p className="mt-4 text-xs font-mono text-zinc-500 border border-zinc-800 rounded px-3 py-2">
            after signup, check your email to verify your account before signing
            in.
          </p>

          <p className="mt-4 text-center text-xs font-mono text-zinc-500">
            have an account?{" "}
            <Link
              href="/login"
              className="text-zinc-300 underline underline-offset-2 hover:text-white"
            >
              sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
