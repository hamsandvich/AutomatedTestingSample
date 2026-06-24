"use client";

import Link from "next/link";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  LayoutDashboard,
  ListTodo,
  Moon,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { TodoPayload, TodoState } from "@/lib/todo-utils";

type View = "home" | "stats" | "calendar";
type Priority = "LOW" | "MEDIUM" | "HIGH";
type TodoInput = {
  title: string;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  category: string;
  notes: string;
};

type DashboardProps = {
  initialTodos: TodoPayload[];
  initialView: View;
};

const nav = [
  { href: "/", label: "Today", icon: LayoutDashboard, view: "home" as const },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, view: "calendar" as const },
  { href: "/stats", label: "Stats", icon: Target, view: "stats" as const },
];

const encouragements = [
  "Tiny progress is still progress.",
  "Make room for the important things.",
  "One clear task can change a whole day.",
  "Your future self is already cheering.",
  "Start small. Stay kind. Keep going.",
];

const priorityMeta: Record<Priority, { label: string; className: string; dot: string }> = {
  HIGH: { label: "High", className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900", dot: "bg-rose-500" },
  MEDIUM: { label: "Medium", className: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", dot: "bg-amber-500" },
  LOW: { label: "Low", className: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900", dot: "bg-sky-500" },
};

function localDateKey(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

function stateFor(todo: Pick<TodoPayload, "completed" | "dueDate" | "dueTime">): TodoState {
  if (todo.completed) return "completed";
  const due = new Date(`${todo.dueDate}T${todo.dueTime || "23:59"}:59`);
  return due.getTime() < Date.now() ? "missed" : "pending";
}

function todoSort(a: TodoPayload, b: TodoPayload) {
  return `${a.dueDate}T${a.dueTime || "23:59"}`.localeCompare(`${b.dueDate}T${b.dueTime || "23:59"}`);
}

function prettyTime(time: string | null) {
  if (!time) return "Any time";
  return format(parseISO(`2000-01-01T${time}`), "h:mm a");
}

function dateFromKey(key: string) {
  return parseISO(`${key}T12:00:00`);
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Dashboard({ initialTodos, initialView }: DashboardProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [dark, setDark] = useState(false);
  const [dialogTodo, setDialogTodo] = useState<TodoPayload | null | "new">(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TodoState>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDate, setQuickDate] = useState(localDateKey());
  const [quickSaving, setQuickSaving] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");

  useEffect(() => {
    const saved = window.localStorage.getItem("daymark-theme");
    const useDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(useDark);
    document.documentElement.classList.toggle("dark", useDark);
  }, []);

  useEffect(() => {
    if (!toast && !error) return;
    const timer = window.setTimeout(() => {
      setToast(null);
      setError(null);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [toast, error]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("daymark-theme", next ? "dark" : "light");
  };

  const categories = useMemo(
    () => Array.from(new Set(todos.map((todo) => todo.category).filter((category): category is string => Boolean(category)))).sort(),
    [todos],
  );

  const filteredTodos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return todos.filter((todo) => {
      const todoState = stateFor(todo);
      return (
        (!query || `${todo.title} ${todo.category || ""} ${todo.notes || ""}`.toLowerCase().includes(query)) &&
        (statusFilter === "all" || todoState === statusFilter) &&
        (priorityFilter === "all" || todo.priority === priorityFilter) &&
        (categoryFilter === "all" || todo.category === categoryFilter)
      );
    });
  }, [todos, search, statusFilter, priorityFilter, categoryFilter]);

  const updateTodo = async (id: string, updates: Partial<TodoInput> & { completed?: boolean }) => {
    setError(null);
    const response = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not update that todo.");
    setTodos((current) => current.map((todo) => (todo.id === id ? result : todo)).sort(todoSort));
    return result as TodoPayload;
  };

  const saveTodo = async (values: TodoInput, id?: string) => {
    try {
      if (id) await updateTodo(id, values);
      else {
        const response = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not create that todo.");
        setTodos((current) => [...current, result as TodoPayload].sort(todoSort));
      }
      setDialogTodo(null);
      setToast(id ? "Todo updated." : "Todo added to your day.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Something went wrong.");
      throw saveError;
    }
  };

  const completeTodo = async (todo: TodoPayload) => {
    try {
      const becameComplete = !todo.completed;
      await updateTodo(todo.id, { completed: becameComplete });
      setToast(becameComplete ? "Nice work — task completed!" : "Todo moved back to your list.");
      if (becameComplete) {
        setCelebrating(true);
        window.setTimeout(() => setCelebrating(false), 1000);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update that todo.");
    }
  };

  const deleteTodo = async (todo: TodoPayload) => {
    if (!window.confirm(`Delete “${todo.title}”? This can’t be undone.`)) return;
    try {
      const response = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete that todo.");
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      setToast("Todo deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete that todo.");
    }
  };

  const quickAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!quickTitle.trim()) {
      setError("Give your todo a short title first.");
      return;
    }
    setQuickSaving(true);
    try {
      await saveTodo({ title: quickTitle, dueDate: quickDate, dueTime: "", priority: "MEDIUM", category: "", notes: "" });
      setQuickTitle("");
    } finally {
      setQuickSaving(false);
    }
  };

  const rescheduleTodo = async (todoId: string, dueDate: string) => {
    try {
      await updateTodo(todoId, { dueDate });
      setToast("Todo rescheduled.");
    } catch (rescheduleError) {
      setError(rescheduleError instanceof Error ? rescheduleError.message : "Could not reschedule that todo.");
    }
  };

  const renderView = () => {
    if (initialView === "stats") return <StatsView todos={todos} />;
    if (initialView === "calendar") {
      return (
        <CalendarView
          todos={filteredTodos}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          date={calendarDate}
          onDateChange={setCalendarDate}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          onEdit={setDialogTodo}
          onComplete={completeTodo}
          onDelete={deleteTodo}
          onReschedule={rescheduleTodo}
        />
      );
    }
    return (
      <HomeView
        todos={filteredTodos}
        quickTitle={quickTitle}
        quickDate={quickDate}
        quickSaving={quickSaving}
        onQuickTitleChange={setQuickTitle}
        onQuickDateChange={setQuickDate}
        onQuickAdd={quickAdd}
        onOpenNew={() => setDialogTodo("new")}
        onEdit={setDialogTodo}
        onComplete={completeTodo}
        onDelete={deleteTodo}
      />
    );
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      {celebrating && <Confetti />}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
        <header className="surface mb-6 flex flex-col gap-4 rounded-2xl border px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link href="/" className="flex items-center gap-3 self-start sm:self-auto" aria-label="Daymark home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"><CheckCircle2 size={21} strokeWidth={2.6} /></span>
            <span><span className="block text-base font-bold tracking-tight text-main">Daymark</span><span className="block text-[11px] font-medium text-muted">Make today count</span></span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto rounded-xl muted-surface p-1" aria-label="Primary navigation">
            {nav.map(({ href, label, icon: Icon, view }) => (
              <Link key={href} href={href} className={classNames("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition", initialView === view ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-muted hover:text-main")}>
                <Icon size={16} /> {label}
              </Link>
            ))}
          </nav>
          <button type="button" onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center self-end rounded-xl border border-theme text-muted transition hover:bg-[var(--surface-muted)] hover:text-main sm:self-auto" aria-label="Toggle dark mode">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <section className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="form-control pl-10" placeholder="Search tasks, notes, or categories" aria-label="Search todos" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TodoState)} className="form-control w-auto py-2 text-sm" aria-label="Filter by status">
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="missed">Missed</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "all" | Priority)} className="form-control w-auto py-2 text-sm" aria-label="Filter by priority">
              <option value="all">All priorities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="form-control w-auto max-w-40 py-2 text-sm" aria-label="Filter by category">
              <option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </section>

        {toast && <Notice tone="success" onDismiss={() => setToast(null)}>{toast}</Notice>}
        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {renderView()}
      </div>

      {dialogTodo && <TodoModal todo={dialogTodo === "new" ? undefined : dialogTodo} onClose={() => setDialogTodo(null)} onSave={saveTodo} />}
    </main>
  );
}

function HomeView({ todos, quickTitle, quickDate, quickSaving, onQuickTitleChange, onQuickDateChange, onQuickAdd, onOpenNew, onEdit, onComplete, onDelete }: {
  todos: TodoPayload[];
  quickTitle: string;
  quickDate: string;
  quickSaving: boolean;
  onQuickTitleChange: (value: string) => void;
  onQuickDateChange: (value: string) => void;
  onQuickAdd: (event: FormEvent) => void;
  onOpenNew: () => void;
  onEdit: (todo: TodoPayload) => void;
  onComplete: (todo: TodoPayload) => void;
  onDelete: (todo: TodoPayload) => void;
}) {
  const today = localDateKey();
  const todayTodos = todos.filter((todo) => todo.dueDate === today && stateFor(todo) !== "missed");
  const overdueTodos = todos.filter((todo) => stateFor(todo) === "missed");
  const upcomingTodos = todos.filter((todo) => todo.dueDate > today && stateFor(todo) !== "completed");
  const message = encouragements[new Date().getDate() % encouragements.length];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 px-5 py-6 text-white shadow-lg shadow-indigo-500/20 sm:px-7 sm:py-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-sm font-medium text-indigo-100">{format(new Date(), "EEEE, MMMM d")}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your day, clearly.</h1><p className="mt-2 max-w-lg text-sm leading-6 text-indigo-100">{message}</p></div>
            <button type="button" onClick={onOpenNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Plus size={17} /> New todo</button>
          </div>
        </section>

        <section className="surface rounded-2xl border p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Plus size={17} /></span><div><h2 className="font-bold text-main">Quick add</h2><p className="text-xs text-muted">Capture it now; add the details later.</p></div></div>
          <form onSubmit={onQuickAdd} className="flex flex-col gap-2 sm:flex-row">
            <input value={quickTitle} onChange={(event) => onQuickTitleChange(event.target.value)} className="form-control min-w-0 flex-1" placeholder="What needs your attention?" maxLength={160} />
            <input type="date" value={quickDate} onChange={(event) => onQuickDateChange(event.target.value)} className="form-control sm:w-40" aria-label="Quick todo due date" />
            <button disabled={quickSaving} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"><Plus size={17} /> {quickSaving ? "Adding…" : "Add"}</button>
          </form>
        </section>

        <TodoSection title="Due today" subtitle="Keep the next right thing in view." icon={<ListTodo size={18} />} tone="indigo" todos={todayTodos} empty="Nothing due today. A little breathing room is a valid plan." onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
        <TodoSection title="Overdue" subtitle="No guilt—just a gentle nudge to decide what’s next." icon={<AlertTriangle size={18} />} tone="rose" todos={overdueTodos} empty="No overdue tasks. Nicely held." onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
        <TodoSection title="Coming up" subtitle="A glimpse ahead, without crowding today." icon={<CalendarDays size={18} />} tone="sky" todos={upcomingTodos.slice(0, 8)} empty="Your upcoming list is clear." onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
      </div>
      <aside className="space-y-5">
        <DailySummary todos={todos} />
        <section className="surface rounded-2xl border p-5 shadow-soft"><div className="mb-3 flex items-center gap-2 text-main"><Sparkles className="text-amber-500" size={18} /><h2 className="font-bold">A kinder plan</h2></div><p className="text-sm leading-6 text-muted">If a task is no longer useful, reschedule it or let it go. Your list is a tool, not a scorecard.</p></section>
      </aside>
    </div>
  );
}

function TodoSection({ title, subtitle, icon, tone, todos, empty, onEdit, onComplete, onDelete }: {
  title: string; subtitle: string; icon: React.ReactNode; tone: "indigo" | "rose" | "sky"; todos: TodoPayload[]; empty: string; onEdit: (todo: TodoPayload) => void; onComplete: (todo: TodoPayload) => void; onDelete: (todo: TodoPayload) => void;
}) {
  const backgrounds = { indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300", rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300", sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300" };
  return <section className="surface rounded-2xl border p-4 shadow-soft sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-center gap-2.5"><span className={classNames("flex h-8 w-8 items-center justify-center rounded-lg", backgrounds[tone])}>{icon}</span><div><h2 className="font-bold text-main">{title} <span className="ml-1 text-sm font-medium text-muted">{todos.length}</span></h2><p className="text-xs text-muted">{subtitle}</p></div></div></div>{todos.length ? <div className="space-y-2">{todos.map((todo) => <TodoRow key={todo.id} todo={todo} onEdit={() => onEdit(todo)} onComplete={() => onComplete(todo)} onDelete={() => onDelete(todo)} />)}</div> : <EmptyState message={empty} />}</section>;
}

function TodoRow({ todo, onEdit, onComplete, onDelete, compact = false, draggable = false }: { todo: TodoPayload; onEdit: () => void; onComplete: () => void; onDelete: () => void; compact?: boolean; draggable?: boolean }) {
  const state = stateFor(todo);
  const stateStyle = state === "completed" ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20" : state === "missed" ? "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20" : "border-theme bg-[var(--surface)]";
  return (
    <article draggable={draggable} onDragStart={(event) => { event.dataTransfer.setData("text/plain", todo.id); event.dataTransfer.effectAllowed = "move"; }} className={classNames("group flex gap-3 rounded-xl border p-3 transition hover:-translate-y-px hover:shadow-sm", stateStyle, draggable && "cursor-grab active:cursor-grabbing")}> 
      <button type="button" onClick={onComplete} className={classNames("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition", todo.completed ? "border-emerald-500 bg-emerald-500 text-white" : state === "missed" ? "border-rose-400 hover:border-emerald-500" : "border-slate-300 hover:border-indigo-500 dark:border-slate-600")} aria-label={todo.completed ? "Mark todo incomplete" : "Mark todo complete"}>{todo.completed && <Check size={13} strokeWidth={3} />}</button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start gap-x-2 gap-y-1"><h3 className={classNames("min-w-0 flex-1 text-sm font-semibold text-main", todo.completed && "text-muted line-through")}>{todo.title}</h3><PriorityBadge priority={todo.priority} /></div>{!compact && todo.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{todo.notes}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><span className={classNames("inline-flex items-center gap-1", state === "missed" && "font-semibold text-rose-600 dark:text-rose-300")}><Clock3 size={13} /> {todo.dueDate === localDateKey() ? "Today" : format(dateFromKey(todo.dueDate), "MMM d")} · {prettyTime(todo.dueTime)}</span>{todo.category && <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 font-medium">{todo.category}</span>}{state === "missed" && <span className="font-semibold text-rose-600 dark:text-rose-300">Overdue</span>}</div></div>
      <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><button type="button" onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-[var(--surface-muted)] hover:text-indigo-600" aria-label={`Edit ${todo.title}`}><Pencil size={14} /></button><button type="button" onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" aria-label={`Delete ${todo.title}`}><Trash2 size={14} /></button></div>
    </article>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) { const meta = priorityMeta[priority]; return <span className={classNames("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset", meta.className)}><span className={classNames("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}</span>; }

function EmptyState({ message }: { message: string }) { return <div className="rounded-xl border border-dashed border-theme px-4 py-7 text-center text-sm text-muted"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={22} />{message}</div>; }

function DailySummary({ todos }: { todos: TodoPayload[] }) {
  const today = localDateKey();
  const dueToday = todos.filter((todo) => todo.dueDate === today);
  const completed = dueToday.filter((todo) => todo.completed).length;
  const percent = dueToday.length ? Math.round((completed / dueToday.length) * 100) : 0;
  return <section className="surface rounded-2xl border p-5 shadow-soft"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold text-main">Today’s rhythm</p><p className="text-xs text-muted">{completed} of {dueToday.length} due tasks finished</p></div><span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${percent}%` }} /></div><div className="mt-5 grid grid-cols-3 divide-x divide-[var(--border)] text-center"><div><p className="text-lg font-bold text-main">{todos.filter((todo) => stateFor(todo) === "pending").length}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Open</p></div><div><p className="text-lg font-bold text-emerald-600">{todos.filter((todo) => todo.completed).length}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Done</p></div><div><p className="text-lg font-bold text-rose-600">{todos.filter((todo) => stateFor(todo) === "missed").length}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Missed</p></div></div></section>;
}

function StatsView({ todos }: { todos: TodoPayload[] }) {
  const completed = todos.filter((todo) => todo.completed);
  const missed = todos.filter((todo) => stateFor(todo) === "missed");
  const completionRate = todos.length ? Math.round((completed.length / todos.length) * 100) : 0;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const completedThisWeek = completed.filter((todo) => todo.completedAt && new Date(todo.completedAt) >= weekStart).length;
  const missedThisWeek = missed.filter((todo) => dateFromKey(todo.dueDate) >= weekStart).length;
  const completionDays = new Set(completed.filter((todo) => todo.completedAt).map((todo) => localDateKey(new Date(todo.completedAt!))));
  let currentStreak = 0;
  let cursor = new Date();
  while (completionDays.has(localDateKey(cursor))) { currentStreak += 1; cursor = subDays(cursor, 1); }
  const sortedDays = [...completionDays].sort();
  let bestStreak = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sortedDays) { const current = dateFromKey(key); if (previous && localDateKey(addDays(previous, 1)) === key) run += 1; else run = 1; bestStreak = Math.max(bestStreak, run); previous = current; }
  const weekly = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).map((day) => ({ label: format(day, "EEE"), count: completed.filter((todo) => todo.completedAt && isSameDay(new Date(todo.completedAt), day)).length, isToday: isSameDay(day, new Date()) }));
  const maxWeekly = Math.max(...weekly.map((day) => day.count), 1);
  return <div className="space-y-6"><section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-7 text-white shadow-xl sm:px-8"><p className="text-sm font-medium text-slate-300">Your momentum</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Progress with perspective.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Celebrate follow-through, then use the patterns to make a more humane plan for tomorrow.</p></section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Completed" value={completed.length} hint="All time" icon={<CheckCircle2 />} color="emerald" /><StatCard label="Missed" value={missed.length} hint="Needs a new plan" icon={<AlertTriangle />} color="rose" /><StatCard label="Completion rate" value={`${completionRate}%`} hint="Across all tasks" icon={<Target />} color="indigo" /><StatCard label="Current streak" value={`${currentStreak} day${currentStreak === 1 ? "" : "s"}`} hint={`Best: ${bestStreak} day${bestStreak === 1 ? "" : "s"}`} icon={<Flame />} color="amber" /></div><div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]"><section className="surface rounded-2xl border p-5 shadow-soft sm:p-6"><div className="mb-6 flex items-start justify-between"><div><h2 className="font-bold text-main">Completed this week</h2><p className="mt-1 text-sm text-muted">A small view of your recent rhythm.</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{completedThisWeek}</span></div><div className="flex h-48 items-end justify-between gap-2 sm:gap-4">{weekly.map((day) => <div key={day.label} className="flex h-full flex-1 flex-col justify-end"><div className="group relative flex h-full items-end"><div className={classNames("w-full rounded-t-lg transition-all", day.isToday ? "bg-indigo-500" : "bg-indigo-200 dark:bg-indigo-900")} style={{ height: `${day.count ? Math.max((day.count / maxWeekly) * 100, 12) : 4}%` }} title={`${day.count} completed`} /></div><p className={classNames("mt-2 text-center text-xs font-medium", day.isToday ? "text-indigo-600 dark:text-indigo-300" : "text-muted")}>{day.label}</p><p className="text-center text-xs font-bold text-main">{day.count || "–"}</p></div>)}</div></section><section className="surface rounded-2xl border p-5 shadow-soft sm:p-6"><h2 className="font-bold text-main">This week at a glance</h2><div className="mt-5 space-y-4"><InsightRow label="Finished" value={completedThisWeek} color="emerald" /><InsightRow label="Missed" value={missedThisWeek} color="rose" /><InsightRow label="Still open" value={todos.filter((todo) => stateFor(todo) === "pending").length} color="indigo" /></div><div className="mt-6 rounded-xl bg-[var(--surface-muted)] p-3 text-xs leading-5 text-muted">A missed task is information, not failure. Reschedule it when it still matters.</div></section></div></div>;
}

function StatCard({ label, value, hint, icon, color }: { label: string; value: React.ReactNode; hint: string; icon: React.ReactNode; color: "emerald" | "rose" | "indigo" | "amber" }) { const tones = { emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300", rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300", indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300", amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" }; return <section className="surface rounded-2xl border p-5 shadow-soft"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-main">{value}</p></div><span className={classNames("flex h-10 w-10 items-center justify-center rounded-xl", tones[color])}>{icon}</span></div><p className="mt-3 text-xs text-muted">{hint}</p></section>; }
function InsightRow({ label, value, color }: { label: string; value: number; color: "emerald" | "rose" | "indigo" }) { const dots = { emerald: "bg-emerald-500", rose: "bg-rose-500", indigo: "bg-indigo-500" }; return <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm text-muted"><span className={classNames("h-2.5 w-2.5 rounded-full", dots[color])} />{label}</span><span className="text-lg font-bold text-main">{value}</span></div>; }

function CalendarView({ todos, mode, onModeChange, date, onDateChange, selectedDate, onSelectedDateChange, onEdit, onComplete, onDelete, onReschedule }: {
  todos: TodoPayload[]; mode: "month" | "week"; onModeChange: (mode: "month" | "week") => void; date: Date; onDateChange: (date: Date) => void; selectedDate: string | null; onSelectedDateChange: (date: string | null) => void; onEdit: (todo: TodoPayload) => void; onComplete: (todo: TodoPayload) => void; onDelete: (todo: TodoPayload) => void; onReschedule: (id: string, date: string) => void;
}) {
  const visibleStart = mode === "month" ? startOfWeek(startOfMonth(date), { weekStartsOn: 1 }) : startOfWeek(date, { weekStartsOn: 1 });
  const visibleEnd = mode === "month" ? endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) : endOfWeek(date, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: visibleStart, end: visibleEnd });
  const selectedTodos = selectedDate ? todos.filter((todo) => todo.dueDate === selectedDate) : [];
  const move = (amount: number) => onDateChange(mode === "month" ? addMonths(date, amount) : addDays(date, amount * 7));
  return <div className="space-y-5"><section className="surface rounded-2xl border p-4 shadow-soft sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-muted">Plan ahead</p><h1 className="text-2xl font-bold tracking-tight text-main">{mode === "month" ? format(date, "MMMM yyyy") : `${format(visibleStart, "MMM d")} – ${format(visibleEnd, "MMM d, yyyy")}`}</h1></div><div className="flex items-center justify-between gap-2 sm:justify-end"><div className="flex rounded-lg muted-surface p-1"><button onClick={() => onModeChange("month")} className={classNames("rounded-md px-3 py-1.5 text-sm font-semibold", mode === "month" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-muted")}>Month</button><button onClick={() => onModeChange("week")} className={classNames("rounded-md px-3 py-1.5 text-sm font-semibold", mode === "week" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-muted")}>Week</button></div><button onClick={() => move(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-theme text-muted hover:bg-[var(--surface-muted)]" aria-label="Previous period"><ChevronLeft size={18} /></button><button onClick={() => move(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-theme text-muted hover:bg-[var(--surface-muted)]" aria-label="Next period"><ChevronRight size={18} /></button><button onClick={() => onDateChange(new Date())} className="rounded-lg border border-theme px-3 py-2 text-sm font-semibold text-muted hover:bg-[var(--surface-muted)]">Today</button></div></div></section><section className="surface overflow-hidden rounded-2xl border shadow-soft"><div className="grid grid-cols-7 border-b border-theme bg-[var(--surface-muted)]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted sm:px-3 sm:text-xs">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => { const key = localDateKey(day); const dayTodos = todos.filter((todo) => todo.dueDate === key); const isCurrentMonth = day.getMonth() === date.getMonth(); const isToday = isSameDay(day, new Date()); return <button key={key} type="button" onClick={() => onSelectedDateChange(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const todoId = event.dataTransfer.getData("text/plain"); if (todoId) onReschedule(todoId, key); }} className={classNames("calendar-cell relative overflow-hidden border-b border-r border-theme p-1.5 text-left transition hover:bg-[var(--surface-muted)] sm:p-2", mode === "month" && !isCurrentMonth && "opacity-45", selectedDate === key && "bg-indigo-50/60 dark:bg-indigo-950/20")}><span className={classNames("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", isToday ? "bg-indigo-600 text-white" : "text-main")}>{format(day, "d")}</span><div className="space-y-1">{dayTodos.slice(0, 3).map((todo) => <CalendarChip key={todo.id} todo={todo} />)}{dayTodos.length > 3 && <span className="block text-[10px] font-semibold text-muted">+{dayTodos.length - 3} more</span>}</div></button>; })}</div></section><div className="flex flex-wrap items-center gap-3 text-xs text-muted"><span className="font-semibold">Legend</span><Legend dot="bg-indigo-500" label="Pending" /><Legend dot="bg-emerald-500" label="Completed" /><Legend dot="bg-rose-500" label="Missed" /><Legend dot="bg-rose-400 ring-2 ring-rose-200" label="High priority" /><span className="ml-auto hidden text-xs sm:inline">Drag a task onto another day to reschedule it.</span></div>{selectedDate && <section className="surface animate-pop-in rounded-2xl border p-4 shadow-soft sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Selected day</p><h2 className="text-lg font-bold text-main">{format(dateFromKey(selectedDate), "EEEE, MMMM d")}</h2></div><button onClick={() => onSelectedDateChange(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[var(--surface-muted)]" aria-label="Close day details"><X size={18} /></button></div>{selectedTodos.length ? <div className="space-y-2">{selectedTodos.map((todo) => <TodoRow key={todo.id} todo={todo} onEdit={() => onEdit(todo)} onComplete={() => onComplete(todo)} onDelete={() => onDelete(todo)} />)}</div> : <EmptyState message="No tasks are due this day. A good place for a little white space." />}</section>}</div>;
}

function CalendarChip({ todo }: { todo: TodoPayload }) { const state = stateFor(todo); const dot = state === "completed" ? "bg-emerald-500" : state === "missed" ? "bg-rose-500" : todo.priority === "HIGH" ? "bg-rose-400" : "bg-indigo-500"; return <span draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", todo.id); event.dataTransfer.effectAllowed = "move"; event.stopPropagation(); }} onClick={(event) => event.stopPropagation()} className="flex cursor-grab items-center gap-1 truncate rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px] font-semibold text-main active:cursor-grabbing"><span className={classNames("h-1.5 w-1.5 shrink-0 rounded-full", dot)} /> <span className={classNames("truncate", todo.completed && "line-through text-muted")}>{todo.title}</span></span>; }
function Legend({ dot, label }: { dot: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={classNames("h-2 w-2 rounded-full", dot)} />{label}</span>; }

function TodoModal({ todo, onClose, onSave }: { todo?: TodoPayload; onClose: () => void; onSave: (values: TodoInput, id?: string) => Promise<void> }) {
  const [values, setValues] = useState<TodoInput>({ title: todo?.title || "", dueDate: todo?.dueDate || localDateKey(), dueTime: todo?.dueTime || "", priority: todo?.priority || "MEDIUM", category: todo?.category || "", notes: todo?.notes || "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const update = <K extends keyof TodoInput>(key: K, value: TodoInput[K]) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!values.title.trim()) { setFormError("A concise title helps this task stay clear."); return; } setSaving(true); setFormError(null); try { await onSave(values, todo?.id); } catch (error) { setFormError(error instanceof Error ? error.message : "Could not save this todo."); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="todo-dialog-title"><form onSubmit={submit} className="surface animate-pop-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">{todo ? "Refine your plan" : "A fresh task"}</p><h2 id="todo-dialog-title" className="mt-1 text-xl font-bold text-main">{todo ? "Edit todo" : "Create todo"}</h2></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-[var(--surface-muted)]" aria-label="Close dialog"><X size={19} /></button></div>{formError && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{formError}</div>}<div className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">What needs doing?</span><input autoFocus value={values.title} onChange={(event) => update("title", event.target.value)} className="form-control" maxLength={160} placeholder="e.g. Finish homework" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">Due date</span><input type="date" value={values.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="form-control" required /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">Due time <em className="font-normal text-muted">optional</em></span><input type="time" value={values.dueTime} onChange={(event) => update("dueTime", event.target.value)} className="form-control" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">Priority</span><select value={values.priority} onChange={(event) => update("priority", event.target.value as Priority)} className="form-control"><option value="LOW">Low priority</option><option value="MEDIUM">Medium priority</option><option value="HIGH">High priority</option></select></label><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">Category <em className="font-normal text-muted">optional</em></span><input value={values.category} onChange={(event) => update("category", event.target.value)} className="form-control" maxLength={50} placeholder="School, Work, Personal…" /></label></div><label className="block"><span className="mb-1.5 block text-sm font-semibold text-main">Notes <em className="font-normal text-muted">optional</em></span><textarea value={values.notes} onChange={(event) => update("notes", event.target.value)} className="form-control min-h-24 resize-y" maxLength={2000} placeholder="Anything useful to remember?" /></label></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted hover:bg-[var(--surface-muted)]">Cancel</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"><Check size={17} />{saving ? "Saving…" : todo ? "Save changes" : "Add todo"}</button></div></form></div>;
}

function Notice({ tone, children, onDismiss }: { tone: "success" | "error"; children: React.ReactNode; onDismiss: () => void }) { return <div className={classNames("animate-pop-in mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold", tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200")}><span>{children}</span><button onClick={onDismiss} className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100" aria-label="Dismiss notification"><X size={16} /></button></div>; }

function Confetti() { const colors = ["#f43f5e", "#fbbf24", "#34d399", "#818cf8", "#38bdf8", "#fb7185"]; return <div className="pointer-events-none fixed left-1/2 top-20 z-[60]" aria-hidden="true">{Array.from({ length: 22 }).map((_, index) => <i key={index} className="confetti-piece absolute block h-2.5 w-1.5 rounded-sm" style={{ backgroundColor: colors[index % colors.length], left: `${(index - 11) * 13}px`, top: `${(index % 4) * -11}px`, animationDelay: `${(index % 5) * 35}ms`, transform: `rotate(${index * 29}deg)` }} />)}</div>; }
