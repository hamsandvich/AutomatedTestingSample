import { Priority, Todo } from "@prisma/client";

export type TodoState = "completed" | "pending" | "missed";
export type TodoPayload = Omit<Todo, "createdAt" | "updatedAt" | "completedAt"> & {
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  state: TodoState;
};

export const priorityOptions = ["LOW", "MEDIUM", "HIGH"] as const;

export function todoDueAt(todo: Pick<Todo, "dueDate" | "dueTime">): Date {
  return new Date(`${todo.dueDate}T${todo.dueTime ?? "23:59"}:59`);
}

export function getTodoState(todo: Pick<Todo, "completed" | "dueDate" | "dueTime">, now = new Date()): TodoState {
  if (todo.completed) return "completed";
  return todoDueAt(todo).getTime() < now.getTime() ? "missed" : "pending";
}

export function serializeTodo(todo: Todo): TodoPayload {
  return {
    ...todo,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    completedAt: todo.completedAt?.toISOString() ?? null,
    state: getTodoState(todo),
  };
}

export function normaliseTodoInput(input: unknown, partial = false) {
  const body = input as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  const errors: string[] = [];

  if (!partial || "title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) errors.push("A todo title is required.");
    else if (title.length > 160) errors.push("Todo titles must be 160 characters or fewer.");
    else values.title = title;
  }

  if (!partial || "dueDate" in body) {
    const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(`${dueDate}T12:00`).getTime())) {
      errors.push("Choose a valid due date.");
    } else values.dueDate = dueDate;
  }

  if ("dueTime" in body) {
    const dueTime = typeof body.dueTime === "string" ? body.dueTime : "";
    if (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) errors.push("Choose a valid due time.");
    else values.dueTime = dueTime || null;
  }

  if ("priority" in body) {
    const priority = typeof body.priority === "string" ? body.priority.toUpperCase() : "MEDIUM";
    if (!priorityOptions.includes(priority as Priority)) errors.push("Choose a valid priority.");
    else values.priority = priority as Priority;
  } else if (!partial) values.priority = Priority.MEDIUM;

  for (const field of ["category", "notes"] as const) {
    if (field in body) {
      const value = typeof body[field] === "string" ? body[field].trim() : "";
      if (value.length > (field === "category" ? 50 : 2000)) errors.push(`${field === "category" ? "Categories" : "Notes"} are too long.`);
      else values[field] = value || null;
    }
  }

  if ("completed" in body) {
    if (typeof body.completed !== "boolean") errors.push("Completed must be true or false.");
    else {
      values.completed = body.completed;
      values.completedAt = body.completed ? new Date() : null;
    }
  }

  return { values, errors };
}

export function dateKey(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}
