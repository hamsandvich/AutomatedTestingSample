import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodoState, normaliseTodoInput, serializeTodo } from "@/lib/todo-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const state = searchParams.get("state");

  const todos = await prisma.todo.findMany({
    where: {
      ...(date ? { dueDate: date } : {}),
      ...(priority && ["LOW", "MEDIUM", "HIGH"].includes(priority) ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" } : {}),
      ...(category ? { category } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "desc" }],
  });

  const serialized = todos.map(serializeTodo).filter((todo) => !state || getTodoState(todo) === state);
  return NextResponse.json(serialized);
}

export async function POST(request: NextRequest) {
  try {
    const { values, errors } = normaliseTodoInput(await request.json());
    if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });

    const todo = await prisma.todo.create({ data: values as never });
    return NextResponse.json(serializeTodo(todo), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create that todo. Please try again." }, { status: 400 });
  }
}
