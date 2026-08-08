"use client";

import { useEffect, useState } from "react";
import { hasDraft, clearDraft } from "@/lib/guestDraft";
import GuestImportPrompt from "./GuestImportPrompt";

export default function GuestImportBridge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hasDraft()) {
      setShow(true);
    } else {
      // User is authenticated (on home page), clear any lingering guest mode flag
      localStorage.removeItem("garage_guest_mode");
    }
  }, []);

  if (!show) return null;

  return (
    <div className="px-4 pt-4 max-w-lg mx-auto">
      <GuestImportPrompt onDone={() => {
        setShow(false);
        // Always clear guest mode when done with import prompt
        localStorage.removeItem("garage_guest_mode");
        clearDraft();
        window.location.reload();
      }} />
    </div>
  );
}
