import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fmt = req.nextUrl.searchParams.get("fmt") ?? "json";

  const project = await prisma.job.findUnique({
    where: { id },
    include: {
      car: true,
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
            include: {
              comments: { orderBy: { createdAt: "asc" } },
              photos: true,
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fmt === "md") {
    const carLabel = project.car
      ? `${project.car.year} ${project.car.make} ${project.car.model}${project.car.trim ? ` ${project.car.trim}` : ""}`
      : "No car";

    const lines: string[] = [
      `# ${project.title}`,
      ``,
      `**Car:** ${carLabel}`,
      `**Status:** ${project.status}`,
      project.startedAt ? `**Started:** ${project.startedAt.toLocaleDateString()}` : "",
      project.completedAt ? `**Completed:** ${project.completedAt.toLocaleDateString()}` : "",
      project.notes ? `\n**Notes:**\n${project.notes}` : "",
      ``,
      `---`,
      ``,
    ].filter((l) => l !== undefined);

    for (const phase of project.phases) {
      const done = phase.tasks.filter((t) => t.done).length;
      lines.push(`## ${phase.emoji ?? ""} ${phase.title} (${done}/${phase.tasks.length})`);
      lines.push("");
      for (const task of phase.tasks) {
        const check = task.done ? "x" : " ";
        lines.push(`- [${check}] ${task.title}`);
        if (task.warning) lines.push(`  > ⚠️ ${task.warning}`);
        if (task.tip) lines.push(`  > 💡 ${task.tip}`);
        if (task.dueDate) lines.push(`  > 📅 Due: ${task.dueDate.toLocaleDateString()}`);
        for (const c of task.comments) {
          lines.push(`  - 💬 ${c.text}`);
        }
        if (task.photos.length > 0) {
          lines.push(`  - 📷 ${task.photos.length} photo(s)`);
        }
      }
      lines.push("");
    }

    const md = lines.join("\n");
    const filename = `${project.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // JSON
  const filename = `${project.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.json`;
  return new NextResponse(JSON.stringify(project, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
