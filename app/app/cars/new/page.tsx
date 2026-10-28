import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import CarForm from "./CarForm";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export default function NewCar() {
  async function create(formData: FormData) {
    "use server";
    const session = await requireSession();
    const assetType = String(formData.get("assetType") || "vehicle").trim() || "vehicle";
    const relationshipRaw = String(formData.get("relationshipToUser") || "owned").trim();
    const relationshipToUser = ["owned", "family", "friend_customer", "other"].includes(relationshipRaw) ? relationshipRaw : "owned";
    const managedOwnerName = relationshipToUser === "owned" ? null : (String(formData.get("managedOwnerName") || "").trim() || null);
    const managedOwnerContact = relationshipToUser === "owned" ? null : (String(formData.get("managedOwnerContact") || "").trim() || null);
    const managedOwnerNotes = relationshipToUser === "owned" ? null : (String(formData.get("managedOwnerNotes") || "").trim() || null);
    const yearRaw = parseInt(String(formData.get("year") || "0"));
    const make = String(formData.get("make") || "").trim();
    const model = String(formData.get("model") || "").trim();
    const trim = String(formData.get("trim") || "").trim() || null;
    const color = String(formData.get("color") || "").trim() || null;
    const mileage = parseInt(String(formData.get("mileage") || "0")) || null;
    const vin = String(formData.get("vin") || "").trim() || null;
    const transmission = String(formData.get("transmission") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;
    // Bicycle-specific
    const bikeType = String(formData.get("bikeType") || "").trim() || null;
    const frameSize = String(formData.get("frameSize") || "").trim() || null;
    const wheelSize = String(formData.get("wheelSize") || "").trim() || null;

    // For bicycles, year is optional (default 0 → store as current year if blank)
    const year = yearRaw || (assetType === "bicycle" ? new Date().getFullYear() : 0);

    if (!make || !model) return;
    if (assetType !== "bicycle" && !year) return;

    await (prisma.car as any).create({
      data: {
        id: randomUUID(),
        userId: session.userId,
        assetType,
        relationshipToUser,
        managedOwnerName,
        managedOwnerContact,
        managedOwnerNotes,
        year,
        make,
        model,
        trim,
        color,
        mileage,
        vin,
        transmission: assetType === "vehicle" ? (transmission || null) : null,
        notes,
        bikeType,
        frameSize,
        wheelSize,
      },
    });
    void trackServerMatomoEvent({ category: "Garage", action: "vehicle_added", name: assetType, userId: session.userId, path: "/cars/new" });

    redirect("/dashboard");
  }

  return <CarForm action={create} title="Add Asset" backHref="/" submitLabel="Add to Garage" />;
}
