import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import AIBuilder from "./AIBuilder";

const TEMPLATES = [
  { id: "tune_up",       label: "🔧 Tune Up (Full) — plugs, filters, PCV, fluids" },
  { id: "oil_change",    label: "🛢 Oil Change + Filters — oil, air, cabin" },
  { id: "diff_service",  label: "⚙️ Differential Service — front, rear, transfer case" },
  { id: "trans_service", label: "🔄 Transmission Fluid Service" },
  { id: "brake_job",     label: "🛞 Brake Job — pads, rotors, bed-in" },
  { id: "car_wash",      label: "🚿 Car Wash + Detail — full process log" },
  { id: "pentastar",     label: "🔩 Pentastar Oil Cooler + Throttle Body (advanced)" },
  { id: "blank",         label: "📋 Blank — start from scratch" },
];

export default async function NewJob({
  searchParams,
}: {
  searchParams: Promise<{ carId?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const [cars, userTemplates] = await Promise.all([
    prisma.car.findMany({ where: { userId: session.userId }, orderBy: { year: "asc" } }),
    prisma.userTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  async function create(formData: FormData) {
    "use server";
    const sess = await requireSession();
    const title = String(formData.get("title") || "").trim();
    const carId = String(formData.get("carId") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;
    const template = String(formData.get("template") || "blank");

    if (!title) return;

    const project = await prisma.job.create({
      data: { title, userId: sess.userId, carId, notes, status: "active" },
    });

    if (template.startsWith("user:")) {
      const userTemplateId = template.slice(5);
      const ut = await prisma.userTemplate.findUnique({ where: { id: userTemplateId } });
      if (ut) await seedFromUserTemplate(project.id, ut.phasesJson);
    } else if (template === "tune_up")        await seedTuneUp(project.id);
    else if (template === "oil_change")    await seedOilChange(project.id);
    else if (template === "diff_service")  await seedDiffService(project.id);
    else if (template === "trans_service") await seedTransService(project.id);
    else if (template === "brake_job")     await seedBrakeJob(project.id);
    else if (template === "car_wash")      await seedCarWash(project.id);
    else if (template === "pentastar")     await seedPentastar(project.id);

    redirect(`/job/${project.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 text-sm">← Back</a>
          <h1 className="font-bold text-lg">New Job</h1>
        </div>
      </header>

      <main className="px-4 pt-6">
        <form action={create} className="space-y-5">

          {/* Car picker */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-300">🚗 Which car?</div>
            {cars.length === 0 ? (
              <div className="text-sm text-gray-500">
                No cars yet.{" "}
                <a href="/cars/new" className="text-amber-400 underline">Add a car first →</a>
              </div>
            ) : (
              <div className="space-y-2">
                {cars.map((car) => {
                  const label = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
                  return (
                    <label key={car.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl cursor-pointer">
                      <input
                        type="radio"
                        name="carId"
                        value={car.id}
                        defaultChecked={car.id === sp.carId}
                        className="accent-amber-500 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm">{label}</span>
                      {car.color && <span className="text-xs text-gray-500 ml-auto">{car.color}</span>}
                    </label>
                  );
                })}
                <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="carId"
                    value=""
                    defaultChecked={!sp.carId}
                    className="accent-amber-500 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-400">No specific car</span>
                </label>
              </div>
            )}
          </div>

          {/* Job details */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-300">🔧 Job</div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input
                name="title"
                required
                placeholder="Oil Cooler Replacement, Brake Job…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Parts ordered, budget, known issues…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Template */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-300">📋 Start from template</div>

            {/* User saved templates */}
            {userTemplates.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-amber-400 font-medium px-1 pt-1">💾 My Templates</div>
                {userTemplates.map((ut) => (
                  <label key={ut.id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer active:bg-gray-800 bg-gray-800/50">
                    <input type="radio" name="template" value={`user:${ut.id}`} className="accent-amber-500 w-4 h-4" />
                    <span className="text-sm">{ut.name}</span>
                  </label>
                ))}
                <div className="border-t border-gray-800 pt-2 mt-1" />
                <div className="text-xs text-gray-500 font-medium px-1">🔧 Built-in Templates</div>
              </div>
            )}

            {TEMPLATES.map((t) => (
              <label key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer active:bg-gray-800">
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  defaultChecked={t.id === "blank"}
                  className="accent-amber-500 w-4 h-4"
                />
                <span className="text-sm">{t.label}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-amber-500 text-gray-950 font-bold py-3.5 rounded-xl text-base active:scale-95 transition-transform"
          >
            Create Job →
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* AI Builder */}
        <AIBuilder
          cars={cars.map((c) => ({ id: c.id, year: c.year, make: c.make, model: c.model, trim: c.trim ?? null }))}
          selectedCarId={sp.carId ?? null}
        />
      </main>
    </div>
  );
}

// ── Templates ──────────────────────────────────────────────────

async function seedTuneUp(jobId: string) {
  const phases = [
    {
      e: "1️⃣", t: "Gather parts + specs", tasks: [
        "Look up spark plug part # and gap spec for this engine",
        "Look up torque spec for spark plugs",
        "Buy: spark plugs (qty matches cylinder count)",
        "Buy: engine air filter",
        "Buy: cabin air filter",
        "Buy: PCV valve",
        "Buy: fuel filter (if serviceable)",
        "Check belt condition (note mileage)",
        "Check coolant hoses for cracks/softness",
      ]
    },
    {
      e: "2️⃣", t: "Spark plugs", tasks: [
        "Let engine cool completely",
        "Remove engine cover if needed",
        "Blow debris out of plug wells (air or bulb)",
        "Remove ignition coils / plug wires",
        "Remove old spark plugs",
        "Check old plugs: look for oil fouling, carbon, gap wear",
        "Gap new plugs to spec",
        "Install new plugs — hand thread first",
        "Torque to spec",
        "Optional: thin coat of dielectric grease on coil boots",
        "Reinstall coils / wires",
      ]
    },
    {
      e: "3️⃣", t: "Engine air filter", tasks: [
        "Locate airbox",
        "Open clips / unscrew housing",
        "Remove old filter — note direction",
        "Wipe housing interior clean",
        "Install new filter in correct orientation",
        "Resecure housing",
      ]
    },
    {
      e: "4️⃣", t: "Cabin air filter", tasks: [
        "Locate cabin filter (usually behind glove box or under dash)",
        "Remove glove box or access panel",
        "Slide out old cabin filter",
        "Note airflow direction arrow",
        "Slide in new filter (arrow = airflow direction)",
        "Reinstall panel / glove box",
      ]
    },
    {
      e: "5️⃣", t: "PCV valve", tasks: [
        "Locate PCV valve",
        "Pull off old valve (twist + pull)",
        "Install new PCV valve",
        "Reconnect hose",
      ]
    },
    {
      e: "6️⃣", t: "Check belts + hoses", tasks: [
        "Inspect serpentine belt for cracks, glazing, fraying",
        "Check belt tensioner — bounce test (should have minimal play)",
        "Squeeze upper/lower radiator hoses — soft + mushy = replace soon",
        "Check heater hoses",
        "📸 Photo anything that looks questionable",
      ]
    },
    {
      e: "7️⃣", t: "Top off fluids", tasks: [
        "Coolant reservoir — top off if low",
        "Brake fluid — check level + color (dark = flush soon)",
        "Power steering fluid (if hydraulic)",
        "Windshield washer fluid",
        "Check transmission fluid level/color if dipstick accessible",
      ]
    },
    {
      e: "8️⃣", t: "Startup + verify", tasks: [
        "Start engine — listen for any misfires",
        "Check for vacuum leaks (hissing sound)",
        "Reset maintenance reminder on dash if applicable",
        "Log date + mileage",
      ]
    },
  ];
  await createPhases(jobId, phases);
}

async function seedOilChange(jobId: string) {
  const phases = [
    {
      e: "1️⃣", t: "Gather supplies", tasks: [
        "Check owner's manual for oil spec (e.g. 5W-20, 0W-40)",
        "Buy correct oil (qty per spec)",
        "Buy oil filter (correct part #)",
        "Buy drain plug washer (some are single-use)",
        "Oil drain pan",
        "Ramps or jack stands + jack",
        "Funnel, rags, gloves",
        "Engine air filter (inspect — replace if dirty)",
        "Cabin air filter (inspect — replace if dirty or >15k mi)",
      ]
    },
    { e: "2️⃣", t: "Warm up + lift", tasks: ["Run engine 5 min to warm oil (drains faster)", "Park on level surface", "Lift car safely on ramps or stands", "Place drain pan under drain plug"] },
    { e: "3️⃣", t: "Drain old oil", tasks: ["Remove drain plug — let drain fully (3–5 min)", "Remove old oil filter — let drip", "Wipe drain plug area clean", "Inspect drain plug threads"] },
    { e: "4️⃣", t: "New filter + plug", tasks: ["Lube new filter gasket with fresh oil", "Install new filter — hand tight + 3/4 turn", "Install new drain plug (new washer)", "Torque drain plug to spec (usually 25–30 ft-lb)"] },
    { e: "5️⃣", t: "Engine air filter", tasks: ["Open airbox", "Inspect old filter — replace if dirty/dark", "Install new filter if replacing", "Resecure airbox"] },
    { e: "6️⃣", t: "Cabin air filter", tasks: ["Access cabin filter (usually behind glove box)", "Inspect old filter", "Install new if replacing", "Reinstall panel"] },
    { e: "7️⃣", t: "Refill + check", tasks: ["Add correct amount of oil via funnel", "Check dipstick — at correct level?", "Start engine 30 sec", "Check drain plug + filter for leaks", "Stop engine — wait 5 min — recheck dipstick"] },
    { e: "8️⃣", t: "Cleanup + log", tasks: ["Dispose old oil at auto parts store (free)", "Log: date, mileage, oil brand + spec", "Note next oil change mileage", "Reset maintenance reminder on dash"] },
  ];
  await createPhases(jobId, phases);
}

async function seedDiffService(jobId: string) {
  const phases = [
    {
      e: "1️⃣", t: "Check service intervals + buy fluid", tasks: [
        "Look up fluid spec for front differential",
        "Look up fluid spec for rear differential",
        "Look up fluid spec for transfer case",
        "Buy fluid — note capacity for each unit",
        "Buy drain plug washer(s) if replaceable",
        "Fluid pump / hand pump for refill",
        "Drain pan, rags, gloves",
      ]
    },
    {
      e: "2️⃣", t: "Rear differential", tasks: [
        "Locate rear diff drain plug (bottom) + fill plug (side)",
        "Loosen FILL plug first — if it won't budge, don't drain (you'd be stranded)",
        "Remove drain plug — drain fully",
        "Inspect old fluid: milky = water ingress, metal flakes = wear",
        "Reinstall drain plug (new washer if applicable)",
        "Pump new fluid in fill hole until it reaches bottom of fill hole threads",
        "Reinstall fill plug",
        "Wipe down + inspect for leaks",
        "📸 Photo of fill/drain plug area",
      ]
    },
    {
      e: "3️⃣", t: "Front differential", tasks: [
        "Locate front diff drain + fill plugs",
        "Loosen fill plug first",
        "Remove drain plug — drain fully",
        "Reinstall drain plug",
        "Pump new fluid to bottom of fill threads",
        "Reinstall fill plug",
        "Check for leaks",
      ]
    },
    {
      e: "4️⃣", t: "Transfer case", tasks: [
        "Locate transfer case drain + fill plugs",
        "Loosen fill plug first",
        "Remove drain plug — drain fully",
        "Reinstall drain plug",
        "Pump new transfer case fluid to bottom of fill threads",
        "Reinstall fill plug",
        "Check for leaks",
      ]
    },
    {
      e: "5️⃣", t: "Inspect + log", tasks: [
        "Lower vehicle",
        "Take short test drive",
        "Recheck all plugs for seepage",
        "Log: date, mileage, fluid brands + quantities used",
        "Note next service interval (usually 30–60k mi)",
      ]
    },
  ];
  await createPhases(jobId, phases);
}

async function seedTransService(jobId: string) {
  const phases = [
    {
      e: "1️⃣", t: "Check type + buy fluid", tasks: [
        "Identify transmission type (automatic, manual, CVT)",
        "Look up fluid spec in owner's manual (e.g. ATF+4, Mercon, etc.)",
        "Determine if drain plug exists OR if pan drop required",
        "Buy correct fluid (qty = capacity minus torque converter)",
        "Buy new trans pan gasket if pan drop",
        "Buy trans filter if applicable",
        "Drain pan, funnel, pump, rags",
      ]
    },
    {
      e: "2️⃣", t: "Drain fluid", tasks: [
        "Warm transmission to operating temp (10 min drive)",
        "Raise + secure vehicle",
        "If drain plug: remove plug, drain fully",
        "If pan drop: loosen pan bolts on one side, tilt pan to drain, remove pan",
        "Inspect old fluid: dark + burnt smell = overdue, metal = wear",
      ]
    },
    {
      e: "3️⃣", t: "Filter + pan (if applicable)", tasks: [
        "Remove old trans filter (if pan drop)",
        "Note O-ring/gasket on filter pickup tube",
        "Install new filter",
        "Clean pan with brake cleaner + lint-free rag",
        "Inspect magnet in pan — some metal = normal, chunks = concern",
        "Install new pan gasket (no silicone on rubber gaskets)",
        "Reinstall pan — hand thread all bolts first, then snug in cross pattern",
      ]
    },
    {
      e: "4️⃣", t: "Refill", tasks: [
        "If drain plug: reinstall plug with new washer",
        "Add fluid through dipstick tube (funnel) or fill plug",
        "Add ~80% of capacity first — remainder after warmup check",
        "Check dipstick level before starting",
      ]
    },
    {
      e: "5️⃣", t: "Startup + level check", tasks: [
        "Start engine — keep in Park",
        "Shift through all gears slowly (P-R-N-D-L) — pause 2 sec each",
        "Check for leaks under car",
        "Recheck dipstick level (engine warm, in Park)",
        "Top off as needed",
      ]
    },
    {
      e: "6️⃣", t: "Test drive + log", tasks: [
        "Test drive — check for smooth shifts",
        "No harsh shifts, slipping, or delay = ✅",
        "Recheck for leaks after drive",
        "Log: date, mileage, fluid spec + brand, qty used",
      ]
    },
  ];
  await createPhases(jobId, phases);
}

async function seedCarWash(jobId: string) {
  const phases = [
    {
      e: "🧴", t: "Supplies check", tasks: [
        "Car wash soap (pH neutral)",
        "Two buckets (wash + rinse) with grit guards",
        "Wash mitt (microfiber or lambswool)",
        "Wheel cleaner + stiff wheel brush",
        "Microfiber drying towels (2–3 large)",
        "Spray detailer / quick wax",
        "Tire shine / dressing",
        "Glass cleaner + microfiber cloths",
        "Interior: vacuum, all-purpose cleaner, dashboard wipe",
        "Optional: iron decontamination spray, clay bar",
      ]
    },
    {
      e: "1️⃣", t: "Pre-rinse + wheels first", tasks: [
        "Rinse entire car top to bottom (dislodge loose dirt)",
        "Spray wheels + wheel wells with wheel cleaner",
        "Agitate wheels with wheel brush",
        "Rinse wheels thoroughly",
        "Tip: always do wheels FIRST — prevents brake dust splatter on clean paint",
      ]
    },
    {
      e: "2️⃣", t: "Two-bucket wash", tasks: [
        "Fill bucket 1: soapy water",
        "Fill bucket 2: clean rinse water",
        "Wash panel by panel — top to bottom (roof → glass → hood → doors → lower panels)",
        "Rinse mitt in bucket 2 before dipping in soap bucket",
        "Use straight lines (not circles) to minimize swirl marks",
      ]
    },
    {
      e: "3️⃣", t: "Rinse + inspect", tasks: [
        "Rinse entire car thoroughly",
        "Check for missed spots or bird droppings",
        "Optional: clay bar on paint if it feels rough (contamination removal)",
      ]
    },
    {
      e: "4️⃣", t: "Dry", tasks: [
        "Dry immediately (prevent water spots)",
        "Use large microfiber towel — blot + drag, don't scrub",
        "Open doors + trunk — dry jambs",
        "Blow out mirrors + door handles with compressed air (optional)",
      ]
    },
    {
      e: "5️⃣", t: "Paint protection", tasks: [
        "Apply spray detailer or quick wax (optional each wash)",
        "Apply full paste wax or sealant (every 3–4 months)",
        "Note: last wax date → ___",
      ]
    },
    {
      e: "6️⃣", t: "Tires + trim", tasks: [
        "Apply tire dressing (gel or spray — not greasy type)",
        "Dress exterior plastic trim if faded",
        "Clean rubber door seals",
      ]
    },
    {
      e: "7️⃣", t: "Glass", tasks: [
        "Clean exterior glass (glass cleaner + microfiber)",
        "Clean interior windshield + windows",
        "Check wiper blades for streaking",
      ]
    },
    {
      e: "8️⃣", t: "Interior", tasks: [
        "Vacuum seats, carpets, floor mats",
        "Wipe dashboard + center console with APC or dash wipe",
        "Clean door pockets + cup holders",
        "Wipe door panels",
        "Condition leather if applicable",
      ]
    },
    {
      e: "📝", t: "Log this wash", tasks: [
        "Rate paint condition: ⭐⭐⭐⭐⭐",
        "Products used today: ___",
        "Any issues noted (chips, scratches, swirls): ___",
        "Next wax/sealant due: ___",
      ]
    },
  ];
  await createPhases(jobId, phases);
}

async function seedBrakeJob(jobId: string) {
  const phases = [
    { e: "1️⃣", t: "Parts + tools", tasks: ["Brake pads (per axle)", "Rotors if needed", "Brake caliper tool / C-clamp", "Brake cleaner", "Torque wrench", "Lug wrench + jack"] },
    { e: "2️⃣", t: "Remove wheel", tasks: ["Loosen lug nuts before jacking", "Jack car + secure on stand", "Remove wheel"] },
    { e: "3️⃣", t: "Remove caliper", tasks: ["Inspect rotor for wear/grooves", "Remove caliper bolts", "Hang caliper — do NOT let it dangle by hose"] },
    { e: "4️⃣", t: "Replace pads", tasks: ["Remove old brake pads", "Compress caliper piston with C-clamp", "Install new pads + hardware clips"] },
    { e: "5️⃣", t: "Replace rotor (if needed)", tasks: ["Remove rotor retaining screw", "Slide off old rotor", "Clean hub surface", "Install new rotor"] },
    { e: "6️⃣", t: "Reinstall + torque", tasks: ["Reinstall caliper", "Torque caliper bolts to spec", "Reinstall wheel", "Torque lug nuts in star pattern"] },
    { e: "7️⃣", t: "Bed-in procedure", tasks: ["Drive 30 mph → moderate stop (3×)", "Drive 50 mph → moderate stop (3×)", "Let brakes cool 10 min before driving hard"] },
  ];
  await createPhases(jobId, phases);
}

async function seedPentastar(jobId: string) {
  const phases = [
    { e: "1️⃣", t: "Prep the Work Area", tasks: [{ t: "Let engine cool completely" }, { t: "Disconnect negative battery terminal" }, { t: "Remove engine cover" }, { t: "Set up magnetic trays" }, { t: "Lay rags over fenders" }, { t: "Put cardboard under car" }, { t: "Tools ready: 8mm, 10mm, 13mm" }, { t: "Extensions ready" }, { t: "Spark plug socket ready" }, { t: "Torque wrench ready" }] },
    { e: "2️⃣", t: "Remove Intake System", tasks: [{ t: "Remove air intake tube" }, { t: "Remove air box lid if needed" }, { t: "Disconnect MAF sensor" }, { t: "Disconnect throttle body connector" }, { t: "Remove throttle body bolts" }, { t: "Pull off throttle body — set aside" }] },
    { e: "3️⃣", t: "Clean Throttle Body", tasks: [{ t: "Spray throttle body cleaner" }, { t: "Clean throttle plate" }, { t: "Clean inside bore" }, { t: "Use microfiber or lint-free rag" }, { t: "Set aside — install new gasket during reassembly", tip: "Don't install gasket yet" }] },
    { e: "4️⃣", t: "Remove Intake Manifold", tasks: [{ t: "Disconnect MAP sensor" }, { t: "Disconnect EVAP line" }, { t: "Disconnect PCV hose" }, { t: "Disconnect injector harness clips" }, { t: "Remove intake manifold bolts" }, { t: "Lift manifold slowly" }, { t: "Cover intake ports with clean rags", w: "⚠️ Do this immediately — dropped bolts = engine destruction" }] },
    { e: "5️⃣", t: "First Inspection Phase", tasks: [{ t: "Check: Oil pooled around oil cooler", tip: "Very common on Pentastar" }, { t: "Check: Spark plug wells for oil" }, { t: "Check: Intake ports carbon level" }, { t: "Check: Wiring harness brittleness" }, { t: "📸 Take photos NOW — document everything" }] },
    { e: "6️⃣", t: "Remove Ignition Coils", tasks: [{ t: "Remove coil bolts" }, { t: "Remove ignition coils" }, { t: "Inspect coil boots" }, { t: "If clean → set aside for reinstall" }] },
    { e: "7️⃣", t: "Replace Spark Plugs", tasks: [{ t: "Blow debris out of wells" }, { t: "Remove old spark plugs" }, { t: "Install new spark plugs" }, { t: "Torque to 13 ft-lb" }, { t: "Dielectric grease on coil boots (optional)", tip: "Prevents boots sticking to plugs later" }] },
    { e: "8️⃣", t: "Remove Oil Cooler Housing", tasks: [{ t: "Disconnect oil pressure sensor connector" }, { t: "Disconnect coolant lines" }, { t: "Disconnect oil temp sensor" }, { t: "Remove cooler bolts" }, { t: "Lift cooler assembly out" }] },
    { e: "9️⃣", t: "Clean Engine Valley", tasks: [{ t: "Clean pooled oil with paper towels" }, { t: "Spray brake cleaner on sludge/dirt" }, { t: "Wipe clean — repeat until aluminum looks dry" }, { t: "Verify no debris near oil passages", w: "⚠️ Do NOT let debris fall into oil passages" }] },
    { e: "🔟", t: "Replace Oil Pressure Sending Unit", tasks: [{ t: "Remove old sensor from cooler housing" }, { t: "Install new sensor", tip: "Snug only — do NOT overtighten" }] },
    { e: "1️⃣1️⃣", t: "Replace PCV Valve", tasks: [{ t: "Unscrew old PCV valve" }, { t: "Install new PCV valve", tip: "Takes about 30 seconds" }] },
    { e: "1️⃣2️⃣", t: "Install New Oil Cooler Housing", tasks: [{ t: "Clean mating surface with brake cleaner" }, { t: "Place new cooler unit" }, { t: "Hand thread all bolts first" }, { t: "Torque: center → outward pattern" }, { t: "Torque to 8–9 Nm (70–80 in-lb)", w: "⚠️ Do NOT overtighten — #1 DIY mistake" }] },
    { e: "1️⃣3️⃣", t: "Final Cleaning", tasks: [{ t: "Clean intake manifold interior" }, { t: "Clean throttle body mounting area" }, { t: "Clean any spilled oil", tip: "Prevents false leak scares after startup" }] },
    { e: "1️⃣4️⃣", t: "Reinstall Intake Manifold", tasks: [{ t: "Remove all intake port rags — count them" }, { t: "Install intake manifold" }, { t: "Torque bolts in cross pattern" }, { t: "Reconnect injector harness" }, { t: "Reconnect MAP sensor" }, { t: "Reconnect EVAP line" }, { t: "Reconnect PCV hose" }] },
    { e: "1️⃣5️⃣", t: "Reinstall Throttle Body", tasks: [{ t: "Install new throttle body gasket" }, { t: "Install throttle body" }, { t: "Reconnect throttle body connector" }] },
    { e: "1️⃣6️⃣", t: "Reinstall Intake Tube", tasks: [{ t: "Reconnect intake hose" }, { t: "Reconnect MAF sensor" }] },
    { e: "1️⃣7️⃣", t: "Fluids", tasks: [{ t: "Check coolant reservoir level" }, { t: "Top off coolant if needed" }] },
    { e: "1️⃣8️⃣", t: "First Startup", tasks: [{ t: "Reconnect negative battery terminal" }, { t: "Start engine" }, { t: "Expect slightly rough idle ~10 sec (normal)" }, { t: "Check for oil leaks" }, { t: "Check for coolant leaks" }, { t: "📸 Record first startup" }, { t: "⏰ Recheck coolant level next morning", tip: "Air pockets purge overnight" }] },
  ];

  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const phase = await prisma.phase.create({ data: { jobId, title: ph.t, emoji: ph.e, sortOrder: i + 1, status: "todo" } });
    for (let j = 0; j < ph.tasks.length; j++) {
      const task = ph.tasks[j] as any;
      await prisma.task.create({ data: { phaseId: phase.id, title: task.t || task, warning: task.w ?? null, tip: task.tip ?? null, sortOrder: j + 1 } });
    }
  }
}

async function seedFromUserTemplate(jobId: string, phasesJson: string) {
  const phases = JSON.parse(phasesJson) as Array<{
    title: string; emoji: string | null; sortOrder: number;
    tasks: Array<{ title: string; warning: string | null; tip: string | null; sortOrder: number }>;
  }>;
  for (const ph of phases) {
    const phase = await prisma.phase.create({
      data: { jobId, title: ph.title, emoji: ph.emoji, sortOrder: ph.sortOrder, status: "todo" },
    });
    for (const t of ph.tasks) {
      await prisma.task.create({
        data: { phaseId: phase.id, title: t.title, warning: t.warning, tip: t.tip, sortOrder: t.sortOrder },
      });
    }
  }
}

async function createPhases(jobId: string, phases: { e: string; t: string; tasks: string[] }[]) {
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const phase = await prisma.phase.create({ data: { jobId, title: ph.t, emoji: ph.e, sortOrder: i + 1, status: "todo" } });
    for (let j = 0; j < ph.tasks.length; j++) {
      await prisma.task.create({ data: { phaseId: phase.id, title: ph.tasks[j], sortOrder: j + 1 } });
    }
  }
}
