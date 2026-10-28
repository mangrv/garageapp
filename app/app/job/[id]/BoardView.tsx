"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  toggleTask, addComment, editComment, deleteComment,
  uploadPhoto, updatePhotoCaption, deletePhoto,
  addTask, updateTask, deleteTask, moveTask,
  addPhase, updatePhase, deletePhase,
  updateJob, deleteJob,
  createServiceRecordFromJob,
  saveAsTemplate,
  updateJobTools,
  updatePhaseTools,
} from "./actions";
import { useApp } from "@/app/providers/AppProviders";
import { t } from "@/lib/i18n";
import Glyph from "@/app/components/Glyph";

// ── Types ────────────────────────────────────────────────────────

type Comment = { id: string; text: string; createdAt: string };
type Photo = { id: string; filename: string; caption: string | null; createdAt: string };
type Task = {
  id: string; title: string; done: boolean;
  warning: string | null; tip: string | null; sortOrder: number;
  dueDate: string | null;
  torqueValue: number | null;
  torqueUnit: string | null;
  comments: Comment[]; photos: Photo[];
};
type Phase = {
  id: string; title: string; emoji: string | null; status: string; sortOrder: number;
  toolsJson: string | null;
  tasks: Task[];
};
type Car = { id: string; year: number; make: string; model: string; trim: string | null };
type Job = {
  id: string; title: string; carLabel: string | null; notes: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  carId: string | null;
  shareToken: string | null;
  toolsJson: string | null;
  clonedFromId: string | null;
  clonedFromTitle: string | null;
  phases: Phase[];
};

// ── Helpers ──────────────────────────────────────────────────────

function phaseStatus(phase: Phase): "todo" | "in_progress" | "done" {
  const done = phase.tasks.filter((t) => t.done).length;
  if (done === 0) return "todo";
  if (done === phase.tasks.length) return "done";
  return "in_progress";
}

function toInputDate(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function parseTools(toolsJson: string | null): string[] {
  if (!toolsJson) return [];
  try { return JSON.parse(toolsJson); } catch { return []; }
}

function toolsToText(toolsJson: string | null): string {
  return parseTools(toolsJson).join(", ");
}

function textToToolsJson(text: string): string | null {
  const arr = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (arr.length === 0) return null;
  return JSON.stringify(arr);
}

const STATUS_LABEL: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-700 text-gray-300",
  in_progress: "bg-amber-900 text-amber-400",
  done: "bg-emerald-900 text-emerald-400",
};
const STATUS_BORDER: Record<string, string> = {
  todo: "border-gray-700",
  in_progress: "border-amber-500",
  done: "border-emerald-500",
};

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600";
const labelCls = "block text-xs text-gray-400 mb-1";

// ── Tools section ────────────────────────────────────────────────

function ToolsSection({
  toolsJson,
  jobId,
  phaseId,
}: {
  toolsJson: string | null;
  jobId: string;
  phaseId?: string;
}) {
  const tools = parseTools(toolsJson);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(toolsToText(toolsJson));
  const [pending, startTransition] = useTransition();

  if (tools.length === 0 && !editing) {
    return (
      <button
        onClick={() => { setEditing(true); setOpen(true); }}
        className="text-xs text-gray-600 hover:text-gray-400 ml-1"
        title="Add tools"
      >
        <Glyph e="🧰" /> Add tools
      </button>
    );
  }

  const handleSave = () => {
    const newJson = textToToolsJson(editText);
    startTransition(async () => {
      if (phaseId) {
        await updatePhaseTools(phaseId, newJson, jobId);
      } else {
        await updateJobTools(jobId, newJson);
      }
      setEditing(false);
    });
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5 hover:text-gray-300 transition-colors"
        >
          <Glyph e="🧰" /> {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </button>
        <button
          onClick={() => { setEditing((e) => !e); setEditText(toolsToText(toolsJson)); }}
          className="text-gray-600 text-xs hover:text-amber-400 transition-colors"
          title="Edit tools"
        >
          <Glyph e="✏" />
        </button>
      </div>

      {editing && (
        <div className="mt-2 space-y-1.5">
          <label className={labelCls}>Tools (comma-separated)</label>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="8mm socket, 10mm socket, torque wrench…"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={pending} className="text-xs bg-amber-500 text-on-accent font-bold px-3 py-1.5 rounded-lg disabled:opacity-40">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {open && !editing && tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tools.map((tool, i) => (
            <span key={i} className="text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded-full px-2 py-0.5">
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task photo gallery with shared lightbox ──────────────────────

function TaskPhotos({ photos, jobId }: { photos: Photo[]; jobId: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [pending, startTransition] = useTransition();
  const touchStartX = useRef<number | null>(null);

  const current = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const goPrev = () => setLightboxIndex(i => i !== null ? (i - 1 + photos.length) % photos.length : 0);
  const goNext = () => setLightboxIndex(i => i !== null ? (i + 1) % photos.length : 0);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <>
      {/* Lightbox */}
      {current && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev();
            touchStartX.current = null;
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
            <span className="text-sm text-gray-400">{lightboxIndex + 1} / {photos.length}</span>
            <button onClick={() => setLightboxIndex(null)} className="text-2xl text-gray-300 w-10 h-10 flex items-center justify-center"><Glyph e="✕" /></button>
          </div>

          {/* Image + arrows */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
            {photos.length > 1 && (
              <button onClick={goPrev} className="absolute left-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80">‹</button>
            )}
            <img
              src={`/uploads/${current.filename}`}
              alt={current.caption ?? ""}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
            {photos.length > 1 && (
              <button onClick={goNext} className="absolute right-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80">›</button>
            )}
          </div>

          {/* Dot indicators */}
          {photos.length > 1 && photos.length <= 20 && (
            <div className="flex justify-center gap-1.5 py-2 bg-black/60 flex-shrink-0">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setLightboxIndex(i)}
                  className={`rounded-full transition-all ${i === lightboxIndex ? "w-4 h-1.5 bg-[#ffffff]" : "w-1.5 h-1.5 bg-gray-600"}`} />
              ))}
            </div>
          )}

          {/* Caption / edit */}
          <div className="bg-black/80 px-4 py-3 flex-shrink-0">
            {editingId === current.id ? (
              <div className="flex gap-2">
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  autoFocus
                />
                <button onClick={() => startTransition(async () => { await updatePhotoCaption(current.id, caption, jobId); setEditingId(null); })} disabled={pending} className="bg-amber-500 text-on-accent font-bold px-3 rounded-lg text-sm"><Glyph e="✓" /></button>
                <button onClick={() => setEditingId(null)} className="bg-gray-800 text-gray-300 px-3 rounded-lg text-sm"><Glyph e="✕" /></button>
              </div>
            ) : (
              <p className="text-sm text-gray-300">{current.caption || <span className="text-gray-600">No caption</span>}</p>
            )}
          </div>

          {/* Action bar */}
          {editingId !== current.id && (
            <div className="flex justify-around px-4 py-3 bg-black/90 border-t border-gray-800 flex-shrink-0">
              <button onClick={() => { setCaption(current.caption ?? ""); setEditingId(current.id); }} className="flex flex-col items-center gap-1 text-xs text-gray-300">
                <span className="text-xl"><Glyph e="✏" /></span>Edit
              </button>
              <a href={`/uploads/${current.filename}`} download className="flex flex-col items-center gap-1 text-xs text-gray-300">
                <span className="text-xl"><Glyph e="⬇" /></span>Save
              </a>
              <button onClick={() => {
                if (!confirm("Delete photo?")) return;
                startTransition(async () => {
                  await deletePhoto(current.id, jobId);
                  if (photos.length > 1) setLightboxIndex(Math.min(lightboxIndex, photos.length - 2));
                  else setLightboxIndex(null);
                });
              }} disabled={pending} className="flex flex-col items-center gap-1 text-xs text-red-400 disabled:opacity-40">
                <span className="text-xl"><Glyph e="🗑" /></span>Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Thumbnails */}
      <div className="flex gap-2 flex-wrap">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative group cursor-pointer" onClick={() => setLightboxIndex(index)}>
            <img
              src={`/uploads/${photo.filename}`}
              alt={photo.caption ?? ""}
              className="w-20 h-20 object-cover rounded-lg border border-gray-700 active:opacity-80"
            />
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-lg px-1 py-0.5">
                <p className="text-[10px] text-white truncate">{photo.caption}</p>
              </div>
            )}
            {photos.length > 1 && index === 0 && (
              <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] rounded px-1">1/{photos.length}</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Comment row with edit ────────────────────────────────────────

function CommentRow({ comment, jobId }: { comment: Comment; jobId: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-2 bg-gray-700/50 rounded-lg px-3 py-2">
      {editing ? (
        <div className="flex-1 space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
          />
          <div className="flex gap-1">
            <button onClick={() => startTransition(async () => { await editComment(comment.id, text, jobId); setEditing(false); })} disabled={pending} className="text-xs bg-amber-500 text-on-accent font-bold px-3 py-1 rounded">Save</button>
            <button onClick={() => { setEditing(false); setText(comment.text); }} className="text-xs bg-gray-600 text-gray-300 px-3 py-1 rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 text-sm text-gray-200">{comment.text}</div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="text-gray-500 text-xs active:text-amber-400"><Glyph e="✏" /></button>
            <button onClick={() => startTransition(async () => { await deleteComment(comment.id, jobId); })} disabled={pending} className="text-gray-500 text-xs active:text-red-400"><Glyph e="✕" /></button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────

function TaskRow({ task, jobId, isFirst, isLast }: { task: Task; jobId: string; isFirst: boolean; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingTask, setEditingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState(task.title);
  const [taskWarning, setTaskWarning] = useState(task.warning ?? "");
  const [taskTip, setTaskTip] = useState(task.tip ?? "");
  const [taskDueDate, setTaskDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [taskTorqueValue, setTaskTorqueValue] = useState<string>(task.torqueValue != null ? String(task.torqueValue) : "");
  const [taskTorqueUnit, setTaskTorqueUnit] = useState<string>(task.torqueUnit ?? "ft-lbs");
  const [taskPartsCost, setTaskPartsCost] = useState<string>((task as any).partsCost != null ? String((task as any).partsCost) : "");
  const [taskLaborCost, setTaskLaborCost] = useState<string>((task as any).laborCost != null ? String((task as any).laborCost) : "");
  const [taskPartsNote, setTaskPartsNote] = useState<string>((task as any).partsNote ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOverdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleToggle = () => startTransition(async () => { await toggleTask(task.id, !task.done, jobId); });
  const handleAddComment = () => {
    if (!commentText.trim()) return;
    startTransition(async () => { await addComment(task.id, commentText, jobId); setCommentText(""); setShowCommentBox(false); });
  };
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => { const fd = new FormData(); fd.append("photo", file); fd.append("caption", ""); await uploadPhoto(task.id, jobId, fd); });
  };
  const handleSaveTask = () => {
    const tv = taskTorqueValue !== "" ? parseFloat(taskTorqueValue) : null;
    const pc = taskPartsCost !== "" ? parseFloat(taskPartsCost) : null;
    const lc = taskLaborCost !== "" ? parseFloat(taskLaborCost) : null;
    startTransition(async () => {
      await updateTask(task.id, jobId, taskTitle, taskWarning, taskTip, taskDueDate, tv, tv != null ? taskTorqueUnit : null, pc, lc, taskPartsNote || null);
      setEditingTask(false);
    });
  };
  const handleDeleteTask = () => {
    startTransition(async () => { await deleteTask(task.id, jobId); });
  };

  const totalMedia = task.comments.length + task.photos.length;

  return (
    <div className={`rounded-lg overflow-hidden ${task.done ? "opacity-60" : ""}`}>
      {/* Edit mode */}
      {editingTask ? (
        <div className="bg-gray-800 border border-amber-600 rounded-lg p-3 space-y-2">
          <div>
            <label className={labelCls}>Task title</label>
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Glyph e="⚠" /> Warning (optional)</label>
            <input value={taskWarning} onChange={(e) => setTaskWarning(e.target.value)} placeholder="Safety note…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Glyph e="💡" /> Tip (optional)</label>
            <input value={taskTip} onChange={(e) => setTaskTip(e.target.value)} placeholder="Pro tip…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Glyph e="🔩" /> Torque spec (optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={taskTorqueValue}
                onChange={(e) => setTaskTorqueValue(e.target.value)}
                placeholder="e.g. 13"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                step="0.1"
              />
              <select
                value={taskTorqueUnit}
                onChange={(e) => setTaskTorqueUnit(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="ft-lbs">ft-lbs</option>
                <option value="Nm">Nm</option>
                <option value="in-lbs">in-lbs</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}><Glyph e="💰" /> Parts cost ($)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="number" step="0.01" value={taskPartsCost} onChange={(e) => setTaskPartsCost(e.target.value)} placeholder="Parts $" className={inputCls} />
              </div>
              <div className="flex-1">
                <input type="number" step="0.01" value={taskLaborCost} onChange={(e) => setTaskLaborCost(e.target.value)} placeholder="Labor $" className={inputCls} />
              </div>
            </div>
            <label className={`${labelCls} mt-1`}>Part #s / vendor</label>
            <input value={taskPartsNote} onChange={(e) => setTaskPartsNote(e.target.value)} placeholder="e.g. NGK 9723, Amazon" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><Glyph e="📅" /> Due date (optional)</label>
            <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveTask} disabled={pending} className="flex-1 bg-amber-500 text-on-accent font-bold py-2 rounded-lg text-sm disabled:opacity-40">Save</button>
            <button onClick={() => setEditingTask(false)} className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm">Cancel</button>
          </div>
          {/* Move up/down */}
          <div className="flex gap-2 border-t border-gray-700 pt-2">
            <button
              onClick={() => startTransition(async () => { await moveTask(task.id, "up", jobId); })}
              disabled={pending || isFirst}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-700 text-gray-300 py-2 rounded-lg disabled:opacity-30"
            >↑ Move up</button>
            <button
              onClick={() => startTransition(async () => { await moveTask(task.id, "down", jobId); })}
              disabled={pending || isLast}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-700 text-gray-300 py-2 rounded-lg disabled:opacity-30"
            >↓ Move down</button>
          </div>

          {showDeleteConfirm ? (
            <div className="space-y-1.5 pt-1 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center">Delete task + all its comments and photos?</p>
              <div className="flex gap-2">
                <button onClick={handleDeleteTask} disabled={pending} className="flex-1 bg-red-700 text-on-accent font-semibold py-1.5 rounded-lg text-sm">Yes, delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-700 text-gray-300 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-xs text-red-500 py-1.5 active:bg-red-900/20 rounded-lg"><Glyph e="🗑" /> Delete task</button>
          )}
        </div>
      ) : (
        <>
          {/* Main row */}
          <div className={`flex items-start gap-3 px-3 py-3 ${task.done ? "opacity-60" : ""}`}>
            {/* Custom checkbox */}
            <button
              onClick={handleToggle}
              disabled={pending}
              className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.done
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-500 bg-transparent active:border-emerald-400"
              }`}
            >
              {task.done && <span className="text-white text-xs font-bold"><Glyph e="✓" /></span>}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${task.done ? "line-through text-gray-500" : "text-gray-100"}`}>
                {task.title}
              </p>

                {/* Compact metadata — one item per line, no bubbles for long text */}
              <div className="mt-1 space-y-0.5">
                {isOverdue && (
                  <p className="text-xs text-red-500 font-medium"><Glyph e="⚠" /> Overdue · {new Date(task.dueDate!).toLocaleDateString()}</p>
                )}
                {!isOverdue && task.dueDate && !task.done && (
                  <p className="text-xs text-gray-500"><Glyph e="📅" /> Due {new Date(task.dueDate).toLocaleDateString()}</p>
                )}
                {task.warning && (
                  <p className="text-xs text-amber-500 font-medium"><Glyph e="⚠" /> {task.warning}</p>
                )}
                {task.tip && (
                  <p className="text-xs text-gray-500"><Glyph e="💡" /> {task.tip}</p>
                )}
                {/* Short specs stay as chips */}
                {(task.torqueValue != null || (task as any).partsCost != null || (task as any).laborCost != null) && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {task.torqueValue != null && (
                      <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded-md px-1.5 py-0.5 font-mono">
                        <Glyph e="🔧" /> {task.torqueValue} {task.torqueUnit}
                      </span>
                    )}
                    {(task as any).partsCost != null && (
                      <span className="text-xs bg-emerald-900 text-emerald-400 border border-emerald-700/30 rounded-md px-1.5 py-0.5">
                        Parts ${(task as any).partsCost.toFixed(2)}
                      </span>
                    )}
                    {(task as any).laborCost != null && (
                      <span className="text-xs bg-blue-900 text-blue-400 border border-blue-700/30 rounded-md px-1.5 py-0.5">
                        Labor ${(task as any).laborCost.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex-shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => setEditingTask(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 active:text-amber-400 active:bg-gray-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                onClick={() => setExpanded((x) => !x)}
                className="w-8 h-8 flex flex-col items-center justify-center rounded-lg text-gray-500 active:text-gray-300 active:bg-gray-700 transition-colors"
              >
                {totalMedia > 0 && (
                  <span className="text-[10px] bg-amber-500 text-on-accent font-bold rounded-full w-4 h-4 flex items-center justify-center mb-0.5">{totalMedia}</span>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {expanded ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded */}
          {expanded && (
            <div className="bg-gray-800/60 border-t border-gray-700 px-3 pb-3 pt-2 space-y-3">
              {task.photos.length > 0 && (
                <TaskPhotos photos={task.photos} jobId={jobId} />
              )}
              {task.comments.length > 0 && (
                <div className="space-y-2">
                  {task.comments.map((c) => <CommentRow key={c.id} comment={c} jobId={jobId} />)}
                </div>
              )}
              {showCommentBox ? (
                <div className="space-y-2">
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a note…" rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={handleAddComment} disabled={pending || !commentText.trim()}
                      className="bg-amber-500 text-on-accent font-semibold text-sm px-4 py-2 rounded-lg active:scale-95 disabled:opacity-40">Save</button>
                    <button onClick={() => { setShowCommentBox(false); setCommentText(""); }} className="text-gray-400 text-sm px-3 py-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setShowCommentBox(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700 px-3 py-2 rounded-lg active:bg-gray-600"><Glyph e="💬" /> Add note</button>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700 px-3 py-2 rounded-lg active:bg-gray-600 cursor-pointer">
                    <Glyph e="📷" /> Photo
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Phase card ───────────────────────────────────────────────────

function PhaseCard({ phase, jobId }: { phase: Phase; jobId: string }) {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState(phase.title);
  const [phaseEmoji, setPhaseEmoji] = useState(phase.emoji ?? "");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskWarning, setNewTaskWarning] = useState("");
  const [newTaskTip, setNewTaskTip] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskTorqueValue, setNewTaskTorqueValue] = useState("");
  const [newTaskTorqueUnit, setNewTaskTorqueUnit] = useState("ft-lbs");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const status = phaseStatus(phase);
  const doneCnt = phase.tasks.filter((t) => t.done).length;
  const totalCnt = phase.tasks.length;
  const pct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0;
  const phaseCost = phase.tasks.reduce((sum, t) => sum + ((t as any).partsCost ?? 0) + ((t as any).laborCost ?? 0), 0);

  const handleSavePhase = () => {
    startTransition(async () => { await updatePhase(phase.id, jobId, phaseTitle, phaseEmoji); setEditingPhase(false); });
  };
  const handleDeletePhase = () => {
    startTransition(async () => { await deletePhase(phase.id, jobId); });
  };
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const tv = newTaskTorqueValue !== "" ? parseFloat(newTaskTorqueValue) : null;
    startTransition(async () => {
      await addTask(phase.id, jobId, newTaskTitle, newTaskWarning, newTaskTip, newTaskDueDate, tv, tv != null ? newTaskTorqueUnit : null);
      setNewTaskTitle(""); setNewTaskWarning(""); setNewTaskTip(""); setNewTaskDueDate("");
      setNewTaskTorqueValue(""); setNewTaskTorqueUnit("ft-lbs"); setShowAddTask(false);
    });
  };

  return (
    <div className={`border ${STATUS_BORDER[status]} rounded-xl bg-gray-900 overflow-hidden`}>
      {editingPhase ? (
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Emoji</label>
              <input value={phaseEmoji} onChange={(e) => setPhaseEmoji(e.target.value)} placeholder="" className={`${inputCls} text-center`} />
            </div>
            <div className="col-span-3">
              <label className={labelCls}>Phase title</label>
              <input value={phaseTitle} onChange={(e) => setPhaseTitle(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSavePhase} disabled={pending} className="flex-1 bg-amber-500 text-on-accent font-bold py-2 rounded-lg text-sm disabled:opacity-40">Save</button>
            <button onClick={() => setEditingPhase(false)} className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm">Cancel</button>
          </div>
          {showDeleteConfirm ? (
            <div className="space-y-1.5 pt-1 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center">Delete this phase and all its tasks?</p>
              <div className="flex gap-2">
                <button onClick={handleDeletePhase} disabled={pending} className="flex-1 bg-red-700 text-on-accent font-semibold py-1.5 rounded-lg text-sm">Yes, delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-700 text-gray-300 py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-xs text-red-500 py-1.5"><Glyph e="🗑" /> Delete phase</button>
          )}
        </div>
      ) : (
        <>
          <div className="w-full text-left p-4 flex items-center gap-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
            <span className="text-xl flex-shrink-0">{phase.emoji ?? <Glyph e="📋" />}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-tight">{phase.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status]}`}>
                  {status === "todo" ? t("todo", lang) : status === "in_progress" ? t("inProgress", lang) : t("done", lang)}
                </span>
                <span className="text-xs text-gray-400">{doneCnt}/{totalCnt}</span>
                {phaseCost > 0 && <span className="text-xs text-emerald-400"><Glyph e="💰" /> ${phaseCost.toFixed(2)}</span>}
              </div>
              {/* Phase tools — shown inline, compact chips */}
              {parseTools(phase.toolsJson).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {parseTools(phase.toolsJson).map((tool, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded">{tool}</span>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="text-xs text-gray-700 hover:text-amber-400 px-1"
                    title="Edit phase tools"
                    onClickCapture={(e) => { e.stopPropagation(); }}
                  >
                    <span onClick={(e) => { e.stopPropagation(); setEditingPhase(true); }}><Glyph e="✏" /></span>
                  </button>
                </div>
              )}
              {parseTools(phase.toolsJson).length === 0 && (
                <ToolsSection toolsJson={phase.toolsJson} jobId={jobId} phaseId={phase.id} />
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setEditingPhase(true); }} className="text-gray-600 text-sm active:text-amber-400 px-1"><Glyph e="✏" /></button>
              <div className="flex flex-col items-end gap-1">
                <div className="text-xs text-gray-400">{pct}%</div>
                <div className="text-gray-500 text-sm">{open ? "▲" : "▼"}</div>
              </div>
            </div>
          </div>

          <div className="h-1 bg-gray-800 mx-4 mb-2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${status === "done" ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
          </div>

          {open && (
            <div className="px-3 pb-3 space-y-2">
              {phase.tasks.map((task, idx) => (
                <TaskRow key={task.id} task={task} jobId={jobId} isFirst={idx === 0} isLast={idx === phase.tasks.length - 1} />
              ))}

              {/* Add task */}
              {showAddTask ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2 mt-2">
                  <div className="text-xs font-semibold text-gray-300">+ New task</div>
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title *"
                    className={inputCls} autoFocus />
                  <input value={newTaskWarning} onChange={(e) => setNewTaskWarning(e.target.value)} placeholder="Warning (optional)"
                    className={inputCls} />
                  <input value={newTaskTip} onChange={(e) => setNewTaskTip(e.target.value)} placeholder="Tip (optional)"
                    className={inputCls} />
                  <div>
                    <label className={labelCls}><Glyph e="🔩" /> Torque spec (optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newTaskTorqueValue}
                        onChange={(e) => setNewTaskTorqueValue(e.target.value)}
                        placeholder="e.g. 13"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
                        step="0.1"
                      />
                      <select
                        value={newTaskTorqueUnit}
                        onChange={(e) => setNewTaskTorqueUnit(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        <option value="ft-lbs">ft-lbs</option>
                        <option value="Nm">Nm</option>
                        <option value="in-lbs">in-lbs</option>
                      </select>
                    </div>
                  </div>
                  <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className={inputCls} />
                  <div className="flex gap-2">
                    <button onClick={handleAddTask} disabled={pending || !newTaskTitle.trim()}
                      className="flex-1 bg-amber-500 text-on-accent font-bold py-2 rounded-lg text-sm disabled:opacity-40">Add Task</button>
                    <button onClick={() => { setShowAddTask(false); setNewTaskTitle(""); setNewTaskWarning(""); setNewTaskTip(""); setNewTaskTorqueValue(""); }}
                      className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)}
                  className="w-full border border-dashed border-gray-700 text-xs text-gray-600 py-2.5 rounded-lg active:text-gray-400 active:border-gray-500 mt-1">
                  {t("addTaskBtn", lang)}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Board column ─────────────────────────────────────────────────

function BoardColumn({ label, color, phases, jobId }: { label: string; color: string; phases: Phase[]; jobId: string }) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${color}`}>{label} ({phases.length})</div>
      {phases.length === 0
        ? <div className="border border-dashed border-gray-700 rounded-xl p-6 text-center text-gray-600 text-sm">Empty</div>
        : phases.map((phase) => <PhaseCard key={phase.id} phase={phase} jobId={jobId} />)}
    </div>
  );
}

// ── Job edit panel ───────────────────────────────────────────

function ServiceRecordPrompt({
  project, carId, onDone,
}: {
  project: Job; carId: string; onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(project.title);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [mileage, setMileage] = useState("");
  const [serviceDate, setServiceDate] = useState(project.completedAt ? toInputDate(project.completedAt) : today);
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      await createServiceRecordFromJob({ carId, jobId: project.id, title, notes, mileage, serviceDate });
      onDone();
    });
  };

  return (
    <div className="bg-gray-900 border border-emerald-600 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-lg"><Glyph e="✅" /></span>
        <div>
          <div className="text-sm font-bold text-white">Add to Service History?</div>
          <div className="text-xs text-gray-400">This project is marked done. Save it as a permanent record?</div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Service title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date completed</label>
          <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mileage at service</label>
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="e.g. 87500" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Parts used, observations…" className={inputCls} />
      </div>

      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={pending}
          className="flex-1 bg-emerald-600 text-on-accent font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-40">
          {pending ? "Saving…" : "Yes, add to history"}
        </button>
        <button onClick={onDone} className="flex-1 bg-gray-800 text-gray-400 py-2.5 rounded-xl text-sm">Skip</button>
      </div>
    </div>
  );
}

function ProjectEditPanel({ project, cars, onClose }: { project: Job; cars: Car[]; onClose: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [carId, setCarId] = useState(project.carId ?? "");
  const [status, setStatus] = useState(project.status);
  const [startedAt, setStartedAt] = useState(toInputDate(project.startedAt));
  const [completedAt, setCompletedAt] = useState(toInputDate(project.completedAt));
  const [showDelete, setShowDelete] = useState(false);
  const [showServicePrompt, setShowServicePrompt] = useState(false);
  const [pending, startTransition] = useTransition();

  const prevStatus = project.status;

  const handleSave = () => {
    startTransition(async () => {
      await updateJob(project.id, title, notes, carId, status, startedAt, completedAt);
      // offer service record if just marked done and has a car
      if (status === "done" && prevStatus !== "done" && carId) {
        setShowServicePrompt(true);
      } else {
        onClose();
      }
    });
  };
  const handleDelete = () => {
    startTransition(async () => { await deleteJob(project.id); });
  };

  if (showServicePrompt) {
    return (
      <div className="mx-4 my-2">
        <ServiceRecordPrompt
          project={{ ...project, title, notes, completedAt: completedAt || null }}
          carId={carId}
          onDone={onClose}
        />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-amber-600 rounded-2xl p-4 mx-4 my-2 space-y-3">
      <div className="text-sm font-bold text-white"><Glyph e="✏" /> Edit Job</div>

      <div>
        <label className={labelCls}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Parts list, reminders…" />
      </div>

      <div>
        <label className={labelCls}>Status</label>
        <div className="grid grid-cols-4 gap-1.5">
          {(["todo", "up_next", "in_progress", "blocked", "testing", "done", "archived"] as const).map((s) => {
            const LABELS: Record<string, string> = {
              todo: "To Do", up_next: "Up Next", in_progress: "In Progress",
              blocked: "Blocked", testing: "Testing", done: "Done", archived: "Archived"
            };
            const isSelected = status === s || (s === "in_progress" && status === "active");
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-[11px] py-1.5 px-1 rounded-lg font-medium transition-colors text-center ${
                  isSelected
                    ? s === "blocked" ? "bg-red-600 text-on-accent"
                      : s === "done" ? "bg-emerald-600 text-on-accent"
                      : s === "testing" ? "bg-blue-600 text-on-accent"
                      : s === "up_next" ? "bg-blue-600 text-on-accent"
                      : "bg-amber-500 text-on-accent"
                    : "bg-gray-800 text-gray-400"
                }`}>
                {LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Car</label>
        <div className="space-y-1">
          {cars.map((car) => {
            const label = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
            return (
              <label key={car.id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg cursor-pointer">
                <input type="radio" name="editCarId" value={car.id} checked={carId === car.id} onChange={() => setCarId(car.id)} className="accent-amber-500" />
                <span className="text-sm">{label}</span>
              </label>
            );
          })}
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg cursor-pointer">
            <input type="radio" name="editCarId" value="" checked={carId === ""} onChange={() => setCarId("")} className="accent-amber-500" />
            <span className="text-sm text-gray-400">No car</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Started</label>
          <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Completed</label>
          <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={pending} className="flex-1 bg-amber-500 text-on-accent font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">
          {pending ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">Cancel</button>
      </div>

      <div className="border-t border-gray-800 pt-2">
        {showDelete ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 text-center">Permanently delete this project and all its data?</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={pending} className="flex-1 bg-red-700 text-on-accent font-semibold py-2 rounded-xl text-sm disabled:opacity-40">Yes, delete</button>
              <button onClick={() => setShowDelete(false)} className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="w-full text-xs text-red-500 py-2 active:bg-red-900/20 rounded-lg"><Glyph e="🗑" /> Delete project</button>
        )}
      </div>
    </div>
  );
}

// ── Save as template panel ───────────────────────────────────────

function SaveTemplatePanel({ jobId, projectTitle, onClose }: { jobId: string; projectTitle: string; onClose: () => void }) {
  const [name, setName] = useState(projectTitle);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await saveAsTemplate(jobId, name);
      setSaved(true);
      setTimeout(onClose, 1200);
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mx-4 my-2 space-y-3">
      <div className="text-sm font-bold text-white"><Glyph e="💾" /> Save as Template</div>
      {saved ? (
        <div className="text-center text-emerald-400 py-2 font-medium"><Glyph e="✅" /> Template saved!</div>
      ) : (
        <>
          <div>
            <label className={labelCls}>Template name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
          </div>
          <p className="text-xs text-gray-500">Saves all phases and tasks. You'll find it in "New Job" under My Templates.</p>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={pending || !name.trim()} className="flex-1 bg-amber-500 text-on-accent font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">
              {pending ? "Saving…" : "Save Template"}
            </button>
            <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Add phase panel ──────────────────────────────────────────────

function AddPhasePanel({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [pending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!title.trim()) return;
    startTransition(async () => { await addPhase(jobId, title, emoji); onClose(); });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mx-4 my-2 space-y-3">
      <div className="text-sm font-bold text-white">+ New Phase</div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={labelCls}>Emoji</label>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="" className={`${inputCls} text-center`} />
        </div>
        <div className="col-span-3">
          <label className={labelCls}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Phase name…" className={inputCls} autoFocus />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={pending || !title.trim()} className="flex-1 bg-amber-500 text-on-accent font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">Add Phase</button>
        <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Main BoardView ───────────────────────────────────────────────

type JobTab = "tasks" | "parts" | "photos" | "files";

const TAB_CONFIG: { id: JobTab; label: string; emoji: string }[] = [
  { id: "tasks",  label: "Tasks",  emoji: "🔧" },
  { id: "parts",  label: "Parts",  emoji: "📦" },
  { id: "photos", label: "Photos", emoji: "📷" },
  { id: "files",  label: "Files",  emoji: "📎" },
];

export default function BoardView({ project, cars, totalTasks, doneTasks, pct, receiptTotal, attachmentTotal, hasServiceRecord, activeTab, onTabChange }: {
  project: Job;
  cars: Car[];
  totalTasks: number;
  doneTasks: number;
  pct: number;
  receiptTotal?: number;
  attachmentTotal?: number;
  hasServiceRecord?: boolean;
  activeTab?: JobTab;
  onTabChange?: (tab: JobTab) => void;
}) {
  const { lang } = useApp();
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("list");
  const [showEdit, setShowEdit] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(project.shareToken);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [cloning, setCloning] = useState(false);
  const prevDoneTasks = useRef(doneTasks);

  // Fire service record prompt when last task gets checked off (transition)
  useEffect(() => {
    const justCompleted =
      totalTasks > 0 &&
      doneTasks === totalTasks &&
      prevDoneTasks.current < totalTasks &&
      !hasServiceRecord &&
      !!project.carId;
    if (justCompleted) setShowCompletionPrompt(true);
    prevDoneTasks.current = doneTasks;
  }, [doneTasks, totalTasks, hasServiceRecord, project.carId]);

  // Persistent banner: all tasks done but no service record yet
  const allDoneButNotLogged =
    totalTasks > 0 &&
    doneTasks === totalTasks &&
    !hasServiceRecord &&
    !!project.carId &&
    !showCompletionPrompt;

  function buildShareMessage(url: string) {
    return `Check out this app I built — My Garage \n\nTrack your vehicles, manage repairs, log service history, and more. You can browse as a guest or register free for the full experience.\n\n${url}`;
  }

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch(`/api/jobs/${project.id}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("Clone failed");
      const data = await res.json();
      router.push(`/job/${data.id}`);
    } catch {
      alert("Failed to clone job. Please try again.");
    } finally {
      setCloning(false);
    }
  }

  async function handleShare() {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/jobs/${project.id}/share`, { method: "POST" });
      const data = await res.json();
      setShareToken(data.token);
      const url = `${window.location.origin}/share/${data.token}`;
      await navigator.clipboard.writeText(buildShareMessage(url));
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShare() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(buildShareMessage(url));
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  async function handleRevokeShare() {
    await fetch(`/api/jobs/${project.id}/share`, { method: "DELETE" });
    setShareToken(null);
  }

  const todo = project.phases.filter((p) => phaseStatus(p) === "todo");
  const inProgress = project.phases.filter((p) => phaseStatus(p) === "in_progress");
  const done = project.phases.filter((p) => phaseStatus(p) === "done");
  const totalProjectCost = project.phases.flatMap(ph => ph.tasks).reduce((s, t) => s + ((t as any).partsCost ?? 0) + ((t as any).laborCost ?? 0), 0);

  const statusBadge: Record<string, string> = {
    active: "bg-blue-900 text-blue-400",
    done: "bg-emerald-900 text-emerald-400",
    archived: "bg-gray-700 text-gray-400",
  };

  // Aggregate tools from all phases if project has none
  const projectTools = (() => {
    const direct = parseTools(project.toolsJson);
    if (direct.length > 0) return direct;
    // Fall back: union of all phase tools
    const all = new Set<string>();
    project.phases.forEach(ph => parseTools(ph.toolsJson).forEach(t => all.add(t)));
    return Array.from(all);
  })();

  return (
    <div className="bg-gray-950 w-full max-w-full overflow-x-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 pt-3 pb-3">

        {/* Row 1: Back · Title · Edit icon */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-800 transition-colors text-lg">
            ‹
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-tight truncate text-white">{project.title}</h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                project.status === "done" ? "bg-emerald-900 text-emerald-400" :
                project.status === "archived" ? "bg-gray-800 text-gray-400" :
                project.status === "blocked" ? "bg-red-900 text-red-400" :
                project.status === "testing" ? "bg-blue-900 text-blue-400" :
                project.status === "up_next" ? "bg-blue-900 text-blue-400" :
                project.status === "todo" ? "bg-gray-700 text-gray-300" :
                "bg-amber-900 text-amber-400"
              }`}>{{
                todo: "To Do",
                up_next: "Up Next",
                active: "In Progress",
                in_progress: "In Progress",
                blocked: "Blocked",
                testing: "Testing",
                done: "Done",
                archived: "Archived",
              }[project.status] ?? project.status}</span>
              {project.carLabel && <span className="text-xs text-gray-500 truncate">{project.carLabel}</span>}
              {project.clonedFromId && project.clonedFromTitle && (
                <a
                  href={`/job/${project.clonedFromId}`}
                  className="text-[10px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 truncate"
                  title={`Cloned from: ${project.clonedFromTitle}`}
                >
                  <Glyph e="🔁" /> Cloned from: {project.clonedFromTitle}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => { setShowEdit((o) => !o); setShowAddPhase(false); setShowSaveTemplate(false); setShowExportMenu(false); }}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${showEdit ? "bg-amber-500 text-on-accent" : "text-gray-400 active:bg-gray-800"}`}>
            {showEdit ? <Glyph e="✕" /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Row 2: Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{doneTasks}/{totalTasks} tasks</span>
            {(() => { const total = (receiptTotal ?? 0) + (attachmentTotal ?? 0) + totalProjectCost; return total > 0 ? <span className="text-emerald-400"><Glyph e="💰" /> ${total.toFixed(2)}</span> : null; })()}
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Row 3: Action strip */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={shareToken ? handleCopyShare : handleShare}
            disabled={shareLoading}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors border ${
              shareCopied ? "bg-emerald-600 text-on-accent border-transparent" :
              shareToken ? "border-emerald-700 text-emerald-400" :
              "border-gray-700 text-gray-400 active:border-gray-500"
            }`}>
            <Glyph e="🔗" /> {shareCopied ? "Copied!" : shareToken ? "Shared" : shareLoading ? "…" : "Share"}
          </button>
          <button
            onClick={() => { setShowExportMenu((o) => !o); setShowSaveTemplate(false); setShowEdit(false); setShowAddPhase(false); }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors border ${
              showExportMenu || showSaveTemplate ? "bg-amber-500 text-on-accent border-transparent" : "border-gray-700 text-gray-400 active:border-gray-500"
            }`}>
            ••• More
          </button>
          <div className="flex-shrink-0 flex rounded-xl overflow-hidden border border-gray-700">
            <button onClick={() => setView("list")} className={`px-3 py-2 text-xs transition-colors ${view === "list" ? "bg-gray-700 text-white" : "text-gray-500 active:bg-gray-800"}`}><Glyph e="☰" /></button>
            <button onClick={() => setView("board")} className={`px-3 py-2 text-xs transition-colors border-l border-gray-700 ${view === "board" ? "bg-gray-700 text-white" : "text-gray-500 active:bg-gray-800"}`}>⊞</button>
          </div>
        </div>

        {/* Row 4: Tab bar */}
        {onTabChange && (
          <div className="mt-3 flex border-b border-gray-800 -mx-4 px-4">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <span><Glyph e={tab.emoji} /></span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Row 5: Tools + torque summary (compact text links, no colored pills) */}
        {(!onTabChange || activeTab === "tasks") && (
        <div className="mt-2.5 flex flex-wrap gap-3 items-center">
          {projectTools.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 select-none active:text-gray-300">
                  <Glyph e="🧰" /> {projectTools.length} tools needed
                </span>
              </summary>
              <div className="absolute left-0 right-0 mx-4 mt-1 bg-gray-900 border border-gray-700 rounded-xl p-3 z-20 shadow-xl">
                <div className="text-xs text-gray-400 font-semibold mb-2"><Glyph e="🧰" /> Tools needed for this job</div>
                <div className="flex flex-wrap gap-1.5">
                  {projectTools.map((t, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <button onClick={() => { const d = document.querySelector('details'); if (d) d.removeAttribute('open'); }} className="text-xs text-gray-600">close</button>
                </div>
              </div>
            </details>
          )}

          {/* Torque specs summary pill */}
          {(() => {
            const torqueTasks = project.phases.flatMap(ph =>
              ph.tasks
                .filter(t => (t as any).torqueValue != null)
                .map(t => ({
                  phase: ph.title,
                  phaseEmoji: ph.emoji ?? "",
                  sortOrder: ph.sortOrder,
                  title: t.title,
                  val: (t as any).torqueValue,
                  unit: (t as any).torqueUnit,
                }))
            );
            if (torqueTasks.length === 0) return null;
            return (
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 select-none active:text-gray-300">
                    <Glyph e="🔩" /> {torqueTasks.length} torque spec{torqueTasks.length !== 1 ? "s" : ""}
                  </span>
                </summary>
                <div className="absolute left-0 right-0 mx-4 mt-1 bg-gray-900 border border-gray-700 rounded-xl p-3 z-20 shadow-xl">
                  <div className="text-xs text-gray-400 font-semibold mb-2"><Glyph e="🔩" /> Torque specifications</div>
                  <div className="space-y-2">
                    {torqueTasks.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border-b border-gray-800 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-500 text-xs"><Glyph e={t.phaseEmoji} /> {t.phase}</div>
                          <div className="text-gray-200 mt-0.5 leading-snug">{t.title}</div>
                        </div>
                        <span className="text-orange-300 font-mono font-bold flex-shrink-0 bg-orange-900/30 px-2 py-0.5 rounded-lg">
                          {t.val} {t.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })()}

          <div className="ml-auto">
            <ToolsSection toolsJson={project.toolsJson} jobId={project.id} />
          </div>
        </div>
        )}
      </header>

      {/* All-tasks-done → service record prompt (triggered by last task check) */}
      {(!activeTab || activeTab === "tasks") && showCompletionPrompt && project.carId && (
        <div className="mx-4 mt-3">
          <ServiceRecordPrompt
            project={project}
            carId={project.carId}
            onDone={() => setShowCompletionPrompt(false)}
          />
        </div>
      )}

      {/* Persistent nudge — theme-safe colors */}
      {allDoneButNotLogged && (
        <div className="mx-4 mt-3 bg-emerald-600 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white"><Glyph e="✅" /> All tasks complete!</div>
            <div className="text-xs text-emerald-100 mt-0.5">Log this job as a service record?</div>
          </div>
          <button
            onClick={() => setShowCompletionPrompt(true)}
            className="flex-shrink-0 bg-[#ffffff] text-[#047857] text-xs font-bold px-4 py-2 rounded-xl"
          >
            Log it
          </button>
        </div>
      )}

      {/* Share link banner */}
      {shareToken && (
        <div className="mx-4 mt-3 bg-emerald-950/60 border border-emerald-800 rounded-xl px-3 py-2.5 text-xs text-emerald-300 flex items-center justify-between gap-2">
          <span><Glyph e="🔗" /> Shared — <span className="font-mono opacity-60">/share/{shareToken.slice(0, 8)}…</span></span>
          <div className="flex gap-2">
            <button onClick={handleCopyShare} className="underline text-emerald-400">
              {shareCopied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={handleRevokeShare} className="underline text-red-400">Revoke</button>
          </div>
        </div>
      )}

      {/* Notes banner (if set) */}
      {project.notes && !showEdit && (
        <div className="mx-4 mt-3 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-400 whitespace-pre-wrap">
          <Glyph e="📝" /> {project.notes}
        </div>
      )}

      {/* Edit panel */}
      {showEdit && <ProjectEditPanel project={project} cars={cars} onClose={() => setShowEdit(false)} />}

      {/* Add phase panel */}
      {showAddPhase && <AddPhasePanel jobId={project.id} onClose={() => setShowAddPhase(false)} />}

      {/* More action sheet — Export + Template */}
      {showExportMenu && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mx-4 my-2 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">More Options</div>

          {/* Log as Service Record — always show when job has a car and no record yet */}
          {project.carId && !hasServiceRecord && (
            <button
              onClick={() => { setShowCompletionPrompt(true); setShowExportMenu(false); }}
              className="w-full flex items-center gap-3 bg-emerald-900/40 border border-emerald-700/50 text-emerald-200 px-3 py-3 rounded-xl text-sm active:bg-emerald-900 text-left">
              <span className="text-lg"><Glyph e="📋" /></span>
              <div>
                <div className="font-semibold text-sm">Log as Service Record</div>
                <div className="text-xs text-emerald-400/70">Add this job to your vehicle&apos;s service history</div>
              </div>
            </button>
          )}

          {/* Clone Job */}
          <button
            onClick={() => { setShowExportMenu(false); handleClone(); }}
            disabled={cloning}
            className="w-full flex items-center gap-3 bg-gray-800 text-gray-200 px-3 py-3 rounded-xl text-sm active:bg-gray-700 text-left disabled:opacity-50">
            <span className="text-lg"><Glyph e="🔁" /></span>
            <div>
              <div className="font-semibold text-sm">{cloning ? "Cloning…" : "Clone Job"}</div>
              <div className="text-xs text-gray-500">Copy all phases &amp; tasks, reset completion state</div>
            </div>
          </button>

          {/* Save as Template */}
          <button
            onClick={() => { setShowSaveTemplate((o) => !o); }}
            className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-750 text-gray-200 px-3 py-3 rounded-xl text-sm active:bg-gray-700 text-left">
            <span className="text-lg"><Glyph e="📁" /></span>
            <div>
              <div className="font-semibold text-sm">Save as Template</div>
              <div className="text-xs text-gray-500">Reuse this job&apos;s phases &amp; tasks in future jobs</div>
            </div>
          </button>

          {showSaveTemplate && (
            <div className="pl-2">
              <SaveTemplatePanel jobId={project.id} projectTitle={project.title} onClose={() => { setShowSaveTemplate(false); setShowExportMenu(false); }} />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-800 pt-2">
            <div className="text-xs text-gray-600 mb-2 px-1">Download a copy</div>
            <div className="flex gap-2">
              <a href={`/api/export/job/${project.id}?fmt=md`} download
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-gray-300 px-3 py-2.5 rounded-xl text-xs font-medium active:bg-gray-700">
                <Glyph e="📝" /> Markdown
              </a>
              <a href={`/api/export/job/${project.id}?fmt=json`} download
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-gray-300 px-3 py-2.5 rounded-xl text-xs font-medium active:bg-gray-700">
                <Glyph e="🗂" /> JSON
              </a>
            </div>
          </div>

          <button onClick={() => { setShowExportMenu(false); setShowSaveTemplate(false); }} className="w-full text-xs text-gray-500 py-1.5 mt-1">
            Close
          </button>
        </div>
      )}

      {(!activeTab || activeTab === "tasks") && (
        <main className="p-4">
          {view === "list" ? (
            <div className="space-y-3">
              {project.phases.map((phase) => <PhaseCard key={phase.id} phase={phase} jobId={project.id} />)}
              <button onClick={() => { setShowAddPhase((o) => !o); setShowEdit(false); }}
                className="w-full border border-dashed border-gray-700 text-sm text-gray-500 py-3 rounded-xl active:text-gray-300 active:border-gray-500">
                {t("addPhase", lang)}
              </button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1"><BoardColumn label={t("todo", lang)} color="bg-gray-800 text-gray-300" phases={todo} jobId={project.id} /></div>
              <div className="flex-1"><BoardColumn label={t("inProgress", lang)} color="bg-amber-900 text-amber-200" phases={inProgress} jobId={project.id} /></div>
              <div className="flex-1"><BoardColumn label={t("done", lang)} color="bg-emerald-900 text-emerald-200" phases={done} jobId={project.id} /></div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
