
import Glyph from "@/app/components/Glyph";export default function PRDPage() {
  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 text-sm">← Back</a>
          <h1 className="font-bold text-lg"><Glyph e="📄" /> App PRD</h1>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-2xl mx-auto space-y-8 text-sm text-gray-300">

        {/* Overview */}
        <section>
          <h2 className="text-base font-bold text-white mb-1">Overview</h2>
          <p className="text-gray-400 leading-relaxed">
            A mobile-first personal app for tracking car maintenance jobs across multiple vehicles.
            Core loop: <span className="text-amber-400 font-medium">Car → Job → Phases → Tasks</span>,
            with photo documentation and notes per task, and a gallery per car.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Next.js 16", "Prisma 6.4.1", "SQLite", "Tailwind CSS", "PWA"].map((t) => (
              <span key={t} className="text-xs bg-gray-800 px-2 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </section>

        {/* Data Model */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">Data Model</h2>
          <div className="space-y-4">

            <ModelCard title="Car" color="amber">
              {[
                ["year, make, model", "Required"],
                ["trim", "e.g. 4x4 Limited, 3.6L V6"],
                ["color, mileage, vin, notes", "Optional"],
                ["photos →", "CarPhoto[] — gallery"],
                ["projects →", "Job[] — onDelete: SetNull"],
              ]}
            </ModelCard>

            <ModelCard title="CarPhoto" color="amber">
              {[
                ["filename", "Stored in public/uploads/"],
                ["caption", "Optional text label"],
                ["takenAt", "User-set date (can differ from upload)"],
                ["isFeatured", "One per car — shows as hero image"],
              ]}
            </ModelCard>

            <ModelCard title="Job" color="blue">
              {[
                ["title", "Required"],
                ["carId?", "Optional FK to Car"],
                ["notes, status", "active | done | archived"],
                ["startedAt, completedAt", "Datetime (in schema, not yet in UI)"],
                ["phases →", "Phase[] ordered by sortOrder"],
              ]}
            </ModelCard>

            <ModelCard title="Phase" color="blue">
              {[
                ["title, emoji", "Shown in list + board views"],
                ["sortOrder", "Integer — controls display order"],
                ["status", "Auto-derived from tasks (not manually set)"],
                ["tasks →", "Task[]"],
              ]}
            </ModelCard>

            <ModelCard title="Task" color="green">
              {[
                ["title", "Required"],
                ["warning", "Shown in amber — safety/caution"],
                ["tip", "Shown in blue — pro tips"],
                ["done + completedAt", "Toggled by checkbox"],
                ["comments →", "Comment[] — free text notes"],
                ["photos →", "Photo[] — per-task photos"],
              ]}
            </ModelCard>

            <ModelCard title="Comment / Photo" color="gray">
              {[
                ["Comment", "Free text, timestamped"],
                ["Photo", "filename + optional caption in public/uploads/"],
              ]}
            </ModelCard>

          </div>
        </section>

        {/* Pages */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">Pages</h2>
          <div className="space-y-3">
            {[
              {
                route: "/",
                title: "My Garage (Home)",
                desc: "Lists cars as cards. Featured photo = hero. Tap car → car detail. + Add Car in header.",
              },
              {
                route: "/cars/new",
                title: "Add Car",
                desc: "Form: year, make, model, trim, color, mileage, VIN, notes.",
              },
              {
                route: "/cars/[id]",
                title: "Car Detail (unified)",
                desc: "Hero image, inline edit form (Edit car), photo gallery (upload / caption / date taken / feature / delete / lightbox), projects list with progress bars.",
              },
              {
                route: "/jobs/new",
                title: "New Job",
                desc: "Car picker (pre-selects from ?carId=), title + notes, template picker.",
              },
              {
                route: "/job/[id]",
                title: "Job Board",
                desc: "Sticky header with overall progress. List or ⊞ Board view. Phase cards auto-compute status from task completion. Each task: checkbox, warning badge, tip badge, expand for photos + comments.",
              },
            ].map((p) => (
              <div key={p.route} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs bg-gray-800 text-amber-400 px-2 py-0.5 rounded">{p.route}</code>
                  <span className="text-xs font-semibold text-white">{p.title}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Templates */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">Job Templates</h2>
          <div className="space-y-2">
            {[
              ["🔧", "Tune Up (Full)", "8 phases — plugs, air filter, cabin filter, PCV, belts, fluids, log"],
              ["🛢", "Oil Change + Filters", "8 phases — oil, oil filter, air filter, cabin filter"],
              ["⚙️", "Differential Service", "5 phases — front diff, rear diff, transfer case"],
              ["🔄", "Transmission Fluid", "6 phases — drain/fill or pan drop, filter, gasket, level check"],
              ["🛞", "Brake Job", "7 phases — pads, rotors, bed-in procedure"],
              ["🚿", "Car Wash + Detail", "10 phases — full process + log (products, paint rating, next wax)"],
              ["🔩", "Pentastar Oil Cooler", "18 phases — advanced Jeep 3.6L job"],
              ["📋", "Blank", "Empty — build your own phases"],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="flex gap-3 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                <span className="text-lg flex-shrink-0"><Glyph e={emoji} /></span>
                <div>
                  <div className="text-xs font-semibold text-white">{title}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Decisions */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">Key Technical Decisions</h2>
          <div className="space-y-2">
            {[
              ["SQLite single file", "Personal/LAN-only; no multi-user concurrency"],
              ["Prisma 6.4.1 pinned", "v7 removed datasource url in schema; 6.x is stable"],
              ["Raw SQL for schema changes", "prisma migrate dev is non-interactive in this env"],
              ["Photos in public/uploads/", "No S3/cloud needed for personal LAN app"],
              ["20MB body limit", "iPhone photos exceed Next.js default 1MB"],
              ["Phase status auto-derived", "0 done = To Do, partial = In Progress, all = Done"],
              ["onDelete: SetNull on Job.carId", "Deleting a car preserves project history"],
              ["PWA manifest", "Installable on iPhone home screen via Share → Add to Home Screen"],
            ].map(([decision, reason]) => (
              <div key={decision} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                <div className="text-xs font-semibold text-amber-400">{decision}</div>
                <div className="text-xs text-gray-400 mt-0.5">{reason}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What's built */}
        <section>
          <h2 className="text-base font-bold text-white mb-3"><Glyph e="✅" /> All Features Built</h2>
          <ul className="space-y-1.5">
            {[
              "Add / edit / delete custom phases from the project board",
              "Add / edit / delete custom tasks with warning, tip, due date",
              "Service history per car — project-generated or manual entries",
              "Edit project title, notes, car, status after creation",
              "Archive and delete projects (with cascade cleanup)",
              "startedAt / completedAt visible and editable on project",
              "Global search across cars, projects, tasks, service records",
              "Task due dates with overdue badge",
              "Task photo captions editable after upload",
              "Car photo gallery with featured image, date taken, lightbox",
              "Save project as reusable template",
              "Export project as Markdown or JSON",
              "Export car history as JSON",
              "Full garage backup as JSON",
              "Car summary stats (active/done/archived/service count)",
              "PWA installable on iPhone home screen",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs text-gray-300">
                <span className="text-emerald-500 flex-shrink-0"><Glyph e="✓" /></span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-3"><Glyph e="🔜" /> Potential Future Additions</h2>
          <ul className="space-y-1.5">
            {[
              "Mileage history log (track changes over time, not just current value)",
              "Mileage validation warning (new entry lower than last recorded)",
              "Filter projects by status or car from the home page",
              "Edit / delete saved user templates",
              "Reminders / push notifications for due tasks",
              "Multi-user / shared garage access",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs text-gray-500">
                <span className="text-gray-600 flex-shrink-0">○</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="text-xs text-gray-700 text-center pb-4">
          Last updated: 2026-03-12 · v0.2 — all PRD features shipped
        </div>
      </main>
    </div>
  );
}

function ModelCard({ title, color, children }: {
  title: string;
  color: "amber" | "blue" | "green" | "gray";
  children: [string, string][];
}) {
  const accent: Record<string, string> = {
    amber: "text-amber-400 border-amber-800",
    blue: "text-blue-400 border-blue-800",
    green: "text-emerald-400 border-emerald-800",
    gray: "text-gray-400 border-gray-700",
  };
  return (
    <div className={`border ${accent[color].split(" ")[1]} bg-gray-900 rounded-xl overflow-hidden`}>
      <div className={`px-3 py-2 border-b ${accent[color].split(" ")[1]} font-bold text-xs ${accent[color].split(" ")[0]}`}>
        {title}
      </div>
      <div className="divide-y divide-gray-800">
        {children.map(([field, desc]) => (
          <div key={field} className="flex gap-3 px-3 py-2">
            <code className="text-xs text-gray-300 flex-shrink-0 w-36">{field}</code>
            <span className="text-xs text-gray-500">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
