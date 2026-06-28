"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { categoryColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
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
  const { resolvedTheme } = useTheme();
  const router = useRouter();

  const isDark = resolvedTheme === "dark";
  const chartGridColor = isDark ? "#334155" : "#E2E8F0";
  const chartTickColor = isDark ? "#94A3B8" : "#64748B";

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

  // Category chart config — stable color per category name
  const categoryChartConfig: ChartConfig = (summary?.by_category ?? []).reduce(
    (acc, c) => ({
      ...acc,
      [c.category]: {
        label: c.category,
        color: categoryColor(c.category),
      },
    }),
    {}
  );

  // Mom chart config
  const momChartConfig: ChartConfig = {
    total: { label: "Spending", color: "#7C3AED" },
  };

  // Area chart config
  const areaChartConfig: ChartConfig = {
    cumulative: { label: "Actual", color: "#7C3AED" },
    pace: { label: "Budget pace", color: "#94A3B8" },
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

  // ── Burn bar color ──────────────────────────────────────────────────────────

  function burnBarColor() {
    if (overBudget) return "bg-red-500";
    if (burnPct > 80) return "bg-amber-500";
    return "bg-emerald-500";
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-foreground tracking-tight">
            Expense Tracker
          </span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            Settings
          </Link>
          <span className="text-border select-none">|</span>
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user.email}
          </span>
          <ThemeToggle />
          <Button size="sm" variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ── Quick Add ── */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            Quick add
          </h2>
          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <Input
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder='e.g. "coffee 120" or "groceries 850 yesterday"'
              className="flex-1"
            />
            <Button type="submit" disabled={quickLoading}>
              {quickLoading ? "Adding…" : "Add"}
            </Button>
          </form>
          {quickSuccess && (
            <p className="mt-2 text-sm text-emerald-600">✓ {quickSuccess}</p>
          )}
          {quickError && (
            <p className="mt-2 text-sm text-destructive">Error: {quickError}</p>
          )}
          {quickResult && !quickSuccess && (
            <div className="mt-2 text-sm text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/50">
              Parsed: {quickResult.description} —{" "}
              {formatCurrency(quickResult.amount, sym)} · {quickResult.category}{" "}
              · {quickResult.date}
            </div>
          )}
        </section>

        {dataLoading && (
          <p className="text-sm text-muted-foreground">Loading data…</p>
        )}
        {dataError && (
          <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
            Error: {dataError}
          </p>
        )}

        {!dataLoading && summary && settings && (
          <>
            {/* ── Budget Burn ── */}
            <Card className="p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Budget — {monthLabel(month)}
                </h2>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    overBudget ? "text-red-600" : "text-foreground"
                  )}
                >
                  {formatCurrency(spent, sym)}
                  {budget > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {formatCurrency(budget, sym)}
                    </span>
                  )}
                </p>
              </div>
              {budget > 0 ? (
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      burnBarColor()
                    )}
                    style={{ width: `${burnPct}%` }}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No budget set —{" "}
                  <Link href="/settings" className="underline text-primary">
                    configure in settings
                  </Link>
                </p>
              )}
              {overBudget && (
                <p className="mt-2 text-sm text-red-600">
                  Over budget by {formatCurrency(spent - budget, sym)}
                </p>
              )}
            </Card>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category donut */}
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  By category
                </h2>
                {summary.by_category.length > 0 ? (
                  <ChartContainer
                    config={categoryChartConfig}
                    className="h-56 w-full"
                  >
                    <PieChart>
                      <Pie
                        data={summary.by_category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="75%"
                      >
                        {summary.by_category.map((entry) => (
                          <Cell
                            key={entry.category}
                            fill={categoryColor(entry.category)}
                            stroke="#fff"
                            strokeWidth={2}
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
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground h-56 flex items-center">
                    No data yet
                  </p>
                )}
              </Card>

              {/* Month-over-month bar */}
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  Month over month
                </h2>
                {summary.month_over_month.length > 0 ? (
                  <ChartContainer
                    config={momChartConfig}
                    className="h-56 w-full"
                  >
                    <BarChart
                      data={summary.month_over_month.slice(-6)}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartGridColor}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: chartTickColor, fontSize: 11 }}
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
                      <Bar
                        dataKey="total"
                        fill="#7C3AED"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground h-56 flex items-center">
                    No data yet
                  </p>
                )}
              </Card>
            </div>

            {/* ── Daily cumulative area chart ── */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">
                Daily cumulative spend
              </h2>
              {budget > 0 && (
                <p className="text-xs text-muted-foreground mb-4">
                  vs budget pace ({formatCurrency(Math.round(dailyBudgetPace), sym)}/day)
                </p>
              )}
              {cumulativeDaily.length > 0 ? (
                <ChartContainer
                  config={areaChartConfig}
                  className="h-48 w-full"
                >
                  <AreaChart
                    data={cumulativeDaily}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="gradCumulativeSpend"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#7C3AED"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="95%"
                          stopColor="#7C3AED"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: chartTickColor, fontSize: 10 }}
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
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#7C3AED"
                      strokeWidth={2.5}
                      fill="url(#gradCumulativeSpend)"
                      dot={false}
                      name="Actual"
                    />
                    {budget > 0 && (
                      <Area
                        type="monotone"
                        dataKey="pace"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="none"
                        dot={false}
                        name="Budget pace"
                      />
                    )}
                  </AreaChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transactions this month
                </p>
              )}
            </Card>

            {/* ── Category Ledger ── */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Category ledger
              </h2>
              {summary.by_category.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Category
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        Amount
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        %
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        Txns
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        Cap
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
                          className="border-border hover:bg-muted/50"
                        >
                          <TableCell className="text-sm text-foreground font-medium flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: categoryColor(cat.category),
                              }}
                            />
                            {cat.category}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-sm tabular-nums text-right font-semibold",
                              overCap ? "text-red-600" : "text-foreground"
                            )}
                          >
                            {formatCurrency(cat.total, sym)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground text-right tabular-nums">
                            {cat.pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground text-right tabular-nums">
                            {cat.count}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {cap != null ? (
                              <span
                                className={
                                  overCap
                                    ? "text-red-600 font-medium"
                                    : "text-muted-foreground"
                                }
                              >
                                {formatCurrency(cap, sym)}
                                {overCap && " ▲"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No categories yet
                </p>
              )}
            </Card>

            {/* ── Recent Activity ── */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Recent activity
              </h2>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Description
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Category
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        Amount
                      </TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className="border-border hover:bg-muted/50"
                      >
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {tx.date}
                        </TableCell>
                        <TableCell className="text-sm text-foreground max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span
                            className="inline-flex items-center gap-1.5 text-muted-foreground"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: categoryColor(tx.category),
                              }}
                            />
                            {tx.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground tabular-nums text-right font-semibold">
                          {formatCurrency(tx.amount, sym)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex gap-1 justify-end">
                            <button
                              onClick={() => openEdit(tx)}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors px-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                            >
                              Delete
                            </button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transactions this month
                </p>
              )}
            </Card>

            {/* ── Spending Insights ── */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Insights
              </h2>
              <ul className="flex flex-col gap-3">
                {biggestCategory && biggestCategory.category && (
                  <li className="text-sm text-foreground">
                    <span className="font-medium">Biggest spend: </span>
                    {biggestCategory.category} at{" "}
                    {formatCurrency(biggestCategory.total, sym)} (
                    {biggestCategory.pct.toFixed(0)}%)
                    {biggestCategory.total > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        — cut 20% → saves{" "}
                        {formatCurrency(biggestCategory.total * 0.2 * 12, sym)}
                        /yr
                      </span>
                    )}
                  </li>
                )}
                {budget > 0 && (
                  <li className="text-sm">
                    <span className="font-medium text-foreground">Pace: </span>
                    <span
                      className={
                        onPace ? "text-emerald-600" : "text-amber-600"
                      }
                    >
                      {onPace
                        ? `On track (expected ${formatCurrency(Math.round(expectedByNow), sym)} by day ${daysElapsed})`
                        : `Running ahead — spent ${formatCurrency(spent, sym)}, expected ${formatCurrency(Math.round(expectedByNow), sym)}`}
                    </span>
                  </li>
                )}
                {discretionary > 0 && (
                  <li className="text-sm text-foreground">
                    <span className="font-medium">Discretionary: </span>
                    {formatCurrency(discretionary, sym)}
                    <span className="text-muted-foreground">
                      {" "}
                      (food + shopping + entertainment)
                    </span>
                  </li>
                )}
                {categoriesOverCap.length > 0 && (
                  <li className="text-sm text-red-600">
                    <span className="font-medium">Over cap: </span>
                    {categoriesOverCap
                      .map(
                        (c) =>
                          `${c.category} (${formatCurrency(c.total, sym)} / ${formatCurrency(settings.category_budgets[c.category] ?? 0, sym)})`
                      )
                      .join(", ")}
                  </li>
                )}
                {spent === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No spending recorded for {monthLabel(month)}
                  </li>
                )}
              </ul>
            </Card>
          </>
        )}
      </main>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit transaction
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Description
              </label>
              <Input
                value={editForm.description ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Amount
              </label>
              <Input
                type="number"
                value={editForm.amount ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    amount: parseFloat(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Category
              </label>
              <Input
                value={editForm.category ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Date
              </label>
              <Input
                type="date"
                value={editForm.date ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            {editForm.notes !== undefined && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <Input
                  value={editForm.notes ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            )}
            {editError && (
              <p className="text-sm text-destructive">Error: {editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTx(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
