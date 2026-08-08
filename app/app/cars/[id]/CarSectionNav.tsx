"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Wrench, FileText, Shield, Image, DollarSign, BarChart2, ChevronLeft, Settings2, CalendarClock } from "lucide-react";
import { useApp } from "@/app/providers/AppProviders";
import { useT } from "@/app/hooks/useT";

export default function CarSectionNav({ carId, carName }: { carId: string; carName: string }) {
  const pathname = usePathname();
  const { lang } = useApp();
  const t = useT();

  const SECTIONS = [
    { key: "overview",  labelKey: "navOverview", href: `/cars/${carId}`,                 Icon: Car },
    { key: "jobs",      labelKey: "navJobs",     href: `/cars/${carId}/jobs`,             Icon: Wrench },
    { key: "service",   labelKey: "navService",  href: `/cars/${carId}/service-history`,  Icon: FileText },
    { key: "warranty",  labelKey: "navWarranty", href: `/cars/${carId}/warranty`,         Icon: Shield },
    { key: "docs",      labelKey: "navDocs",     href: `/cars/${carId}/documents`,        Icon: FileText },
    { key: "gallery",   labelKey: "navGallery",  href: `/cars/${carId}/gallery`,          Icon: Image },
    { key: "estimate",  labelKey: "navEstimate", href: `/cars/${carId}/estimate`,         Icon: DollarSign },
    { key: "mileage",   labelKey: "navMileage",  href: `/cars/${carId}/mileage`,          Icon: BarChart2 },
    { key: "specs",     labelKey: "navSpecs",     href: `/cars/${carId}/specs`,             Icon: Settings2 },
    { key: "schedule",  labelKey: "navSchedule",  href: `/cars/${carId}/schedule`,           Icon: CalendarClock },
  ];

  const isActive = (key: string, href: string) => {
    if (key === "overview") return pathname === `/cars/${carId}` || pathname === `/cars/${carId}/edit`;
    return pathname.startsWith(href);
  };

  return (
    <div className="sticky top-0 z-30 bg-gray-950 border-b border-gray-800">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 transition-colors">
          <ChevronLeft size={14} />
        </Link>
        <span className="text-xs font-semibold text-gray-400 truncate">{carName}</span>
      </div>

      {/* Scrollable tabs */}
      <div className="flex overflow-x-auto scrollbar-none px-3 pb-0 gap-1">
        {SECTIONS.map(({ key, labelKey, href, Icon }) => {
          const active = isActive(key, href);
          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                active
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
              }`}
            >
              <Icon size={12} className="flex-shrink-0" />
              {t(labelKey as any)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
