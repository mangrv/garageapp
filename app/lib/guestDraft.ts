/**
 * Guest Draft Store
 * All guest data lives in localStorage under "garage_guest_draft".
 * No DB writes happen until the user registers/signs in and imports.
 */

export type GuestCar = {
  _draftId: string;
  assetType: string;
  relationshipToUser?: string;
  managedOwnerName?: string;
  managedOwnerContact?: string;
  managedOwnerNotes?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  color?: string;
  mileage?: number;
  notes?: string;
};

export type GuestServiceRecord = {
  _draftId: string;
  _carDraftId: string; // links to GuestCar._draftId
  title: string;
  serviceDate: string;
  mileage?: number;
  cost?: number;
  notes?: string;
  serviceType?: string;
  parts?: GuestPart[];
};

export type GuestPart = {
  _draftId: string;
  name: string;
  quantity: number;
  amount?: number;
  warrantyProvider?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyNotes?: string;
};

export type GuestJob = {
  _draftId: string;
  _carDraftId?: string;
  title: string;
  status: string;
  tasks?: GuestTask[];
};

export type GuestTask = {
  _draftId: string;
  title: string;
  done: boolean;
  notes?: string;
};

export type GuestReceipt = {
  _draftId: string;
  _serviceRecordDraftId?: string;
  vendor?: string;
  totalAmount?: number;
  receiptDate?: string;
  notes?: string;
  lineItems?: GuestPart[];
};

export type GuestDraft = {
  version: number;
  inviteToken?: string;
  cars: GuestCar[];
  serviceRecords: GuestServiceRecord[];
  jobs: GuestJob[];
  receipts: GuestReceipt[];
};

const KEY = "garage_guest_draft";
const VERSION = 1;

export function emptyDraft(): GuestDraft {
  return { version: VERSION, cars: [], serviceRecords: [], jobs: [], receipts: [] };
}

export function loadDraft(): GuestDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as GuestDraft;
    return d.version === VERSION ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: GuestDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem("garage_guest_mode");
}

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("garage_guest_mode") === "1";
}

export function enterGuestMode(inviteToken?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("garage_guest_mode", "1");
  const existing = loadDraft() ?? emptyDraft();
  if (inviteToken) existing.inviteToken = inviteToken;
  saveDraft(existing);
}

export function hasDraft(): boolean {
  const d = loadDraft();
  if (!d) return false;
  return d.cars.length > 0 || d.serviceRecords.length > 0 || d.jobs.length > 0 || d.receipts.length > 0;
}

export function draftSummary(draft: GuestDraft): string {
  const parts = [];
  if (draft.cars.length) parts.push(`${draft.cars.length} car${draft.cars.length > 1 ? "s" : ""}`);
  if (draft.serviceRecords.length) parts.push(`${draft.serviceRecords.length} service record${draft.serviceRecords.length > 1 ? "s" : ""}`);
  if (draft.jobs.length) parts.push(`${draft.jobs.length} job${draft.jobs.length > 1 ? "s" : ""}`);
  if (draft.receipts.length) parts.push(`${draft.receipts.length} receipt${draft.receipts.length > 1 ? "s" : ""}`);
  return parts.join(", ") || "empty draft";
}

export function draftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
