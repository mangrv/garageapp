import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SharePhotoGallery from "./SharePhotoGallery";

export const dynamic = "force-dynamic";

function parseTools(toolsJson: string | null): string[] {
  if (!toolsJson) return [];
  try { return JSON.parse(toolsJson); } catch { return []; }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const project = await prisma.job.findUnique({
    where: { shareToken: token },
    include: {
      car: true,
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
            include: {
              photos: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const carLabel = project.car
    ? [project.car.year, project.car.make, project.car.model, project.car.trim]
        .filter(Boolean)
        .join(" ")
    : null;

  const totalTasks = project.phases.reduce((s, p) => s + p.tasks.length, 0);
  const doneTasks = project.phases.reduce((s, p) => s + p.tasks.filter((t) => t.done).length, 0);
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const projectTools = parseTools((project as any).toolsJson);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span>🔗 Shared project</span>
            {carLabel && <span>· {carLabel}</span>}
          </div>
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          {project.notes && (
            <p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap">{project.notes}</p>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{doneTasks} of {totalTasks} tasks complete</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Job tools */}
          {projectTools.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-400 mb-2">🧰 Tools needed</div>
              <div className="flex flex-wrap gap-1.5">
                {projectTools.map((tool, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2.5 py-1">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {project.phases.map((phase) => {
          const phaseDone = phase.tasks.filter((t) => t.done).length;
          const phaseTotal = phase.tasks.length;
          const phaseTools = parseTools((phase as any).toolsJson);

          return (
            <div key={phase.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Phase header */}
              <div className="px-5 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    {phase.emoji && <span>{phase.emoji}</span>}
                    {phase.title}
                  </h2>
                  <span className="text-xs text-gray-500">{phaseDone}/{phaseTotal}</span>
                </div>
                {phaseTools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {phaseTools.map((tool, i) => (
                      <span key={i} className="text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded-full px-2 py-0.5">
                        🔧 {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="divide-y divide-gray-800">
                {phase.tasks.map((task) => (
                  <div key={task.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      {/* Checkbox (read-only) */}
                      <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                        task.done
                          ? "bg-emerald-600 border-emerald-600"
                          : "border-gray-600 bg-transparent"
                      }`}>
                        {task.done && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.done ? "line-through text-gray-500" : "text-white"}`}>
                          {task.title}
                        </p>

                        {task.warning && (
                          <p className="mt-1 text-xs text-amber-400">⚠️ {task.warning}</p>
                        )}
                        {task.tip && (
                          <p className="mt-1 text-xs text-sky-400">💡 {task.tip}</p>
                        )}
                        {(task as any).torqueValue != null && (
                          <div className="mt-1 text-xs text-gray-400 bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 inline-block font-mono">
                            🔧 {(task as any).torqueValue} {(task as any).torqueUnit}
                          </div>
                        )}

                        {/* Photos — tap to enlarge */}
                        {task.photos.length > 0 && (
                          <SharePhotoGallery
                            photos={task.photos.map((p) => ({
                              id: p.id,
                              filename: p.filename,
                              caption: p.caption ?? null,
                            }))}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {phase.tasks.length === 0 && (
                  <p className="px-5 py-4 text-sm text-gray-600">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center pb-10 text-xs text-gray-700">
        Shared via Garage Work Manager
      </div>
    </div>
  );
}
