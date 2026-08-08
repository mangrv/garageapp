"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  GuestDraft, GuestCar, GuestServiceRecord, GuestJob, GuestReceipt,
  loadDraft, saveDraft, emptyDraft, isGuestMode, hasDraft, draftId, draftSummary,
} from "@/lib/guestDraft";

interface GuestContextValue {
  isGuest: boolean;
  draft: GuestDraft;
  hasDraftData: boolean;
  draftLabel: string;
  enterGuest: (inviteToken?: string) => void;
  exitGuest: () => void;
  addCar: (car: Omit<GuestCar, "_draftId">) => GuestCar;
  updateCar: (draftId: string, patch: Partial<GuestCar>) => void;
  removeCar: (draftId: string) => void;
  addServiceRecord: (sr: Omit<GuestServiceRecord, "_draftId">) => GuestServiceRecord;
  updateServiceRecord: (draftId: string, patch: Partial<GuestServiceRecord>) => void;
  removeServiceRecord: (draftId: string) => void;
  addJob: (job: Omit<GuestJob, "_draftId">) => GuestJob;
  updateJob: (draftId: string, patch: Partial<GuestJob>) => void;
  removeJob: (draftId: string) => void;
  addReceipt: (receipt: Omit<GuestReceipt, "_draftId">) => GuestReceipt;
  updateReceipt: (draftId: string, patch: Partial<GuestReceipt>) => void;
  removeReceipt: (draftId: string) => void;
}

const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  draft: emptyDraft(),
  hasDraftData: false,
  draftLabel: "",
  enterGuest: () => {},
  exitGuest: () => {},
  addCar: () => ({ _draftId: "", assetType: "vehicle", year: 2024, make: "", model: "" }),
  updateCar: () => {},
  removeCar: () => {},
  addServiceRecord: () => ({ _draftId: "", _carDraftId: "", title: "", serviceDate: "" }),
  updateServiceRecord: () => {},
  removeServiceRecord: () => {},
  addJob: () => ({ _draftId: "", title: "", status: "active" }),
  updateJob: () => {},
  removeJob: () => {},
  addReceipt: () => ({ _draftId: "" }),
  updateReceipt: () => {},
  removeReceipt: () => {},
});

export function useGuest() {
  return useContext(GuestContext);
}

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [draft, setDraftState] = useState<GuestDraft>(emptyDraft());

  useEffect(() => {
    const guest = isGuestMode();
    const d = loadDraft() ?? emptyDraft();
    setIsGuest(guest);
    setDraftState(d);
  }, []);

  const persist = useCallback((updated: GuestDraft) => {
    setDraftState(updated);
    saveDraft(updated);
  }, []);

  const enterGuest = (inviteToken?: string) => {
    localStorage.setItem("garage_guest_mode", "1");
    const d = loadDraft() ?? emptyDraft();
    if (inviteToken) d.inviteToken = inviteToken;
    persist(d);
    setIsGuest(true);
  };

  const exitGuest = () => {
    localStorage.removeItem("garage_guest_mode");
    setIsGuest(false);
  };

  // --- Cars ---
  const addCar = (car: Omit<GuestCar, "_draftId">): GuestCar => {
    const item: GuestCar = { ...car, _draftId: draftId() };
    persist({ ...draft, cars: [...draft.cars, item] });
    return item;
  };
  const updateCar = (id: string, patch: Partial<GuestCar>) => {
    persist({ ...draft, cars: draft.cars.map((c) => c._draftId === id ? { ...c, ...patch } : c) });
  };
  const removeCar = (id: string) => {
    persist({ ...draft, cars: draft.cars.filter((c) => c._draftId !== id) });
  };

  // --- Service Records ---
  const addServiceRecord = (sr: Omit<GuestServiceRecord, "_draftId">): GuestServiceRecord => {
    const item: GuestServiceRecord = { ...sr, _draftId: draftId() };
    persist({ ...draft, serviceRecords: [...draft.serviceRecords, item] });
    return item;
  };
  const updateServiceRecord = (id: string, patch: Partial<GuestServiceRecord>) => {
    persist({ ...draft, serviceRecords: draft.serviceRecords.map((s) => s._draftId === id ? { ...s, ...patch } : s) });
  };
  const removeServiceRecord = (id: string) => {
    persist({ ...draft, serviceRecords: draft.serviceRecords.filter((s) => s._draftId !== id) });
  };

  // --- Jobs ---
  const addJob = (job: Omit<GuestJob, "_draftId">): GuestJob => {
    const item: GuestJob = { ...job, _draftId: draftId() };
    persist({ ...draft, jobs: [...draft.jobs, item] });
    return item;
  };
  const updateJob = (id: string, patch: Partial<GuestJob>) => {
    persist({ ...draft, jobs: draft.jobs.map((j) => j._draftId === id ? { ...j, ...patch } : j) });
  };
  const removeJob = (id: string) => {
    persist({ ...draft, jobs: draft.jobs.filter((j) => j._draftId !== id) });
  };

  // --- Receipts ---
  const addReceipt = (receipt: Omit<GuestReceipt, "_draftId">): GuestReceipt => {
    const item: GuestReceipt = { ...receipt, _draftId: draftId() };
    persist({ ...draft, receipts: [...draft.receipts, item] });
    return item;
  };
  const updateReceipt = (id: string, patch: Partial<GuestReceipt>) => {
    persist({ ...draft, receipts: draft.receipts.map((r) => r._draftId === id ? { ...r, ...patch } : r) });
  };
  const removeReceipt = (id: string) => {
    persist({ ...draft, receipts: draft.receipts.filter((r) => r._draftId !== id) });
  };

  return (
    <GuestContext.Provider value={{
      isGuest,
      draft,
      hasDraftData: hasDraft(),
      draftLabel: draftSummary(draft),
      enterGuest,
      exitGuest,
      addCar, updateCar, removeCar,
      addServiceRecord, updateServiceRecord, removeServiceRecord,
      addJob, updateJob, removeJob,
      addReceipt, updateReceipt, removeReceipt,
    }}>
      {children}
    </GuestContext.Provider>
  );
}
