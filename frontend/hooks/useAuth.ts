"use client";

import { useState, useEffect } from "react";
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplify";

configureAmplify();

interface AuthUser {
  username: string;
  email: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      try {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken;
        const email =
          (idToken?.payload?.email as string | undefined) ??
          currentUser.username;

        if (!cancelled) {
          setUser({ username: currentUser.username, email });
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkUser();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    try {
      await amplifySignOut();
    } finally {
      setUser(null);
    }
  }

  return { user, loading, signOut };
}
