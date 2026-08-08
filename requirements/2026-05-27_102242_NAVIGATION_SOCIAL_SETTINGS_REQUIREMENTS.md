# Navigation, Social, and Settings Requirements

**Created:** 2026-05-27 10:22:42 AM  
**Source:** Sidebar screenshot in `requirements/52726_navigation_screens/` and product direction from user  
**Status:** Draft requirements for implementation planning

---

## 1. Purpose

Simplify the main navigation so global areas are clearer, vehicle/project-specific tools stay attached to garage context, and social actions live together in a single Social section.

Current observed navigation includes:

- My Garage as an expandable sidebar section
- Feed
- My posts
- Saved
- Projects
- AI Scan
- Receipts
- Friends
- Backup
- Settings
- Light/Dark theme control in the sidebar footer

Target direction:

- My Garage should behave as a direct dashboard link.
- The root route `/` should become a proper home page, while the signed-in garage experience moves to `/dashboard`.
- Feed should be renamed to Social.
- My posts and Saved should become tabs within Social.
- AI Scans and Receipts should be associated with a garage/project, not top-level global navigation.
- Backup and Light mode should move into Settings.

---

## 2. Navigation Requirements

### 2.1 My Garage

**Requirement:** The My Garage sidebar item must not expand by default or behave as the main vehicle accordion.

**Expected behavior:**

- Clicking `My Garage` navigates directly to the garage dashboard.
- Recommended route: `/dashboard`
- The root route `/` should be reserved for a separate home page or public landing experience.
- If the dashboard supports list mode, use the canonical dashboard URL instead of relying on an expanded sidebar state.
- Vehicle/project lists should be accessible from the garage dashboard UI, not shown as an always-expanded top-level sidebar tree.

**Acceptance criteria:**

- The sidebar shows `My Garage` as a single clickable nav item.
- The item does not render chevrons for expand/collapse in the default sidebar.
- Clicking it opens the garage dashboard.
- Existing vehicle detail routes such as `/cars/[id]` continue to work.

---

### 2.2 Proper Home Page

**Requirement:** Add a proper public home page at `/` and move the authenticated garage dashboard to `/dashboard`.

**Current observed behavior:**

- `app/app/page.tsx` currently serves two purposes:
  - Anonymous users see `LandingPage`.
  - Signed-in users see the active garage/dashboard experience.
- `LandingPage.tsx` already contains useful public-facing content such as hero copy, feature cards, supported asset types, community positioning, AI feature notes, calls to action, and a footer.

**Expected behavior:**

- `/` should always render a public home page, regardless of authentication state.
- Signed-in users should access their garage dashboard through `/dashboard`.
- If a signed-in user lands on `/`, the page should still show public home content, with header and hero actions that make returning to `/dashboard` obvious.
- `/dashboard` should redirect signed-out users to `/login?next=/dashboard`.
- `/login` should redirect signed-in users to `/dashboard` unless a valid `next` route is present.
- The home page should include:
  - Site header/navigation
  - Hero section with primary value proposition
  - Features section
  - About section explaining what GarageMeet is and who it is for
  - Login link
  - Sign Up/Register call to action
  - Footer
- The home page should preserve useful existing GarageMeet product themes:
  - Vehicle and asset inventory
  - Repair/project tracking
  - Service history
  - Receipt scanning
  - Warranty/document tracking
  - Social/community sharing
  - AI assistance

**Reusable component requirements:**

- Do not keep the full home page as one large monolithic component if new sections are added.
- Create or extract reusable components where appropriate, such as:
  - `PublicHeader`
  - `PublicFooter`
  - `HeroSection`
  - `FeatureGrid`
  - `AboutSection`
  - `CTASection`
- Reusable public-page components should live in a shared location that can support future public pages, such as `app/app/components/public/` or an equivalent project convention.
- Shared components should accept data/props where useful instead of hardcoding repeated card structures.
- Auth pages such as `/login` and `/register` should reuse public header/footer or shared brand primitives where practical, while preserving focused form layouts.

**Acceptance criteria:**

- Visiting `/` shows the home page for signed-out users.
- Visiting `/` also shows the home page for signed-in users, not the garage dashboard.
- Visiting `/dashboard` shows the signed-in garage dashboard currently served from `/`.
- The `My Garage` nav item links to `/dashboard`.
- The home page includes header, footer, Features, About, Login, and Sign Up/Register affordances.
- The home page is mobile-friendly and does not depend on the authenticated app sidebar.
- At least the header/footer and one repeated section pattern are componentized for reuse.
- Existing login and register routes remain functional.

---

### 2.3 Feed Becomes Social

**Requirement:** Rename the top-level `Feed` navigation item to `Social`.

**Expected behavior:**

- The top-level nav label changes from `Feed` to `Social`.
- The canonical Social landing page should replace or redirect the current feed page.
- Recommended canonical route: `/social`
- Existing `/feed` links should redirect to `/social` or remain supported as a compatibility alias.

**Acceptance criteria:**

- Sidebar and bottom/mobile navigation use `Social`, not `Feed`.
- Browser navigation to `/feed` does not break existing bookmarks.
- Public/shared post cards currently shown in Feed appear in the Social default tab.

---

### 2.4 Social Tabs

**Requirement:** Social must contain tabs for community feed, the user's posts, and saved posts.

**Recommended tabs and routes:**

- `Community`: `/social`
- `My posts`: `/social/posts`
- `Saved`: `/social/saved`

**Open route note:** The user-provided example was `/social/my-feeed`. This appears to be a typo. Canonical route should be `/social/posts`; add redirects from `/social/my-feed`, `/social/my-feeed`, and `/user/posts`.

**Expected behavior:**

- `My posts` should no longer be a top-level sidebar item.
- `Saved` should no longer be a top-level sidebar item.
- Clicking `My posts` in Social opens the My posts tab inside the Social section.
- Clicking `Saved` in Social opens the Saved tab inside the Social section.
- Tabs should be URL-addressable so refresh, browser back, and direct linking work.

**Acceptance criteria:**

- `/social` shows the main Community social feed.
- `/social/posts` shows the current user's posts.
- `/social/saved` shows saved/bookmarked posts.
- Existing `/user/posts` and `/saved` routes redirect or remain compatibility aliases.
- Active tab state is derived from the URL, not only client state.

---

## 3. Garage/Project-Scoped Tools

### 3.1 AI Scans

**Requirement:** AI Scans should be associated with a garage/project context instead of being a global top-level nav item.

**Expected behavior:**

- Remove `AI Scan` from the top-level sidebar navigation.
- Provide AI scan entry points from relevant garage/project surfaces, such as:
  - Garage dashboard
  - Vehicle detail page
  - Project/job detail page
  - Receipt upload/apply flow where the scan has a clear destination
- If a scan starts without a selected garage/project, prompt the user to choose the destination first.

**Acceptance criteria:**

- Users cannot create an orphaned AI scan with no garage/project association.
- Any scan result can be traced back to the garage, vehicle, project, job, or receipt it belongs to.
- Existing receipt scanning behavior remains available from the correct scoped context.

---

### 3.2 Receipts

**Requirement:** Receipts should be associated with a garage/project context instead of being a global top-level nav item.

**Expected behavior:**

- Remove `Receipts` from the top-level sidebar navigation.
- Receipt upload, inbox, review, and apply flows should live under a garage/project-related area.
- Receipts must be linkable to a vehicle, project/job, service record, or other garage asset before they are considered filed.
- If an inbox remains, it should be presented as an action queue inside the garage dashboard or project area, not as a standalone global destination.

**Acceptance criteria:**

- Top-level navigation no longer includes `Receipts`.
- Receipts can still be uploaded, reviewed, deleted, and applied.
- The UI clearly shows what garage/project/vehicle a receipt belongs to.
- Existing `/receipts` route either redirects to the new scoped receipt queue or remains as a compatibility alias with contextual prompts.

---

## 4. Settings Consolidation

### 4.1 Backup Moves To Settings

**Requirement:** Move Backup out of top-level navigation and into Settings.

**Expected behavior:**

- Remove `Backup` from the top-level sidebar.
- Add a Settings section for backup/export.
- Existing export endpoint `/api/export/garage` can remain unchanged.

**Acceptance criteria:**

- Users can still export/backup data from Settings.
- Backup is not shown as a global sidebar link.
- The Settings backup control uses clear action language such as `Export garage data`.

---

### 4.2 Light Mode Moves To Settings

**Requirement:** Move the Light/Dark mode toggle from the sidebar footer into Settings.

**Expected behavior:**

- Remove the persistent sidebar footer theme toggle.
- Keep appearance controls in Settings.
- Settings should continue to expose theme options for Dark and Light modes.
- Settings should be organized into clear sections: Account, Appearance, Data & Backup, Privacy & Sharing, and future Notifications.
- Backup copy must clarify whether export includes only database records or also uploaded photos, documents, and receipts.

**Acceptance criteria:**

- Sidebar footer no longer contains the Light/Dark mode control.
- Settings includes the theme controls.
- Existing theme preference behavior continues to work.

---

## 5. Proposed Top-Level Navigation After Changes

Recommended top-level sidebar order:

1. My Garage
2. Projects
3. Social
4. Settings
5. Admin, when applicable

Contextual actions that should not appear as top-level nav:

- AI Scan
- Receipts
- Backup
- Light/Dark mode
- My posts
- Saved
- Friends, unless friend management becomes a core daily workflow

---

## 6. Implementation Notes

- Split current root behavior so `/` is public home and `/dashboard` is the signed-in garage dashboard.
- Update `AppShell` navigation definitions and sidebar footer behavior.
- Update bottom/mobile navigation to match the new information architecture.
- Add `/social` routes and route-level tab handling.
- Extract reusable public-page components before expanding the home page further.
- Preserve redirects or compatibility aliases for existing routes:
  - `/feed`
  - `/saved`
  - `/user/posts`
  - `/receipts`
- Review i18n keys so English and Spanish labels remain consistent.
- Keep route-driven active states so tabs and sidebar highlighting survive refresh.

---

## 7. Product Decisions

1. Guest mode should be a secondary call to action on the public home page, not the primary path.
2. Social default tab should be labeled `Community`.
3. Canonical My posts route should be `/social/posts`; redirect `/social/my-feed`, `/social/my-feeed`, and `/user/posts`.
4. Keep a lightweight dashboard queue for unfiled receipts. Users may scan first and file later, but receipts must not be considered filed until linked to a target.
5. Vehicle ownership should be explicit enough to support vehicles a user maintains but does not personally own.

---

## 8. Refinements From Review

### 8.1 Projects As Global Work Queue

**Requirement:** Keep `Projects` top-level only if it represents work across the whole garage.

**Expected behavior:**

- `Projects` is a global work queue for active jobs, overdue tasks, parts needed, blocked work, and recent project updates across all vehicles.
- Vehicle-specific project lists remain available from each vehicle detail page and from the garage dashboard.
- If `Projects` becomes only a vehicle/project list, it should move under My Garage instead of remaining top-level.

**Acceptance criteria:**

- The Projects page helps users answer what needs work now across the whole garage.
- Projects can be filtered by vehicle, status, due/overdue state, and active/completed state.
- Empty state: `No projects yet` with a clear action to create a project or add a vehicle.

---

### 8.2 Receipt And AI Ownership

**Requirement:** AI scans and receipts must be scoped in data and workflow, not only removed from navigation.

**Expected behavior:**

- New receipt uploads and AI scans must have at least a `garageId` or equivalent owner garage context.
- Filed receipts/scans must link to a target such as `vehicleId`, `projectId`/`jobId`, `serviceRecordId`, `documentId`, or warranty-related record.
- Existing unscoped receipts/scans should appear in a `Needs filing` queue on the dashboard.
- Users may scan/upload first and organize later, but unfiled items remain visibly incomplete.
- Users only see records they own or have explicit access to through sharing permissions.

**Acceptance criteria:**

- Existing unscoped records are not lost during migration.
- Unfiled records appear in a dashboard queue such as `Receipts to file` or `Needs filing`.
- A receipt is not shown as filed until it has a valid target link.
- Permission checks protect all scoped receipt/scan APIs.
- Empty state: `No receipts to file` when the queue is clear.

---

### 8.3 Social Privacy Guardrails

**Requirement:** Social sharing must never accidentally expose private garage data.

**Expected behavior:**

- Posts clearly show audience state: `Public`, `Friends`, or `Private/Draft`.
- Receipt and document attachments are private by default and must never publish by accident.
- VINs, plates, addresses, costs, warranty docs, and private notes should be hidden from Social unless explicitly allowed by a specific sharing workflow.
- Sharing garage/project content requires explicit confirmation.
- Saved posts are private to the saving user.
- Friends should live inside Social as a tab or subpage unless friend management becomes a high-frequency daily workflow.

**Acceptance criteria:**

- Publishing a post requires an explicit action and visible audience selection.
- Social post rendering excludes private receipt/document data by default.
- Saved-post APIs and pages only expose the current user's saved items.
- Empty states exist for Community, My posts, Saved, and Friends.

---

### 8.4 Settings Structure

**Requirement:** Settings should be organized into clear sections instead of becoming a catch-all page.

**Required sections:**

- Account
- Appearance
- Data & Backup
- Privacy & Sharing
- Notifications, eventually

**Acceptance criteria:**

- Backup/export lives under Data & Backup.
- Theme controls live under Appearance.
- Sharing defaults and privacy controls live under Privacy & Sharing.
- Backup UI clarifies export scope: database only, uploads included, or both.

---

### 8.5 Vehicle Ownership And Managed Vehicles

**Requirement:** Users must be able to distinguish vehicles they own from vehicles they manage, maintain, or work on for someone else.

**Rationale:**

GarageMeet should support everyday real-world usage where a user may service a friend vehicle, a family member vehicle, or a small customer/job vehicle without forcing the actual owner to create an account first. The app should not imply personal ownership when the vehicle is only being managed for repair or maintenance.

**Recommended data model:**

- Add a vehicle relationship field to `Car`, such as `relationshipToUser`.
- Recommended values:
  - `owned`
  - `family`
  - `friend_customer`
  - `other`
- Default value: `owned`
- Optional supporting fields:
  - `managedOwnerName`
  - `managedOwnerContact`
  - `managedOwnerNotes`
- Keep these supporting fields private by default.

**Expected behavior:**

- Add/edit vehicle forms should ask for `Relationship to this vehicle`.
- `I own this` should be the default selection.
- Selecting `Friend/customer vehicle` should reveal optional owner/contact/permission notes.
- Managed vehicles should remain private by default and should not be suggested for public/social sharing without an explicit confirmation.
- Vehicle cards and detail pages should show a subtle private label such as `Managed for a friend` or `Family vehicle` when the relationship is not `owned`.
- Jobs, receipts, service records, photos, and documents should continue to attach normally to managed vehicles.
- Export/backup should include the relationship fields and clearly treat owner/contact notes as private garage data.
- Future enhancement: allow a managed vehicle to be transferred or shared to the real owner if they later create an account.

**Migration plan:**

- Add nullable private supporting fields and a non-null relationship field with default `owned`.
- Backfill every existing `Car` row to `relationshipToUser = owned`.
- Do not require users to review or reclassify existing vehicles during migration.
- Do not change visibility, sharing, public profile, service history, project, receipt, document, or photo behavior for existing vehicles.
- If a database cannot add the field as non-null with a default in one step, add it nullable first, backfill existing rows to `owned`, then enforce the default and non-null constraint.
- Update imports, guest drafts, exports, and seed/demo data so missing relationship values resolve to `owned`.
- Add compatibility handling in server actions and APIs so older clients or guest drafts that omit the field create vehicles as `owned`.

**Acceptance criteria:**

- Creating a vehicle defaults to `I own this`.
- Users can mark a vehicle as `Family`, `Friend/customer`, or `Other`.
- Existing vehicles after migration all behave as `I own this`.
- Managed vehicle owner/contact notes are not exposed in public garage pages, Social posts, or shared cards by default.
- Projects and service records can be created for managed vehicles exactly like owned vehicles.
- Existing vehicles, public settings, receipts, jobs, service records, documents, and photos are not lost or detached during migration.

---

## 9. Empty States

Every moved or newly introduced section must include a calm empty state with a clear next action.

Required empty states:

- No vehicles yet
- No projects yet
- No saved posts
- No receipts to file
- No friends yet
- No community posts yet

---

## 10. Phased Rollout

Implement this as safe phases rather than one large rewrite.

1. Phase 1: Public `/` home page, `/dashboard`, My Garage direct link, and top-level nav cleanup.
2. Phase 2: Social routes/tabs, privacy labels, and compatibility redirects.
3. Phase 3: Settings consolidation for appearance, backup, account, and privacy sections.
4. Phase 4: Receipt/AI scoping, migration behavior, and dashboard filing queues.
5. Phase 5: Vehicle relationship support for owned, family, friend/customer, and other managed vehicles, including safe migration of all existing vehicles to `owned`.
