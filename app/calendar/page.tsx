import { Dashboard } from "@/components/dashboard";
import { prisma } from "@/lib/prisma";
import { serializeTodo } from "@/lib/todo-utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const todos = await prisma.todo.findMany({ orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "desc" }] });
  return <Dashboard initialTodos={todos.map(serializeTodo)} initialView="calendar" />;
}
