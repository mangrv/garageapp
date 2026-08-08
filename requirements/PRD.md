# Garage Work Manager – Product Requirements Document

Last updated: March 2026

## Current State (v0.1 MVP — Already Built)

See `/prd` route in the app for current feature summary.

Stack: Next.js 16 · Prisma 6.4.1 · SQLite · Tailwind CSS · PWA
Host: http://192.168.1.198:3011

---

## New Feature Requirements (v0.2+)

This document defines the new functionality to add on top of the existing application.

---

## 1. Project Management Enhancements

### 1.1 Edit Project
Editable fields: title, notes, associated car, status
- Edit action on project detail page (inline or modal)
- Reassign to another car or unassign
- Changes persist immediately

### 1.2 Project Status Controls
Allowed: active | done | archived
- Status editable from project detail page
- Active: visible in default views
- Done: visible in history and default lists
- Archived: hidden from default views, shown only with filter

### 1.3 Delete Project
- Requires confirmation
- Cascades: phases → tasks → comments + task photos
- Removes associated files from filesystem
- Does not affect car record

---

## 2. Custom Phase Management

### 2.1 Add Phase
- Add new phase from project UI
- Fields: title, emoji, sort order
- Defaults to end of list

### 2.2 Edit Phase
- Fields: title, emoji, sort order
- Inline or modal from project page

### 2.3 Delete Phase
- Requires confirmation
- Cascades: tasks → comments + photos

---

## 3. Custom Task Management

### 3.1 Add Task
- Add task to any phase from project UI
- Fields: title (required), warning, tip, due date (optional)
- Appears in same UI style as template tasks

### 3.2 Edit Task
- Fields: title, warning, tip, due date
- Editable from task row UI

### 3.3 Delete Task
- Requires confirmation
- Cascades: comments + photos (including filesystem cleanup)

---

## 4. Service History

### 4.1 Service History Records
New model: ServiceRecord
- carId (required)
- projectId (optional — links back to project)
- title / service type
- mileage
- serviceDate
- notes

### 4.2 Create from Completed Project
- When project marked done → prompt to create service record
- Preserves project title, date, mileage

### 4.3 Manual Service Entry
- Create without a project (oil change elsewhere, tire rotation, etc.)
- Fields: title, date, mileage, notes

### 4.4 Service History View
- Route: /cars/[id]/service-history
- Reverse chronological order
- Links back to source project when available

---

## 5. Mileage History and Logging

### 5.1 Mileage Log
- Historical mileage per car (not just "current" value)
- Tied to service entries or manual log

### 5.2 Mileage Validation
- Must be numeric
- Warn if new value < latest stored mileage
- User can override

---

## 6. Search and Filtering

### 6.1 Global Search (from home page)
Searchable: car year/make/model/trim, project title/notes, phase title, task title, comments, service history

### 6.2 Filters
- Cars: make, model, year
- Projects: status, car, archived
- Service history: date range, type, mileage range

---

## 7. Dates, Reminders, and Due Tracking

### 7.1 Task Due Dates
- Optional dueDate field on Task
- Visible in task UI when set, editable

### 7.2 Overdue Indicators
- Incomplete task with past due date → overdue badge
- Visually distinct from warning/tip

### 7.3 Project Dates in UI
- Expose startedAt / completedAt on project detail page
- Editable when project editing is enabled

---

## 8. Photo Management Improvements

### 8.1 Edit Task Photo Captions
- Caption editable after upload (car photos already support this)

### 8.2 Edit Car Photo Metadata
- takenAt, isFeatured, caption — all editable post-upload (already done)

### 8.3 Delete Photos
- Remove DB record + filesystem file
- Already implemented for car photos; ensure task photos also clean up files

### 8.4 Upload Organization
- Restructure to: public/uploads/cars/... and public/uploads/tasks/...
- New uploads use organized subfolders
- Existing files remain compatible

---

## 9. Dashboard and Car Overview Improvements

### 9.1 Enhanced Car Cards (home page)
Show: featured image, year/make/model, trim, current mileage, active project count, last service date

### 9.2 Car Summary Metrics (car detail page)
Show: total/active/completed/archived projects, total service entries, most recent service date

---

## 10. Export Functionality

### 10.1 Export Single Project
Formats: Markdown, JSON, CSV
Include: title, car, notes, phases, tasks, completion states, comments, photo references

### 10.2 Export Car History
Include: car details, service history, project summaries
Available from car detail page

### 10.3 Export Entire Garage
Format: JSON (primary backup)
Include: all cars, projects, phases, tasks, comments, photos metadata, service history

---

## 11. Template System Enhancements

### 11.1 Custom Templates
- Save a project or phase/task structure as a named reusable template
- Stored in DB

### 11.2 Edit Template
- Editable: title, phases, tasks, warnings, tips
- Changes apply only to future projects

### 11.3 Clone Template
- Duplicate built-in or user template as starting point for custom variant

---

## 12. Comments and Notes Improvements

### 12.1 Edit/Delete Comments
- Comments on tasks must be editable and deletable
- Timestamps remain visible

### 12.2 Project-Level Notes
- Notes visible on project page without entering edit mode
- Supports longer multiline content

---

## 13. Data Integrity

### 13.1 Referential Cleanup
- All destructive actions clean up DB rows and filesystem files
- File deletion failures should log and surface without crashing the operation

### 13.2 Soft Delete Readiness
- Avoid schema decisions that would block adding deletedAt later

---

## 14. Performance and UX

- All new UI must be thumb-friendly, minimal taps
- Must work in PWA home screen mode on iPhone
- Photo upload must preserve 20MB body limit

---

## 15. Schema Changes Required

### ServiceRecord
id, carId, projectId?, title, notes?, mileage?, serviceDate, createdAt, updatedAt

### MileageEntry (optional separate model)
id, carId, mileage, recordedAt, source, sourceId?, notes?

### Task.dueDate (nullable DateTime)

### UserTemplate (if custom templates implemented)
id, name, phases (JSON or relational), createdAt, updatedAt

---

## 16. Priority

### High
- Edit project (1.1)
- Archive/delete project (1.2, 1.3)
- Add/edit/delete phases (2.1–2.3)
- Add/edit/delete tasks (3.1–3.3)
- Service history (4.1–4.4)
- Mileage history (5.1–5.2)
- Editable task photo captions (8.1)
- Project dates in UI (7.3)

### Medium
- Search (6.1)
- Filters (6.2)
- Export (10.1–10.3)
- Enhanced car dashboard (9.1–9.2)
- Comment editing (12.1)
- Manual service entries (4.3)

### Lower
- Custom templates (11.1–11.3)
- Task due dates + overdue indicators (7.1–7.2)
- Storage reorganization (8.4)
- Soft delete readiness (13.2)

---

## 17. Out of Scope

Multi-user, cloud sync, auth, S3, push notifications, OBD, parts inventory, voice notes, video, advanced analytics.

---

## 18. Definition of Done

- Users can fully manage projects after creation
- Users can create and manage their own phases and tasks
- Each car has usable maintenance and mileage history
- Photos manageable after upload
- Projects and garage data easier to find
- App remains mobile-friendly, personal, lightweight
- All features work within Next.js + Prisma + SQLite + Tailwind + PWA architecture
