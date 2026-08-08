"use client";

import { useRouter, useSearchParams } from "next/navigation";
import BoardView from "./BoardView";
import JobBOM from "./JobBOM";
import JobPhotoGallery from "./JobPhotoGallery";
import JobAttachments from "./JobAttachments";
import JobReceipts from "@/app/components/JobReceipts";

export type JobTab = "tasks" | "parts" | "photos" | "files";
const VALID_TABS = new Set<JobTab>(["tasks", "parts", "photos", "files"]);

export default function JobPageClient({
  project,
  cars,
  totalTasks,
  doneTasks,
  pct,
  receiptTotal,
  attachmentTotal,
  hasServiceRecord,
  jobId,
  serializedPhotos,
  serializedBomItems,
  receiptLineItems,
  taskPartsNotes,
  laborTotal,
  serializedAttachments,
  serializedReceipts,
}: {
  project: any;
  cars: any[];
  totalTasks: number;
  doneTasks: number;
  pct: number;
  receiptTotal: number;
  attachmentTotal: number;
  hasServiceRecord: boolean;
  jobId: string;
  serializedPhotos: any[];
  serializedBomItems: any[];
  receiptLineItems: any[];
  taskPartsNotes: any[];
  laborTotal: number;
  serializedAttachments: any[];
  serializedReceipts: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") as JobTab | null;
  const activeTab: JobTab = raw && VALID_TABS.has(raw) ? raw : "tasks";

  const setActiveTab = (tab: JobTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "tasks") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(`?${qs}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <BoardView
        project={project}
        cars={cars}
        totalTasks={totalTasks}
        doneTasks={doneTasks}
        pct={pct}
        receiptTotal={receiptTotal}
        attachmentTotal={attachmentTotal}
        hasServiceRecord={hasServiceRecord}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content below the sticky header */}
      <div className="px-4 pb-24 max-w-2xl mx-auto pt-4">
        {activeTab === "tasks" && null /* tasks rendered inside BoardView */}

        {activeTab === "parts" && (
          <JobBOM
            jobId={jobId}
            initialItems={serializedBomItems}
            receiptItems={receiptLineItems}
            taskParts={taskPartsNotes}
            laborTotal={laborTotal}
          />
        )}

        {activeTab === "photos" && (
          <JobPhotoGallery jobId={jobId} initialPhotos={serializedPhotos} initialFeedCaption={project.feedCaption ?? null} />
        )}

        {activeTab === "files" && (
          <div className="space-y-6">
            <JobAttachments jobId={jobId} initialAttachments={serializedAttachments} />
            <div className="border-t border-gray-800" />
            <JobReceipts jobId={jobId} initialReceipts={serializedReceipts} />
          </div>
        )}
      </div>
    </div>
  );
}
