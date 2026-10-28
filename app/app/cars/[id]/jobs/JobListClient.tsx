"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Clock, CheckCircle, Archive, Ban, ChevronUp, ChevronDown } from "lucide-react";
import { reorderJob } from "@/app/job/[id]/actions";

type SerializedJob = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  sortOrder: number;
  carId: string | null;
  taskCount: number;
  doneCount: number;
};

function JobCard({
  job,
  carId,
  lang,
  isFirst,
  isLast,
  showReorder,
}: {
  job: SerializedJob;
  carId: string;
  lang: string;
  isFirst: boolean;
  isLast: boolean;
  showReorder: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const pct = job.taskCount > 0 ? Math.round((job.doneCount / job.taskCount) * 100) : 0;

  const isBlocked = job.status === "blocked";
  const progressColor = isBlocked ? "bg-red-600" : "bg-amber-500";
  const borderColor = isBlocked ? "border-red-900" : "border-gray-800";
  const hoverBorder = isBlocked ? "hover:border-red-700" : "hover:border-gray-700";

  const move = (dir: "up" | "down") =>
    startTransition(async () => { await reorderJob(job.id, dir, carId); });

  return (
    <div className={`flex items-stretch gap-2 group`}>
      {/* Reorder buttons */}
      {showReorder && (
        <div className="flex flex-col gap-1 justify-center flex-shrink-0">
          <button
            onClick={() => move("up")}
            disabled={isFirst || pending}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-amber-400 disabled:opacity-20 transition-colors"
            title="Move up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => move("down")}
            disabled={isLast || pending}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-amber-400 disabled:opacity-20 transition-colors"
            title="Move down"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Card */}
      <Link
        href={`/job/${job.id}`}
        className={`flex-1 block bg-gray-900 border ${borderColor} ${hoverBorder} rounded-2xl p-4 transition-colors`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isBlocked && <Ban size={14} className="flex-shrink-0 text-red-500" />}
              <span className="text-sm font-semibold text-white truncate">{job.title}</span>
            </div>
            {job.notes && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{job.notes}</p>
            )}
            <div className="flex items-center gap-3 mt-2.5">
              {job.taskCount > 0 ? (
                <>
                  <div className="flex-1 max-w-[120px] h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${progressColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {pct}% · {job.doneCount}/{job.taskCount} {lang === "es" ? "tareas" : "tasks"}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-gray-600">No tasks yet</span>
              )}
            </div>
          </div>
          <span className="flex-shrink-0 text-xs text-gray-600 group-hover:text-gray-400 mt-0.5">→</span>
        </div>
      </Link>
    </div>
  );
}

export default function JobListClient({
  jobs,
  carId,
  lang,
}: {
  jobs: SerializedJob[];
  carId: string;
  lang: string;
}) {
  const todo      = jobs.filter(j => j.status === "todo");
  const upNext    = jobs.filter(j => j.status === "up_next");
  const active    = jobs.filter(j => j.status === "active" || j.status === "in_progress");
  const blocked   = jobs.filter(j => j.status === "blocked");
  const testing   = jobs.filter(j => j.status === "testing");
  const done      = jobs.filter(j => j.status === "done");
  const archived  = jobs.filter(j => j.status === "archived");

  const Section = ({
    title,
    titleColor,
    items,
    showReorder,
  }: {
    title: string;
    titleColor: string;
    items: SerializedJob[];
    showReorder: boolean;
  }) => (
    <div>
      <h2 className={`text-xs font-semibold ${titleColor} uppercase tracking-wide mb-3`}>
        {title} ({items.length})
      </h2>
      <div className="space-y-2">
        {items.map((j, i) => (
          <JobCard
            key={j.id}
            job={j}
            carId={carId}
            lang={lang}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            showReorder={showReorder}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {todo.length > 0 && (
        <Section
          title="To Do"
          titleColor="text-gray-400"
          items={todo}
          showReorder={todo.length > 1}
        />
      )}
      {upNext.length > 0 && (
        <Section
          title="Up Next"
          titleColor="text-blue-400"
          items={upNext}
          showReorder={upNext.length > 1}
        />
      )}
      {active.length > 0 && (
        <Section
          title="In Progress"
          titleColor="text-amber-400"
          items={active}
          showReorder={active.length > 1}
        />
      )}
      {blocked.length > 0 && (
        <Section
          title="Blocked"
          titleColor="text-red-400"
          items={blocked}
          showReorder={blocked.length > 1}
        />
      )}
      {testing.length > 0 && (
        <Section
          title="Testing"
          titleColor="text-blue-400"
          items={testing}
          showReorder={testing.length > 1}
        />
      )}
      {done.length > 0 && (
        <Section
          title="Completed"
          titleColor="text-emerald-400"
          items={done}
          showReorder={false}
        />
      )}
      {archived.length > 0 && (
        <Section
          title="Archived"
          titleColor="text-gray-500"
          items={archived}
          showReorder={false}
        />
      )}
    </div>
  );
}
