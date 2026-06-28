"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategorySummary {
  category: string;
  total: number;
  count: number;
  pct: number;
}

interface DailyEntry {
  date: string;
  total: number;
}

interface MonthOverMonth {
  month: string;
  total: number;
}

interface Summary {
  total_expense: number;
  by_category: CategorySummary[];
  daily: DailyEntry[];
  month_over_month: MonthOverMonth[];
}

interface Settings {
  currency: string;
  monthly_budget: number;
  category_budgets: Record<string, number>;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

interface QuickAddResult {
  description: string;
  amount: number;
  category: string;
  date: string;
  id?: string;
}

// ── Palette for charts ─────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#d4d4d8",
  "#e4e4e7",
  "#18181b",
  "#f4f4f5",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", {
    month: "short",
    year: "2-digit",
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Quick-add state
  const [quickText, setQuickText] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<QuickAddResult | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);

  // Edit dialog state
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Redirect if not authed
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [summaryData, settingsData, txData] = await Promise.all([
        api.get<Summary>(`/transactions/summary?month=${month}`),
        api.get<Settings>("/settings"),
        api.get<Transaction[]>(`/transactions?limit=10&month=${month}`),
      ]);
      setSummary(summaryData);
      setSettings(settingsData);
      setTransactions(txData);
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickText.trim()) return;
    setQuickLoading(true);
    setQuickResult(null);
    setQuickError(null);
    setQuickSuccess(null);

    try {
      const result = await api.post<QuickAddResult>(
        "/transactions/quick-add",
        { text: quickText }
      );
      setQuickResult(result);
      setQuickText("");
      setQuickSuccess(
        `Added: ${result.description} — ${formatCurrency(result.amount, settings?.currency ?? "₹")}`
      );
      loadData();
    } catch (err: unknown) {
      setQuickError(
        err instanceof Error ? err.message : "Failed to add transaction"
      );
    } finally {
      setQuickLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      loadData();
    } catch {
      // silently fail — user can retry
    }
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setEditForm({ ...tx });
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editTx) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const updated = await api.patch<Transaction>(
        `/transactions/${editTx.id}`,
        editForm
      );
      setTransactions((prev) =>
        prev.map((t) => (t.id === editTx.id ? updated : t))
      );
      setEditTx(null);
      loadData();
    } catch (err: unknown) {
      setEditError(
        err instanceof Error ? err.message : "Failed to save changes"
      );
    } finally {
      setEditLoading(false);
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const sym = settings?.currency ?? "₹";
  const budget = settings?.monthly_budget ?? 0;
  const spent = summary?.total_expense ?? 0;
  const burnPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const overBudget = budget > 0 && spent > budget;

  // Daily cumulative + budget pace
  const daysInMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  })();
  const dailyBudgetPace = budget / daysInMonth;

  const cumulativeDaily = (() => {
    if (!summary?.daily) return [];
    let cum = 0;
    const entries = [...summary.daily].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    return entries.map((d, i) => {
      cum += d.total;
      const dayNum = i + 1;
      return {
        date: d.date.slice(5),
        cumulative: cum,
        pace: Math.round(dailyBudgetPace * dayNum),
      };
    });
  })();

  // Category chart config
  const categoryChartConfig: ChartConfig = (summary?.by_category ?? []).reduce(
    (acc, c, i) => ({
      ...acc,
      [c.category]: {
        label: c.category,
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    }),
    {}
  );

  // Mom chart config
  const momChartConfig: ChartConfig = {
    total: { label: "Spending", color: "#a1a1aa" },
  };

  // Line chart config
  const lineChartConfig: ChartConfig = {
    cumulative: { label: "Actual", color: "#a1a1aa" },
    pace: { label: "Budget pace", color: "#3f3f46" },
  };

  // Insights
  const biggestCategory = summary?.by_category.reduce(
    (a, b) => (b.total > a.total ? b : a),
    { category: "", total: 0, count: 0, pct: 0 }
  );
  const discretionary = (summary?.by_category ?? [])
    .filter((c) =>
      ["food", "shopping", "entertainment"].includes(c.category.toLowerCase())
    )
    .reduce((s, c) => s + c.total, 0);
  const daysElapsed = (() => {
    const today = new Date();
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    if (today < monthStart) return 0;
    const diff = Math.floor(
      (today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    return Math.min(diff, daysInMonth);
  })();
  const expectedByNow = budget > 0 ? (budget / daysInMonth) * daysElapsed : 0;
  const onPace = spent <= expectedByNow;

  const categoriesOverCap = (summary?.by_category ?? []).filter(
    (c) =>
      settings?.category_budgets?.[c.category] &&
      c.total > (settings.category_budgets[c.category] ?? 0)
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="font-mono text-zinc-500 text-sm">authenticating...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-zinc-400 tracking-widest uppercase">
            expense-tracker
          </span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            settings
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="text-xs font-mono text-zinc-500">{user.email}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={signOut}
            className="text-xs font-mono border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 bg-transparent"
          >
            sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ── Quick Add ── */}
        <section>
          <p className="text-xs font-mono text-zinc-500 mb-2">
            // quick add transaction
          </p>
          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <Input
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder='e.g. "coffee 120" or "groceries 850 yesterday"'
              className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 font-mono placeholder:text-zinc-600 focus-visible:ring-zinc-600 text-sm"
            />
            <Button
              type="submit"
              disabled={quickLoading}
              className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-mono text-sm px-4"
            >
              {quickLoading ? "..." : "add"}
            </Button>
          </form>
          {quickSuccess && (
            <p className="mt-2 text-xs font-mono text-emerald-400">
              ✓ {quickSuccess}
            </p>
          )}
          {quickError && (
            <p className="mt-2 text-xs font-mono text-red-400">
              error: {quickError}
            </p>
          )}
          {quickResult && !quickSuccess && (
            <div className="mt-2 text-xs font-mono text-zinc-400 border border-zinc-800 rounded px-3 py-2">
              parsed: {quickResult.description} — {formatCurrency(quickResult.amount, sym)} ·{" "}
              {quickResult.category} · {quickResult.date}
            </div>
          )}
        </section>

        {dataLoading && (
          <p className="text-xs font-mono text-zinc-500">loading...</p>
        )}
        {dataError && (
          <p className="text-xs font-mono text-red-400 border border-red-900 rounded px-3 py-2">
            error: {dataError}
          </p>
        )}

        {!dataLoading && summary && settings && (
          <>
            {/* ── Budget Burn Bar ── */}
            <section className="border border-zinc-800 rounded-lg p-5">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  budget burn — {monthLabel(month)}
                </p>
                <p
                  className={cn(
                    "text-sm font-mono tabular-nums",
                    overBudget ? "text-red-400" : "text-zinc-200"
                  )}
                >
                  {formatCurrency(spent, sym)}
                  {budget > 0 && (
                    <span className="text-zinc-500">
                      {" "}
                      / {formatCurrency(budget, sym)}
                    </span>
                  )}
                </p>
              </div>
              {budget > 0 ? (
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overBudget ? "bg-red-500" : "bg-zinc-400"
                    )}
                    style={{ width: `${burnPct}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs font-mono text-zinc-600">
                  no budget set —{" "}
                  <Link href="/settings" className="underline">
                    configure in settings
                  </Link>
                </p>
              )}
              {overBudget && (
                <p className="mt-2 text-xs font-mono text-red-400">
                  over budget by {formatCurrency(spent - budget, sym)}
                </p>
              )}
            </section>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category donut */}
              <section className="border border-zinc-800 rounded-lg p-5">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                  by category
                </p>
                {summary.by_category.length > 0 ? (
                  <ChartContainer
                    config={categoryChartConfig}
                    className="h-48 w-full"
                  >
                    <PieChart>
                      <Pie
                        data={summary.by_category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                      >
                        {summary.by_category.map((entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) =>
                              formatCurrency(Number(value), sym)
                            }
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-xs font-mono text-zinc-600 h-48 flex items-center">
                    no data
                  </p>
                )}
              </section>

              {/* Month-over-month bar */}
              <section className="border border-zinc-800 rounded-lg p-5">
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                  month over month
                </p>
                {summary.month_over_month.length > 0 ? (
                  <ChartContainer
                    config={momChartConfig}
                    className="h-48 w-full"
                  >
                    <BarChart
                      data={summary.month_over_month.slice(-6)}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
                        tickFormatter={monthLabel}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) =>
                              formatCurrency(Number(value), sym)
                            }
                            labelFormatter={monthLabel}
                          />
                        }
                      />
                      <Bar dataKey="total" fill="#71717a" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-xs font-mono text-zinc-600 h-48 flex items-center">
                    no data
                  </p>
                )}
              </section>
            </div>

            {/* Daily burn line chart */}
            <section className="border border-zinc-800 rounded-lg p-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                daily cumulative spend
                {budget > 0 && (
                  <span className="text-zinc-600 ml-2">
                    vs budget pace ({formatCurrency(Math.round(dailyBudgetPace), sym)}/day)
                  </span>
                )}
              </p>
              {cumulativeDaily.length > 0 ? (
                <ChartContainer
                  config={lineChartConfig}
                  className="h-48 w-full"
                >
                  <LineChart
                    data={cumulativeDaily}
                    margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#27272a"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            formatCurrency(Number(value), sym)
                          }
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#a1a1aa"
                      strokeWidth={2}
                      dot={false}
                      name="Actual"
                    />
                    {budget > 0 && (
                      <Line
                        type="monotone"
                        dataKey="pace"
                        stroke="#3f3f46"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Budget pace"
                      />
                    )}
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-xs font-mono text-zinc-600">
                  no transactions this month
                </p>
              )}
            </section>

            {/* ── Category Ledger ── */}
            <section className="border border-zinc-800 rounded-lg p-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                category ledger
              </p>
              {summary.by_category.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase">
                        category
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase text-right">
                        amount
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase text-right">
                        %
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase text-right">
                        txns
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase text-right">
                        cap
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.by_category.map((cat) => {
                      const cap = settings.category_budgets?.[cat.category];
                      const overCap = cap != null && cat.total > cap;
                      return (
                        <TableRow
                          key={cat.category}
                          className="border-zinc-800 hover:bg-zinc-900/50"
                        >
                          <TableCell className="font-mono text-sm text-zinc-200">
                            {cat.category}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "font-mono text-sm tabular-nums text-right",
                              overCap ? "text-red-400" : "text-zinc-200"
                            )}
                          >
                            {formatCurrency(cat.total, sym)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-500 text-right tabular-nums">
                            {cat.pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-500 text-right tabular-nums">
                            {cat.count}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right">
                            {cap != null ? (
                              <span
                                className={
                                  overCap ? "text-red-400" : "text-zinc-600"
                                }
                              >
                                {formatCurrency(cap, sym)}
                                {overCap && " ▲"}
                              </span>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs font-mono text-zinc-600">
                  no categories yet
                </p>
              )}
            </section>

            {/* ── Recent Activity ── */}
            <section className="border border-zinc-800 rounded-lg p-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                recent activity
              </p>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase">
                        date
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase">
                        description
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase">
                        category
                      </TableHead>
                      <TableHead className="text-xs font-mono text-zinc-500 uppercase text-right">
                        amount
                      </TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className="border-zinc-800 hover:bg-zinc-900/50"
                      >
                        <TableCell className="font-mono text-xs text-zinc-500 tabular-nums">
                          {tx.date}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-200 max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">
                          {tx.category}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-200 tabular-nums text-right">
                          {formatCurrency(tx.amount, sym)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex gap-1 justify-end">
                            <button
                              onClick={() => openEdit(tx)}
                              className="text-xs font-mono text-zinc-600 hover:text-zinc-300 px-1"
                            >
                              edit
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="text-xs font-mono text-zinc-700 hover:text-red-400 px-1"
                            >
                              del
                            </button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs font-mono text-zinc-600">
                  no transactions this month
                </p>
              )}
            </section>

            {/* ── Spending Insights ── */}
            <section className="border border-zinc-800 rounded-lg p-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-4">
                insights
              </p>
              <ul className="flex flex-col gap-3">
                {biggestCategory && biggestCategory.category && (
                  <li className="text-sm font-mono text-zinc-300">
                    <span className="text-zinc-500">biggest: </span>
                    {biggestCategory.category} at{" "}
                    {formatCurrency(biggestCategory.total, sym)} (
                    {biggestCategory.pct.toFixed(0)}%)
                    {biggestCategory.total > 0 && (
                      <span className="text-zinc-500">
                        {" "}
                        — cut 20% → saves{" "}
                        {formatCurrency(biggestCategory.total * 0.2 * 12, sym)}
                        /yr
                      </span>
                    )}
                  </li>
                )}
                {budget > 0 && (
                  <li className="text-sm font-mono">
                    <span className="text-zinc-500">pace: </span>
                    <span className={onPace ? "text-emerald-400" : "text-amber-400"}>
                      {onPace
                        ? `on track (expected ${formatCurrency(Math.round(expectedByNow), sym)} by day ${daysElapsed})`
                        : `running ahead — spent ${formatCurrency(spent, sym)}, expected ${formatCurrency(Math.round(expectedByNow), sym)}`}
                    </span>
                  </li>
                )}
                {discretionary > 0 && (
                  <li className="text-sm font-mono text-zinc-300">
                    <span className="text-zinc-500">discretionary load: </span>
                    {formatCurrency(discretionary, sym)}
                    <span className="text-zinc-500"> (food + shopping + entertainment)</span>
                  </li>
                )}
                {categoriesOverCap.length > 0 && (
                  <li className="text-sm font-mono text-red-400">
                    over cap:{" "}
                    {categoriesOverCap
                      .map(
                        (c) =>
                          `${c.category} (${formatCurrency(c.total, sym)} / ${formatCurrency(settings.category_budgets[c.category] ?? 0, sym)})`
                      )
                      .join(", ")}
                  </li>
                )}
                {spent === 0 && (
                  <li className="text-xs font-mono text-zinc-600">
                    no spending recorded for {monthLabel(month)}
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </main>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-zinc-300">
              edit transaction
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500">
                description
              </label>
              <Input
                value={editForm.description ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500">amount</label>
              <Input
                type="number"
                value={editForm.amount ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    amount: parseFloat(e.target.value),
                  }))
                }
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500">category</label>
              <Input
                value={editForm.category ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-500">date</label>
              <Input
                type="date"
                value={editForm.date ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, date: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono"
              />
            </div>
            {editForm.notes !== undefined && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-500">notes</label>
                <Input
                  value={editForm.notes ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="bg-zinc-950 border-zinc-700 text-zinc-100 font-mono"
                />
              </div>
            )}
            {editError && (
              <p className="text-xs font-mono text-red-400">error: {editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTx(null)}
              className="font-mono text-xs border-zinc-700 text-zinc-400 bg-transparent hover:text-zinc-100"
            >
              cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editLoading}
              className="font-mono text-xs bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
            >
              {editLoading ? "saving..." : "save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
