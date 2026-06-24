import { PrismaClient, Priority } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.todo.count();
  if (count > 0) return;

  const today = new Date();
  const date = (offset: number) => {
    const next = new Date(today);
    next.setDate(today.getDate() + offset);
    return next.toISOString().slice(0, 10);
  };

  await prisma.todo.createMany({
    data: [
      { title: "Plan the week", dueDate: date(0), dueTime: "09:00", priority: Priority.HIGH, category: "Personal" },
      { title: "Try your first Daymark task", dueDate: date(0), priority: Priority.MEDIUM, category: "Getting started", notes: "Edit or complete me when you are ready." },
      { title: "Make space for what matters", dueDate: date(2), priority: Priority.LOW, category: "Wellbeing" },
    ],
  });
}

main().finally(() => prisma.$disconnect());
