# My Garage — Multi-User + Sharing Implementation Plan

Last updated: 2026-03-24
Owner: Jorge + Bobby

## 1) Goal

Enable each person to have their **own private garage** while allowing controlled visibility into friends’ garages/projects.

Core product outcome:
- A friend can sign up and manage their own garage.
- That same friend can view Jorge’s shared garage/projects.
- Permissions are explicit and safe (no accidental editing or data leakage).

---

## 2) Product Model (Simple + Scalable)

### Principles
1. **Ownership is singular**: every garage/project has one owner.
2. **Sharing is additive**: access comes from explicit memberships/invites.
3. **Default private**: nothing visible unless owner shares.
4. **Project-level overrides**: specific projects can be more/less visible than garage default.

### Visibility
- `private` — owner only
- `friends` — accepted friend connections can view
- `public` — anyone with link (optional, can be phase 2)
- `custom` — explicit allowlist (users/collaborators)

---

## 3) Roles and Permissions

### Garage-level roles
- `owner` (full control)
- `viewer` (read-only)

### Project-level roles
- `owner` (implicit from garage ownership)
- `collaborator` (edit project/phases/tasks/comments)
- `viewer` (read-only)

### Permission matrix (v1)
- Owner: everything
- Collaborator: edit project content, cannot transfer ownership, cannot delete garage
- Viewer/Friend: read-only for shared content

---

## 4) Data Model (Prisma)

## New / updated entities

### User
- id
- email (unique)
- name
- username (unique)
- avatarUrl?
- createdAt / updatedAt

### Garage
- id
- ownerId (FK User)
- name
- slug (unique)
- visibilityDefault (`private|friends|custom|public`)
- createdAt / updatedAt

### FriendConnection
- id
- requesterId
- addresseeId
- status (`pending|accepted|blocked`)
- createdAt / updatedAt
- unique(requesterId, addresseeId)

### GarageMembership
- id
- garageId
- userId
- role (`viewer`)
- invitedById?
- createdAt
- unique(garageId, userId)

### Project (existing, update)
- add `garageId` FK (required)
- add `visibility` (`inherit|private|friends|custom|public`)
- add `ownerId` (optional if always derived from garage owner, recommended explicit for query simplicity)

### ProjectMembership
- id
- projectId
- userId
- role (`collaborator|viewer`)
- invitedById?
- createdAt
- unique(projectId, userId)

### Invitation
- id
- scope (`garage|project|friend`)
- garageId?
- projectId?
- inviterId
- inviteeEmail? / inviteeUserId?
- token (unique)
- role (`viewer|collaborator` when applicable)
- status (`pending|accepted|expired|revoked`)
- expiresAt
- createdAt / updatedAt

---

## 5) Access Rules (Server-side)

Implement a central authz helper (single source of truth):
- `canViewGarage(user, garage)`
- `canEditGarage(user, garage)`
- `canViewProject(user, project)`
- `canEditProject(user, project)`

Rule order:
1. Owner check
2. Explicit membership check
3. Project visibility check (`friends/public/custom`)
4. Garage default visibility fallback

Non-negotiable:
- Never trust client role claims.
- Enforce in route handlers/server actions.

---

## 6) API + Routes (Next.js)

### Auth + identity
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Social/friends
- `POST /api/friends/request`
- `POST /api/friends/:id/accept`
- `POST /api/friends/:id/block`
- `GET /api/friends`

### Garage sharing
- `POST /api/garages/:id/invite`
- `GET /api/garages/:id/members`
- `DELETE /api/garages/:id/members/:userId`

### Project sharing
- `POST /api/projects/:id/invite`
- `GET /api/projects/:id/members`
- `DELETE /api/projects/:id/members/:userId`
- `PATCH /api/projects/:id/visibility`

### Invitation acceptance
- `POST /api/invitations/:token/accept`
- `POST /api/invitations/:token/decline`

---

## 7) UI/UX Plan

### New screens
1. **Sign up / login**
2. **My Garage settings**
   - default visibility
   - member list
   - invite people
3. **Project sharing modal**
   - visibility selector
   - add collaborator/viewer
4. **Friends page**
   - pending requests
   - accepted friends
5. **Shared with me**
   - garages/projects user can access

### UX guardrails
- Default new project visibility = `inherit`.
- Show clear badges: Private / Shared / Public.
- Confirmation on destructive permission changes.

---

## 8) Security + Privacy

- Server-side authorization on every read/write endpoint.
- Invitation tokens: random, long, expiring.
- Rate-limit invite endpoints.
- Audit log (phase 2): who invited/removed whom.
- Minimal public exposure: public links optional + disabled by default.

---

## 9) Migration Strategy

Current app is single-user. We need safe migration:

1. Add `User` + `Garage` tables.
2. Create default owner user (Jorge seed).
3. Create one garage for Jorge.
4. Backfill existing cars/projects to new garage.
5. Add `garageId` to all garage-bound entities.
6. Turn on auth gates after migration succeeds.

Rollback safety:
- Backup SQLite DB before migration.
- Validate row counts pre/post migration.

---

## 10) Implementation Phases

## Phase 1 (MVP foundation)
- User auth (register/login/session)
- Garage ownership model (`User`, `Garage`, `garageId` backfill)
- Server authz helper
- Keep everything private by default

Deliverable: multiple users can exist with isolated garages.

## Phase 2 (Sharing core)
- Friend connections
- Garage invites (viewer)
- Project visibility settings (`private/friends/custom`)
- Shared-with-me page

Deliverable: friends can view Jorge’s shared content.

## Phase 3 (Collaboration)
- Project collaborators (edit rights)
- Invitation management/revocation
- Better activity indicators

Deliverable: trusted friends can co-manage specific projects.

## Phase 4 (Polish)
- Public links (optional)
- Audit log
- Notification center for invites/activity

---

## 11) Acceptance Criteria (v1)

1. New user can register and gets their own empty garage.
2. Jorge can invite a friend to view garage/projects.
3. Invited friend can view only shared resources.
4. Non-shared projects remain invisible.
5. Collaborator can edit only projects where collaborator access exists.
6. Owner can revoke access and visibility updates apply immediately.

---

## 12) Build Checklist (Engineering)

- [ ] Prisma schema update + migration scripts
- [ ] Backfill script for existing local data
- [ ] Session/auth middleware
- [ ] Authz helper and tests
- [ ] Sharing APIs + validations
- [ ] Invite token lifecycle
- [ ] UI: sharing controls + shared feed
- [ ] End-to-end tests (owner/viewer/collaborator paths)
- [ ] Release notes + rollback instructions

---

## 13) Suggested First Sprint (5 working days)

Day 1:
- Schema draft + migration plan

Day 2:
- Auth + session foundation

Day 3:
- Garage ownership + data backfill

Day 4:
- Authorization helper + protected queries

Day 5:
- Basic invite flow (garage viewer) + smoke tests

---

## 14) Explicit Scope Decisions

In existing PRD, multi-user was listed as out of scope. This plan introduces it as the next major roadmap item and should supersede that old constraint for upcoming releases.
