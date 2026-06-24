import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normaliseTodoInput, serializeTodo } from "@/lib/todo-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  try {
    const { values, errors } = normaliseTodoInput(await request.json(), true);
    if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
    if (!Object.keys(values).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const todo = await prisma.todo.update({ where: { id }, data: values as never });
    return NextResponse.json(serializeTodo(todo));
  } catch {
    return NextResponse.json({ error: "Todo not found or could not be updated." }, { status: 404 });
  }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.todo.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Todo not found or could not be deleted." }, { status: 404 });
  }
}
