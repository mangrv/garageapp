/**
 * Backfill cost on service records that were created from a job but have no cost set.
 * Run with: npx tsx scripts/backfill-job-service-costs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all job-linked service records with no cost
  const records = await prisma.serviceRecord.findMany({
    where: {
      jobId: { not: null },
      cost: null,
    },
    select: { id: true, jobId: true, title: true },
  });

  console.log(`Found ${records.length} job-linked service records with no cost.\n`);

  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const jobId = record.jobId!;

    const [receipts, tasks] = await Promise.all([
      prisma.receipt.findMany({ where: { jobId }, select: { totalAmount: true } }),
      prisma.task.findMany({
        where: { phase: { jobId } },
        select: { partsCost: true, laborCost: true },
      }),
    ]);

    const receiptTotal = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
    const taskTotal = tasks.reduce(
      (s, t) => s + (((t as any).partsCost ?? 0) + ((t as any).laborCost ?? 0)),
      0
    );
    const totalCost = receiptTotal + taskTotal;

    if (totalCost > 0) {
      await (prisma.serviceRecord as any).update({
        where: { id: record.id },
        data: { cost: totalCost },
      });
      console.log(`  ✅ ${record.title} → $${totalCost.toFixed(2)}`);
      updated++;
    } else {
      console.log(`  ⚪ ${record.title} → no cost data on job, skipped`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (no job cost data): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
