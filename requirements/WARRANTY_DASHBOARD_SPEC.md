# Warranty Visibility Spec (Higher-Level Surfacing)

Last updated: 2026-03-24

## Problem
Warranty data can be saved on receipt line items, but users can miss it because it is buried in service/receipt detail pages.

## Goal
Surface warranty info at higher levels so users can quickly answer:
- What warranties are active?
- What is expiring soon?
- Which car has what covered?

---

## Current Source of Truth
`ReceiptLineItem` fields:
- `warrantyProvider`
- `warrantyStart`
- `warrantyEnd`
- `warrantyNotes`

Warranty is linked indirectly through:
`ReceiptLineItem -> Receipt -> ServiceRecord -> Car`

---

## UX Proposal (Phased)

## Phase 1 (Quick win)
### A) Car Detail page (`/cars/[id]`)
Add a "Warranty" section:
- Active warranties
- Expired warranties
- Expiring in next 30 days

Each row:
- Part name
- Provider
- End date
- Status badge (Active / Expiring Soon / Expired)
- Link to source receipt/service record

### B) Service Record detail page
Already patched to show warranty under each line item.

## Phase 2 (Garage-level dashboard)
### C) Home dashboard (`/`)
Add compact widget: "🛡️ Warranty Alerts"
- Count expiring in 30 days
- Count expired
- Top 3 urgent items across all cars
- "View all" link

### D) Dedicated page (`/warranties`)
Table/list grouped by status and car:
- Filters: car, status, provider
- Sort: end date ascending
- Search: part/provider

## Phase 3 (Automation)
### E) Notifications
- Optional reminder at 30/14/7 days before expiration
- Optional daily digest in app notification center

---

## Status Rules
- `active`: end date in future (or no end date with provider/start present)
- `expiring_soon`: end date within configurable threshold (default 30d)
- `expired`: end date in past
- `unknown`: incomplete warranty metadata

---

## API / Query shape
Create reusable query helper to avoid duplicated joins:
- input: `userId`, optional `carId`, optional filters
- output fields:
  - carId, carName
  - serviceRecordId
  - receiptId
  - lineItemId
  - partName
  - provider
  - warrantyStart
  - warrantyEnd
  - warrantyNotes
  - computedStatus
  - daysToExpiry

---

## Translation Requirements (EN/ES)
New strings (minimum):
- Warranty
- Warranty Alerts
- Active / Expiring Soon / Expired
- Ends on
- Provider
- Part
- View all warranties
- No warranties yet

Use existing app language context (`useApp().lang`) for labels.

---

## Acceptance Criteria
1. User can see warranty summary on each car detail page.
2. Home dashboard shows cross-car expiring/expired counts.
3. Dedicated warranties list can filter and sort.
4. EN/ES labels present for all new warranty UI.
5. Clicking any warranty row opens related source (receipt/service record).

---

## Suggested implementation order
1) Car detail warranty section
2) Home alerts widget
3) `/warranties` full page
4) Reminder notifications
