"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

interface Settings {
  currency: string;
  monthly_budget: number;
  category_budgets: Record<string, number>;
  categories?: Record<string, unknown>;
}

interface TelegramLinkResult {
  code: string;
}

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Rent",
  "Education",
  "Travel",
  "Other",
];

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [currency, setCurrency] = useState("₹");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});

  // Telegram state
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Redirect if not authed
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get<Settings>("/settings");
      setSettings(data);
      setCurrency(data.currency ?? "₹");
      setMonthlyBudget(
        data.monthly_budget ? String(data.monthly_budget) : ""
      );
      // Populate category budgets
      const cats =
        data.categories != null
          ? Object.keys(data.categories)
          : DEFAULT_CATEGORIES;
      const cb: Record<string, string> = {};
      for (const cat of cats) {
        cb[cat] = data.category_budgets?.[cat]
          ? String(data.category_budgets[cat])
          : "";
      }
      setCategoryBudgets(cb);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load settings"
      );
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    // Build category_budgets: only include non-empty values
    const cb: Record<string, number> = {};
    for (const [cat, val] of Object.entries(categoryBudgets)) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        cb[cat] = num;
      }
    }

    try {
      await api.patch<Settings>("/settings", {
        currency,
        monthly_budget: monthlyBudget ? parseFloat(monthlyBudget) : null,
        category_budgets: cb,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTelegramLink() {
    setTelegramLoading(true);
    setTelegramCode(null);
    setTelegramError(null);
    try {
      const result = await api.post<TelegramLinkResult>(
        "/settings/telegram/link-code",
        {}
      );
      setTelegramCode(result.code);
    } catch (err: unknown) {
      setTelegramError(
        err instanceof Error ? err.message : "Failed to generate link code"
      );
    } finally {
      setTelegramLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  const categoryKeys =
    settings?.categories != null
      ? Object.keys(settings.categories)
      : DEFAULT_CATEGORIES;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="font-semibold text-foreground">Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user.email}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        {loadError && (
          <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
            Error: {loadError}
          </p>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* ── General ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                General
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Currency symbol
                </label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="₹"
                  maxLength={4}
                  className="w-24"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Monthly budget
                </label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="e.g. 30000"
                  className="w-48"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Per-category budgets ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Category caps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Leave blank to skip a category
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {categoryKeys.map((cat) => (
                  <div key={cat} className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">
                      {cat}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={categoryBudgets[cat] ?? ""}
                      onChange={(e) =>
                        setCategoryBudgets((prev) => ({
                          ...prev,
                          [cat]: e.target.value,
                        }))
                      }
                      placeholder="—"
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Save button ── */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-emerald-600 font-medium">
                ✓ Saved
              </span>
            )}
            {saveError && (
              <span className="text-sm text-destructive">
                Error: {saveError}
              </span>
            )}
          </div>
        </form>

        {/* ── Telegram Linking ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Telegram bot
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Link your Telegram account to log expenses by sending messages to
              the bot.
            </p>
            <Button
              type="button"
              onClick={handleTelegramLink}
              disabled={telegramLoading}
              variant="outline"
              className="w-fit"
            >
              {telegramLoading ? "Generating…" : "Generate link code"}
            </Button>
            {telegramCode && (
              <div className="border border-border rounded-lg p-4 flex flex-col gap-3 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Your code
                </p>
                <p className="font-mono text-2xl tracking-[0.25em] text-foreground font-semibold select-all">
                  {telegramCode}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Open the bot and send:{" "}
                  <span className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono text-sm">
                    /link {telegramCode}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Code expires in 10 minutes
                </p>
              </div>
            )}
            {telegramError && (
              <p className="text-sm text-destructive">
                Error: {telegramError}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
