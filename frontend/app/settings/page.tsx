"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="font-mono text-zinc-500 text-sm">authenticating...</p>
      </div>
    );
  }

  if (!user) return null;

  const categoryKeys =
    settings?.categories != null
      ? Object.keys(settings.categories)
      : DEFAULT_CATEGORIES;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← dashboard
          </Link>
          <span className="font-mono text-sm text-zinc-400 tracking-widest uppercase">
            settings
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-600">{user.email}</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        {loadError && (
          <p className="text-xs font-mono text-red-400 border border-red-900 rounded px-3 py-2">
            error: {loadError}
          </p>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* ── General ── */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                general
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  currency symbol
                </label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="₹"
                  maxLength={4}
                  className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono w-24 placeholder:text-zinc-600 focus-visible:ring-zinc-600"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  monthly budget
                </label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="e.g. 30000"
                  className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono w-48 placeholder:text-zinc-600 focus-visible:ring-zinc-600"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Per-category budgets ── */}
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                category caps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono text-zinc-600 mb-4">
                leave blank to skip a category
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {categoryKeys.map((cat) => (
                  <div key={cat} className="flex flex-col gap-1">
                    <label className="text-xs font-mono text-zinc-500">
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
                      className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono placeholder:text-zinc-700 focus-visible:ring-zinc-600 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Save button ── */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-mono text-sm"
            >
              {saving ? "saving..." : "save settings"}
            </Button>
            {saveSuccess && (
              <span className="text-xs font-mono text-emerald-400">
                ✓ saved
              </span>
            )}
            {saveError && (
              <span className="text-xs font-mono text-red-400">
                error: {saveError}
              </span>
            )}
          </div>
        </form>

        {/* ── Telegram Linking ── */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              telegram bot
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs font-mono text-zinc-500">
              link your telegram account to log expenses by sending messages to
              the bot.
            </p>
            <Button
              type="button"
              onClick={handleTelegramLink}
              disabled={telegramLoading}
              variant="outline"
              className="w-fit border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 bg-transparent font-mono text-sm"
            >
              {telegramLoading ? "generating..." : "generate link code"}
            </Button>
            {telegramCode && (
              <div className="border border-zinc-700 rounded-lg p-4 flex flex-col gap-3 bg-zinc-950">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  your code
                </p>
                <p className="font-mono text-lg tracking-[0.25em] text-zinc-100 select-all">
                  {telegramCode}
                </p>
                <p className="text-xs font-mono text-zinc-500 leading-relaxed">
                  open the bot and send:{" "}
                  <span className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">
                    /link {telegramCode}
                  </span>
                </p>
                <p className="text-xs font-mono text-zinc-600">
                  code expires in 10 minutes
                </p>
              </div>
            )}
            {telegramError && (
              <p className="text-xs font-mono text-red-400">
                error: {telegramError}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
