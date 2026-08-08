import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JOB: { emoji: string; title: string; tasks: { title: string; warning?: string; tip?: string }[] }[] = [
  {
    emoji: "1️⃣",
    title: "Prep the Work Area",
    tasks: [
      { title: "Let engine cool completely" },
      { title: "Disconnect negative battery terminal" },
      { title: "Remove engine cover" },
      { title: "Set up magnetic trays" },
      { title: "Lay rags over fenders" },
      { title: "Put cardboard under car" },
      { title: "Tools ready: 8mm, 10mm, 13mm" },
      { title: "Extensions ready" },
      { title: "Spark plug socket ready" },
      { title: "Torque wrench ready" },
    ],
  },
  {
    emoji: "2️⃣",
    title: "Remove Intake System",
    tasks: [
      { title: "Remove air intake tube" },
      { title: "Remove air box lid if needed" },
      { title: "Disconnect MAF sensor" },
      { title: "Disconnect throttle body connector" },
      { title: "Remove throttle body bolts" },
      { title: "Pull off throttle body — set aside" },
    ],
  },
  {
    emoji: "3️⃣",
    title: "Clean Throttle Body (Quick Win)",
    tasks: [
      { title: "Spray throttle body cleaner" },
      { title: "Clean throttle plate" },
      { title: "Clean inside bore" },
      { title: "Use microfiber or lint-free rag" },
      { title: "Set aside — install new gasket during reassembly", tip: "Don't install gasket yet — do it in Step 15" },
    ],
  },
  {
    emoji: "4️⃣",
    title: "Remove Intake Manifold",
    tasks: [
      { title: "Disconnect MAP sensor" },
      { title: "Disconnect EVAP line" },
      { title: "Disconnect PCV hose" },
      { title: "Disconnect injector harness clips" },
      { title: "Remove intake manifold bolts" },
      { title: "Lift manifold slowly" },
      { title: "Cover intake ports with clean rags", warning: "⚠️ Do this immediately — dropped bolts = engine destruction" },
    ],
  },
  {
    emoji: "5️⃣",
    title: "First Inspection Phase",
    tasks: [
      { title: "Check: Oil pooled around oil cooler", tip: "Very common on Pentastar" },
      { title: "Check: Spark plug wells for oil" },
      { title: "Check: Intake ports carbon level" },
      { title: "Check: Wiring harness brittleness" },
      { title: "📸 Take photos NOW — document everything" },
    ],
  },
  {
    emoji: "6️⃣",
    title: "Remove Ignition Coils",
    tasks: [
      { title: "Remove coil bolts" },
      { title: "Remove ignition coils" },
      { title: "Inspect coil boots" },
      { title: "If boots clean → set aside for reinstall" },
    ],
  },
  {
    emoji: "7️⃣",
    title: "Replace Spark Plugs",
    tasks: [
      { title: "Blow debris out of wells (compressed air or bulb)" },
      { title: "Remove old spark plugs" },
      { title: "Install new spark plugs" },
      { title: "Torque to 13 ft-lb" },
      { title: "Optional: Tiny amount of dielectric grease on coil boots", tip: "Prevents boots from sticking to plugs later" },
    ],
  },
  {
    emoji: "8️⃣",
    title: "Remove Oil Cooler Housing",
    tasks: [
      { title: "Disconnect oil pressure sensor connector" },
      { title: "Disconnect coolant lines" },
      { title: "Disconnect oil temp sensor" },
      { title: "Remove cooler bolts" },
      { title: "Lift cooler assembly out" },
    ],
  },
  {
    emoji: "9️⃣",
    title: "Clean Engine Valley",
    tasks: [
      { title: "Clean pooled oil with paper towels" },
      { title: "Spray brake cleaner on sludge/dirt" },
      { title: "Wipe clean — repeat until aluminum looks dry" },
      { title: "Verify no debris near oil passages", warning: "⚠️ Do NOT let debris fall into oil passages" },
    ],
  },
  {
    emoji: "🔟",
    title: "Replace Oil Pressure Sending Unit",
    tasks: [
      { title: "Remove old sensor from cooler housing" },
      { title: "Install new sensor", tip: "Snug only — do NOT overtighten" },
    ],
  },
  {
    emoji: "1️⃣1️⃣",
    title: "Replace PCV Valve",
    tasks: [
      { title: "Unscrew old PCV valve" },
      { title: "Install new PCV valve", tip: "Takes about 30 seconds" },
    ],
  },
  {
    emoji: "1️⃣2️⃣",
    title: "Install New Oil Cooler Housing",
    tasks: [
      { title: "Clean mating surface again with brake cleaner" },
      { title: "Place new cooler unit in position" },
      { title: "Hand thread all bolts first" },
      { title: "Torque bolts: center → outward pattern" },
      { title: "Torque to 8–9 Nm (70–80 in-lb)", warning: "⚠️ Do NOT overtighten — #1 DIY mistake on this job" },
    ],
  },
  {
    emoji: "1️⃣3️⃣",
    title: "Final Cleaning",
    tasks: [
      { title: "Clean intake manifold interior" },
      { title: "Clean throttle body mounting area" },
      { title: "Clean any spilled oil", tip: "Prevents false leak scares after startup" },
    ],
  },
  {
    emoji: "1️⃣4️⃣",
    title: "Reinstall Intake Manifold",
    tasks: [
      { title: "Remove all intake port rags — count them" },
      { title: "Install intake manifold" },
      { title: "Torque manifold bolts in cross pattern" },
      { title: "Reconnect injector harness" },
      { title: "Reconnect MAP sensor" },
      { title: "Reconnect EVAP line" },
      { title: "Reconnect PCV hose" },
    ],
  },
  {
    emoji: "1️⃣5️⃣",
    title: "Reinstall Throttle Body",
    tasks: [
      { title: "Install new throttle body gasket" },
      { title: "Install throttle body" },
      { title: "Reconnect throttle body connector" },
    ],
  },
  {
    emoji: "1️⃣6️⃣",
    title: "Reinstall Intake Tube",
    tasks: [
      { title: "Reconnect intake hose" },
      { title: "Reconnect MAF sensor" },
    ],
  },
  {
    emoji: "1️⃣7️⃣",
    title: "Fluids",
    tasks: [
      { title: "Check coolant reservoir level" },
      { title: "Top off coolant if needed" },
    ],
  },
  {
    emoji: "1️⃣8️⃣",
    title: "First Startup",
    tasks: [
      { title: "Reconnect negative battery terminal" },
      { title: "Start engine" },
      { title: "Expect slightly rough idle for ~10 seconds (normal — ECU recalibrating)" },
      { title: "Check for oil leaks" },
      { title: "Check for coolant leaks" },
      { title: "📸 Record first startup on GoPro / Canon 80D" },
      { title: "⏰ REMINDER: Recheck coolant level next morning", tip: "Air pockets purge overnight — always check the day after" },
    ],
  },
];

async function main() {
  console.log("Seeding...");

  // wipe existing
  await prisma.task.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.job.deleteMany();

  const project = await prisma.job.create({
    data: {
      title: "Pentastar Oil Cooler + Throttle Body Service",
      notes: "Full job: oil cooler housing replacement, throttle body clean, spark plugs, PCV, oil pressure sensor",
      status: "active",
    },
  });

  for (let i = 0; i < JOB.length; i++) {
    const phaseData = JOB[i];
    const phase = await prisma.phase.create({
      data: {
        jobId: project.id,
        title: phaseData.title,
        emoji: phaseData.emoji,
        sortOrder: i + 1,
        status: "todo",
      },
    });

    for (let j = 0; j < phaseData.tasks.length; j++) {
      const task = phaseData.tasks[j];
      await prisma.task.create({
        data: {
          phaseId: phase.id,
          title: task.title,
          warning: task.warning ?? null,
          tip: task.tip ?? null,
          sortOrder: j + 1,
          done: false,
        },
      });
    }
  }

  console.log(`✅ Created project "${project.title}" with ${JOB.length} phases`);
  await prisma.$disconnect();
}

main().catch(console.error);
