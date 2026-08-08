"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function renameTemplate(id: string, name: string) {
  if (!name.trim()) return;
  await prisma.userTemplate.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/templates");
  revalidatePath("/jobs/new");
}

export async function deleteTemplate(id: string) {
  await prisma.userTemplate.delete({ where: { id } });
  revalidatePath("/templates");
  revalidatePath("/jobs/new");
}
