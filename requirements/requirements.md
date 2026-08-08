# Car Maintenance App - Comprehensive Requirements & Overview

**Application Name:** Garage Work Manager  
**Version:** 0.1+ (MVP in production, actively evolving)  
**Last Updated:** May 2026  
**Tech Stack:** Next.js 16, Prisma 6.4.1, SQLite, Tailwind CSS 4, PWA  
**Hosting:** Self-hosted Docker (http://192.168.1.198:3011)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Purpose & Value Proposition](#core-purpose--value-proposition)
3. [Technology Architecture](#technology-architecture)
4. [User Types & Personas](#user-types--personas)
5. [Feature Catalog](#feature-catalog)
6. [Database Schema Overview](#database-schema-overview)
7. [API Structure](#api-structure)
8. [Security & Privacy](#security--privacy)
9. [Current Limitations & Known Issues](#current-limitations--known-issues)
10. [Roadmap & Future Development](#roadmap--future-development)
11. [Deployment & Operations](#deployment--operations)

---

## Executive Summary

Garage Work Manager is a **personal vehicle maintenance tracking and project management application** designed for car enthusiasts, DIY mechanics, and vehicle owners who want to:

- Track multiple vehicles (cars, bicycles, trailers, riding mowers, equipment)
- Manage maintenance jobs with detailed phase-by-phase task tracking
- Store service history, receipts, and warranty information
- Track mileage and maintenance schedules
- Share projects and garages with friends (multi-user capability)
- Estimate vehicle value based on maintenance history
- Access VIN-decoded vehicle information and recall data
- Use AI assistance for maintenance guidance
- Scan and process receipts with OCR

The app operates as a **Progressive Web App (PWA)** optimized for mobile use, with a focus on thumb-friendly UI and offline capability.

---

## Core Purpose & Value Proposition

### Primary Use Cases

1. **Vehicle Portfolio Management**
   - Maintain inventory of all owned vehicles/assets
   - Track acquisition date, purchase price, mileage/hours
   - Store photos and documentation (titles, registration, insurance)
   - Support multiple asset types beyond traditional vehicles

2. **Maintenance Job Tracking**
   - Create detailed projects with customizable phases and tasks
   - Track progress with completion percentages
   - Add photos, comments, and notes at task level
   - Clone jobs for recurring maintenance
   - Set due dates and track overdue items

3. **Service History & Records**
   - Comprehensive maintenance log per vehicle
   - Link service records to completed jobs
   - Track costs, parts used, service dates, and mileage
   - Attach receipts and invoices
   - Extract receipt data via OCR and AI

4. **Financial Tracking**
   - Receipt inbox for unprocessed receipts
   - Line-item level cost tracking
   - Warranty information with expiration tracking
   - Vehicle value estimation based on maintenance
   - Market value comparison with external data sources

5. **Social & Sharing**
   - Share garages with friends (view or collaborate)
   - Public feed of completed projects
   - Like and bookmark projects
   - Connection system for friend networks
   - Invite-based access control

6. **Smart Features**
   - AI assistant for maintenance questions
   - VIN decoding and vehicle enrichment
   - Recall checking via NHTSA integration
   - Maintenance schedule recommendations
   - Vehicle specifications lookup

---

## Technology Architecture

### Frontend Stack

**Framework:** Next.js 16 (App Router)
- Server-side rendering
- React 19.2.3
- TypeScript 5
- App directory structure

**Styling:**
- Tailwind CSS 4 with @tailwindcss/postcss
- Custom CSS variables for theming
- Dark mode optimized
- Responsive mobile-first design

**UI Components:**
- Lucide React (icons)
- Custom components (AppShell, BottomNav, etc.)
- Dynamic translation system (EN/ES support)
- PWA capabilities with manifest.json

**Client Features:**
- Image compression (client-side canvas)
- Guest mode for unauthenticated users
- Service worker for offline capability
- Bottom navigation for mobile

### Backend Stack

**Database:**
- SQLite (development and production)
- Prisma 6.4.1 ORM
- Migration system
- Seed scripts

**Authentication & Authorization:**
- Custom JWT-based session management (jose library)
- bcryptjs for password hashing
- Session cookies (HTTP-only)
- Role-based access control (admin/user)
- Connection-based sharing permissions

**API Layer:**
- Next.js API routes (App Router)
- Server Actions for form handling
- RESTful endpoints
- JSON responses

**External Integrations:**
- AWS S3 for media storage (@aws-sdk/client-s3)
- VIN decoding (NHTSA API)
- Market value data providers
- Recall information (NHTSA)
- AI providers:
  - Anthropic (Claude) - @anthropic-ai/sdk
  - OpenAI (GPT models)

**Media Processing:**
- Sharp for image optimization
- FFmpeg for video processing
- Tesseract OCR for receipt scanning
- On-demand thumbnail generation

**Analytics:**
- Matomo integration (privacy-focused)
- Server-side and client-side tracking

### Infrastructure

**Containerization:**
- Docker with multi-stage builds
- Alpine Linux base
- FFmpeg and Tesseract included
- Docker Compose for orchestration

**Storage:**
- Local filesystem (public/uploads)
- Optional S3 mirroring
- Backup scripts for SQLite
- Upload organization by entity type

**Development:**
- npm scripts for dev/build/start
- Hot reload in development
- TypeScript compilation
- Prisma Studio for DB management

---

## User Types & Personas

### 1. Vehicle Owner (Primary User)
- Owns one or more vehicles
- Performs DIY maintenance
- Wants to track service history
- Needs maintenance reminders
- Values financial tracking

### 2. Guest User
- No account required
- Can create temporary car/job records
- Data stored in localStorage
- Can import to full account later

### 3. Admin User
- System administration role
- Access to admin dashboard
- Can manage all users and data
- System-wide permissions

### 4. Connected Friend (Viewer)
- View-only access to shared garages
- Can see friend's cars and jobs
- Can like and bookmark projects
- Cannot edit or delete

### 5. Collaborator
- Edit access to specific projects
- Can add tasks, photos, comments
- Cannot delete or transfer ownership
- Invited by project owner

---

## Feature Catalog

### 1. Vehicle/Asset Management

#### 1.1 Vehicle CRUD
- **Add Vehicle**
  - Supports: vehicle, bicycle, trailer, riding_mower, equipment
  - Fields: year, make, model, trim, color, VIN/serial number
  - Mileage/hours tracking
  - Acquisition date and purchase price
  - Transmission type (auto/manual/CVT/DCT)
  - Notes (private and public)
  - Bicycle-specific: bike type, frame size, wheel size

- **Edit Vehicle**
  - Update all vehicle details
  - Toggle public visibility
  - Set featured photo

- **Delete Vehicle**
  - Cascading delete of related data
  - Photo cleanup from filesystem/S3

- **Vehicle Details Page**
  - Featured photo carousel
  - Active jobs summary
  - Service history timeline
  - Warranty alerts
  - Documents section
  - Mileage log
  - VIN-enriched data
  - Value estimate
  - Recall information
  - Specifications

#### 1.2 Vehicle Photos
- Upload multiple photos per vehicle
- Set featured image
- Add captions and dates
- Public/private toggle
- View in gallery mode
- Delete with confirmation

#### 1.3 Vehicle Documents
- Upload PDFs and images
- Types: registration, insurance, title, manual, other
- Set expiration dates (insurance, registration)
- Label and notes
- Private by default
- Download capability

#### 1.4 VIN Integration
- Decode VIN via NHTSA API
- Auto-populate: engine, displacement, drivetrain, body style, fuel type, doors, series, trim
- Store raw API responses
- Manual override capability
- Enrichment status tracking

#### 1.5 Recall Checking
- Automatic recall lookup via NHTSA
- Campaign number tracking
- Component and summary
- Consequence and remedy
- Open/closed status
- Last checked timestamp
- Alert if recalls found

#### 1.6 Vehicle Specifications
- Engine oil (type, capacity, change interval)
- Transmission fluid
- Coolant specifications
- Spark plug details and gap
- Brake fluid and thickness specs
- Torque specifications (lug nuts, bolts)
- Tire size and pressure
- Timing belt/chain info
- Battery specifications
- Manual entry and AI suggestions

#### 1.7 Market Valuation
- External market data integration
- Market value range (low/mid/high)
- Source tracking (manual, MarketCheck, VinAudit)
- Historical snapshots
- Garage estimate (app-computed)
- Condition scoring (1-5 stars)
- Adjustment factors:
  - Maintenance adjustment
  - Repair adjustment
  - Condition adjustment
  - Mileage adjustment
  - Recall adjustment
  - Modification adjustment
- Confidence scoring
- Snapshot history over time

### 2. Job/Project Management

#### 2.1 Job Creation
- Create from template or blank
- Link to specific vehicle
- Multiple status options:
  - todo, up_next, active, in_progress, blocked, testing, done, archived
- Service type categorization:
  - oil_change, tire_rotation, brakes, tires, alignment
  - detailing, inspection, parts, maintenance, modifications, other
- Title and notes
- Started/completed timestamps
- Tools list (JSON array)
- Sort order for prioritization

#### 2.2 Job Templates
- Built-in templates for common jobs
- User-created custom templates
- Template structure:
  - Title
  - Phases with emoji
  - Tasks with warnings and tips
  - Torque specifications
- Clone template to new job
- Save job as template

#### 2.3 Phases
- Multiple phases per job
- Custom title and emoji
- Sort order
- Status: todo, in_progress, done
- Phase-level notes
- Tools list
- Cascading delete to tasks

#### 2.4 Tasks
- Task title (required)
- Warning field (safety alerts)
- Tip field (helpful hints)
- Torque specifications (value + unit: ft-lbs, Nm, in-lbs)
- Parts cost and labor cost tracking
- Parts note (part numbers, vendor)
- Completion checkbox
- Due date (optional)
- Sort order
- Completed timestamp
- Cascading delete to comments/photos

#### 2.5 Task Progress Tracking
- Individual task completion
- Phase completion percentages
- Overall job completion percentage
- Visual progress bars
- Phase completion count
- Overdue task indicators

#### 2.6 Job Photos
- Upload photos and videos per job
- Media types: image, video
- Caption support
- Public/private toggle
- Primary photo designation
- Sort order
- Grid and carousel views
- Video transcoding (H.264, 30fps)
- Thumbnail generation
- Max 250 MB per upload

#### 2.7 Comments
- Add comments per task
- Timestamp tracking
- Edit/delete capability
- Plain text support
- Activity log

#### 2.8 Job Cloning
- Duplicate existing job
- Copy phases and tasks
- Reference to source job
- Retain source job title even if deleted
- Reset completion status

#### 2.9 Job Sharing
- Share token generation
- Public/private/friends visibility
- View-only link sharing
- Feed integration for public jobs

#### 2.10 Bill of Materials (BOM)
- Parts list per job
- Part name and number
- Vendor tracking
- Quantity and unit cost
- Status: needed, ordered, received, installed
- Notes field
- Total cost calculation

### 3. Service History

#### 3.1 Service Records
- Create from completed job or manually
- Fields:
  - Title and service type
  - Service date
  - Mileage at service
  - Cost
  - Parts used
  - Details and notes
  - Parts source
  - Duration
  - Next service due
- Link to originating job
- Link to vehicle
- Timeline view (chronological)
- Filter and search

#### 3.2 Service Attachments
- Upload estimates, invoices
- Link photos from job
- Vendor tracking
- Amount tracking
- Type categorization

#### 3.3 Service-to-Job Linking
- Auto-create service record from completed job
- Preserve job details in service record
- Maintain relationship
- Navigate between linked entities

#### 3.4 Maintenance Forecasting
- AI-generated maintenance predictions
- Based on:
  - Vehicle age and mileage
  - Service history
  - Manufacturer recommendations
  - VIN-decoded specifications
- Forecast items (JSON array)
- Regeneration capability
- Last updated timestamp

#### 3.5 Maintenance Schedule
- Custom schedule items per vehicle
- Category: engine, brakes, fluids, tires, electrical, filters, inspection, cooling
- Interval: miles and/or months
- Last completed tracking
- Due date calculation
- Custom vs. manufacturer items
- Sort order

### 4. Receipt Management

#### 4.1 Receipt Inbox
- Upload receipts (photo/PDF)
- Status: inbox (unprocessed) or linked (attached to service)
- OCR processing via Tesseract
- AI extraction via Anthropic/OpenAI:
  - Vendor name
  - Total amount
  - Receipt date
  - Line items (name, amount, quantity)
- Manual editing after extraction
- Notes field

#### 4.2 Receipt Line Items
- Itemized parts/services
- Name, quantity, amount
- Link to specific task
- Warranty information per line item:
  - Provider
  - Start date
  - End date
  - Warranty notes
- Task association

#### 4.3 Receipt Linking
- Link to job or service record
- Move from inbox to linked
- Multiple receipts per service
- Search and filter

#### 4.4 Receipt Processing
- Queue-based processing
- Async OCR and AI
- Progress indication
- Error handling
- Retry capability

### 5. Warranty Tracking

#### 5.1 Warranty Data Model
- Stored on receipt line items
- Fields: provider, start date, end date, notes
- Linked via: LineItem → Receipt → ServiceRecord → Car

#### 5.2 Warranty Dashboard (per vehicle)
- Active warranties section
- Expiring soon (30 days)
- Expired warranties
- Status badges
- Part name and provider
- Expiration date
- Link to source receipt/service

#### 5.3 Garage-Level Warranty Alerts
- Home dashboard widget
- Count of expiring warranties
- Count of expired warranties
- Top urgent items across all cars
- Cross-car visibility

#### 5.4 Warranty Search & Filter
- Filter by: car, status, provider
- Sort by: end date, car, provider
- Search: part name, provider
- Dedicated /warranties page (planned)

### 6. Mileage Tracking

#### 6.1 Mileage Logging
- Manual entry
- Auto-capture from service records
- Auto-capture from job completion
- Timestamp (recorded at)
- Source tracking: manual, service, job
- Source ID reference
- Notes field

#### 6.2 Mileage Validation
- Numeric validation
- Warning if new < latest
- User override capability
- Historical log view

#### 6.3 Mileage History
- Timeline of all entries
- Sort by date
- Filter by source
- Export capability

### 7. Search & Discovery

#### 7.1 Global Search
- Search from home page
- Searchable entities:
  - Car year/make/model/trim
  - Job title and notes
  - Phase titles
  - Task titles
  - Comments
  - Service history titles
  - Receipt vendors
- Full-text search (case-insensitive)
- Results grouped by type

#### 7.2 Filtering
- Cars: make, model, year, asset type
- Jobs: status, car, service type
- Service records: date range, type, mileage range
- Receipts: status, vendor, amount range
- Warranties: car, status, expiring soon

#### 7.3 Sorting
- Default: most recent
- Mileage (ascending/descending)
- Date
- Cost
- Alphabetical

### 8. Multi-User & Sharing

#### 8.1 User Management
- Registration (invite-based or open)
- Email/password authentication
- Display name and username
- Profile photo (planned)
- Public bio
- Public profile toggle
- Account settings

#### 8.2 Invitations
- Generate invite tokens
- Invite by email
- Access levels: view, full
- Expiration dates
- Track usage (who accepted)
- Revoke invites
- Admin-created invites

#### 8.3 Friend Connections
- Send friend requests
- Accept/decline requests
- Block users
- Connection status: pending, accepted, blocked
- Access level per connection
- Friends list page

#### 8.4 Garage Sharing
- Default visibility: private
- Share with friends (accepted connections)
- Custom access control
- Per-garage member list
- Remove members
- Audit trail (planned)

#### 8.5 Project Sharing
- Inherit garage visibility or override
- Visibility options:
  - Private (owner only)
  - Friends (accepted connections)
  - Custom (specific users)
  - Public (anyone with link)
- Project collaborators (edit rights)
- Project viewers (read-only)
- Share token for link sharing

#### 8.6 Shared Garage View
- Browse friends' shared garages
- View their cars and jobs
- Read-only unless collaborator
- Like and bookmark capability
- Shared-with-me page

#### 8.7 Access Control
- Role-based permissions:
  - Owner (full control)
  - Collaborator (edit content)
  - Viewer (read-only)
- Server-side authorization
- Permission checks on all API routes
- No client-trust model

### 9. Social Feed

#### 9.1 Posts
- Create posts from jobs
- Title and caption
- Link to source job
- Publish/unpublish toggle
- Published timestamp
- One post per job (unique constraint)

#### 9.2 Post Media
- Multiple photos/videos per post
- Primary media designation
- Captions
- Sort order
- Carousel view

#### 9.3 Feed View
- Public feed of published posts
- Sort by published date (newest first)
- Like posts
- Bookmark posts
- Author attribution
- Navigate to source job

#### 9.4 Likes & Bookmarks
- Like any public post
- Unlike capability
- Bookmark for later
- View saved posts
- Like count display

#### 9.5 Feed Captions
- Public-facing post description
- Separate from internal job notes
- Edit without affecting job
- Feed updated timestamp

### 10. Guest Mode

#### 10.1 Guest Features
- No login required
- Create cars and jobs
- Data stored in localStorage
- Full editing capability
- Photo uploads (temporary)
- No sharing or social features

#### 10.2 Guest Data Import
- Convert guest → registered account
- Import wizard
- Migrate cars and jobs
- Preserve photos
- One-time transfer
- Data deletion after import

#### 10.3 Guest Banner
- Persistent reminder
- Import prompt
- Register CTA
- Dismissible per session

### 11. AI Features

#### 11.1 AI Assistant
- Context-aware chat
- Job-specific conversations
- General garage chat
- Multiple AI providers:
  - Default (Anthropic Claude)
  - Custom (user-provided API key)
- Conversation history (JSON)
- Per-job or global context

#### 11.2 AI Model Selection
- User preference: default or custom
- API key storage
- Provider selection (planned)
- Model version control

#### 11.3 AI-Powered Receipt OCR
- Extract text from receipts
- Parse vendor, date, total, line items
- Confidence scoring
- Manual correction UI
- Fallback to manual entry

#### 11.4 AI-Generated Blurbs
- Vehicle history narratives
- Model generation context
- Markdown formatting
- Generation timestamp
- Regeneration capability

#### 11.5 AI Maintenance Recommendations
- Based on vehicle type/age/mileage
- Service interval suggestions
- Parts recommendations
- Troubleshooting guidance

### 12. Media Management

#### 12.1 Photo Upload
- Multi-photo upload
- Drag-and-drop support
- Client-side compression
- Max 1920px width
- JPEG optimization
- EXIF preservation (planned)

#### 12.2 Video Upload
- Support for .mp4, .mov
- Max 250 MB (configurable)
- Transcoding to H.264
- 30fps frame rate
- 1280px max width
- CRF 28 quality
- WebP thumbnail generation

#### 12.3 Storage Backend
- Local filesystem (default)
- AWS S3 (optional)
- Dual-write mode
- Presigned URLs (planned)
- Public vs private ACLs

#### 12.4 Media Optimization
- Automatic image compression (Sharp)
- Video transcoding (FFmpeg)
- Thumbnail generation
- On-demand processing
- Async processing (planned)

#### 12.5 Media Delivery
- Direct filesystem serve
- S3 redirect for remote storage
- On-the-fly thumbnail generation
- Caching headers
- Signed URL protection (planned)

### 13. Export & Backup

#### 13.1 Project Export
- Formats: Markdown, JSON, CSV (planned)
- Include: title, car, notes, phases, tasks, completion, comments, photo refs
- Download as file
- Per-project export

#### 13.2 Car History Export
- Service history
- Project summaries
- Mileage log
- Receipts list
- JSON or PDF format (planned)

#### 13.3 Full Garage Export
- All cars, jobs, service records
- Photos metadata
- Warranty data
- JSON format
- Backup/restore capability
- Database dump option

#### 13.4 Database Backups
- SQLite database file
- Timestamped backups
- Script-based
- Pre-deployment backups
- Stored in backups/ directory

### 14. Internationalization

#### 14.1 Language Support
- English (default)
- Spanish
- Client-side translation context
- Server-side translation for emails
- Translation cache model
- Dynamic text component (`<T>` and `<DT>`)

#### 14.2 Translation System
- Key-based lookup
- Fallback to English
- Database-cached translations
- AI-powered translation (planned)
- User language preference

### 15. UI/UX Features

#### 15.1 Layout
- App shell with bottom navigation
- Sticky headers
- Modal dialogs
- Slide-over panels
- Breadcrumb navigation
- Back button support

#### 15.2 Bottom Navigation
- Home, Feed, Search (planned), Receipts, Profile
- Active state indicators
- Mobile-optimized
- Fixed position
- Icon-based

#### 15.3 Theme & Styling
- Dark mode (default)
- CSS custom properties
- Sidebar color scheme
- Accent colors
- Status color coding:
  - Amber: active/in-progress
  - Emerald: complete
  - Red: overdue/blocked
  - Gray: inactive/archived

#### 15.4 Responsive Design
- Mobile-first
- Tablet breakpoints
- Desktop expansion
- Grid/list toggle views
- Touch-optimized tap targets

#### 15.5 Progressive Web App
- Installable
- Offline capability (planned)
- App manifest
- Service worker
- Home screen icon
- Splash screens

#### 15.6 Notifications (Planned)
- Warranty expiration reminders
- Maintenance due alerts
- Friend requests
- Shared project updates
- In-app notification center

### 16. Admin Features

#### 16.1 Admin Dashboard
- User management
- System statistics
- Database health
- Media storage usage
- Activity logs

#### 16.2 User Administration
- View all users
- Edit user details
- Reset passwords
- Change roles
- Delete accounts
- Invite users

#### 16.3 Content Moderation
- Review public posts
- Remove inappropriate content
- User reports (planned)
- Block/ban users

---

## Database Schema Overview

### Core Entities

**User** - User accounts and authentication
- id, email, passwordHash, name, displayName
- role (admin/user)
- username, publicBio, isPublic
- aiModel, aiApiKey
- Relationships: cars, jobs, receipts, connections, posts, likes, bookmarks

**Car** - Vehicles and assets
- id, userId, assetType (vehicle/bicycle/trailer/riding_mower/equipment)
- year, make, model, trim, color, mileage, vin, transmission
- bikeType, frameSize, wheelSize (bicycle-specific)
- publicNotes, isPublic, acquiredDate, purchasePrice
- Relationships: jobs, photos, documents, serviceRecords, mileageLogs, vinEnrichment

**Job** - Maintenance projects
- id, userId, carId, title, notes, status, serviceType
- shareToken, toolsJson, sortOrder
- startedAt, completedAt
- clonedFromId, clonedFromTitle
- feedCaption, feedUpdatedAt
- Relationships: phases, attachments, receipts, photos, bomItems, likes, bookmarks, posts

**Phase** - Job phases/sections
- id, jobId, title, emoji, notes, sortOrder, status, toolsJson
- Relationships: tasks

**Task** - Individual task items
- id, phaseId, title, warning, tip, done, dueDate, sortOrder
- torqueValue, torqueUnit, partsCost, laborCost, partsNote
- completedAt
- Relationships: comments, photos, receiptLineItems

**ServiceRecord** - Service history entries
- id, carId, jobId, title, serviceType, notes, details
- partsUsed, cost, nextServiceDue, duration, partsSource
- mileage, serviceDate
- Relationships: receipts, attachments

**Receipt** - Uploaded receipts
- id, userId, filename, vendor, totalAmount, receiptDate, notes
- status (inbox/linked), jobId, serviceRecordId
- Relationships: lineItems

**ReceiptLineItem** - Receipt line items with warranty
- id, receiptId, name, amount, quantity, taskId, notes
- warrantyProvider, warrantyStart, warrantyEnd, warrantyNotes

### Supporting Entities

**CarPhoto** - Vehicle photos
- id, carId, filename, caption, takenAt, isFeatured, isPrivate

**CarDocument** - Vehicle documents
- id, carId, filename, type, label, expiresAt, notes, isPrivate

**MileageLog** - Mileage history
- id, carId, mileage, recordedAt, source (manual/service/job), sourceId, notes

**JobPhoto** - Job photos and videos
- id, jobId, filename, mediaType (image/video), caption, isPublic, isPrimary, sortOrder

**JobAttachment** - Job attachments
- id, jobId, serviceRecordId, userId, filename, type, vendor, amount, caption

**JobBomItem** - Bill of materials
- id, jobId, name, partNumber, vendor, quantity, unitCost, status, notes

**Comment** - Task comments
- id, taskId, text

**Photo** - Task photos
- id, taskId, filename, caption

**Post** - Social feed posts
- id, userId, jobId, title, caption, isPublished, publishedAt
- Relationships: media

**PostMedia** - Post media items
- id, postId, filename, mediaType, caption, isPrimary, sortOrder

**JobLike** - Job likes
- id, jobId, userId

**JobBookmark** - Job bookmarks
- id, jobId, userId

### Multi-User Entities

**Invite** - Invitation tokens
- id, token, email, accessLevel (view/full)
- createdById, usedById, usedAt, expiresAt

**Connection** - Friend connections
- id, requesterId, addresseeId
- status (pending/accepted/blocked)
- accessLevel (view/full)

### Vehicle Data Entities

**VinEnrichment** - VIN decoded data
- id, carId, nhtsaDecodeRaw, recallsRaw, marketDataRaw
- engine, displacement, drivetrain, bodyStyle, plant, fuelType, doors, series, trim
- hasOpenRecalls, recallCount, recallsSummary
- marketValueLow/Mid/High, marketValueSource, marketValueDate
- garageEstimate, conditionScore, adjustmentJson, estimatedAt
- valuationHistory, blurb, blurbGeneratedAt

**VehicleExternalData** - External API raw data
- id, carId, provider, recordType, rawJson, normalizedStatus, fetchedAt

**VehicleRecall** - Recall records
- id, carId, campaignNumber, component, summary, recallDate
- isOpen, consequence, remedy, sourceProvider, lastCheckedAt

**VehicleMarketValue** - Market value snapshots
- id, carId, sourceProvider, valueLow/Avg/High, currency
- mileageUsed, zipUsed, fetchedAt, rawJson

**VehicleEstimate** - Garage value estimate
- id, carId, marketBaseline, marketSource, garageEstimate
- maintenanceAdjustment, repairAdjustment, conditionAdjustment
- mileageAdjustment, recallAdjustment, modAdjustment
- adjustmentDetailJson, confidenceScore, confidence, confidenceReason
- conditionScore, conditionNotes, version, generatedAt

**VehicleEstimateSnapshot** - Historical estimates
- id, carId, garageEstimate, marketBaseline, confidence, triggerSource, generatedAt

**VehicleSpecs** - Technical specifications
- id, carId
- Engine: engineOilType, engineOilCapacity, oilDrainPlugTorque, oilChangeInterval
- Transmission: transmissionFluid, transmissionCapacity, transmissionService
- Coolant: coolantType, coolantCapacity, thermostatTemp, coolantPressureCap
- Ignition: sparkPlugBrand, sparkPlugGap, firingOrder, ignitionCoilTorque
- Brakes: brakeFluidType, frontBrakeMinThick, rearBrakeMinThick, frontRotorMinThick, rearRotorMinThick, caliperBoltTorqueFront/Rear
- Wheels: lugNutTorque, wheelSize, tireSize, coldTirePressure
- Other: powerSteeringFluid, acRefrigerant, diffFluid, batterySpec, airFilterInterval, timingBeltOrChain, notes

**MaintenanceScheduleItem** - Maintenance schedule
- id, carId, task, category, notes
- intervalMiles, intervalMonths
- lastDoneMiles, lastDoneDate
- isCustom, sortOrder

**MaintenanceForecast** - AI forecasts
- id, carId, items (JSON), generatedAt

### AI & Translation

**AIConversation** - AI chat history
- id, userId, jobId, messages (JSON array)

**UserTemplate** - Custom job templates
- id, name, phasesJson

**TranslationCache** - Translation cache
- id, hash, original, lang, translated

---

## API Structure

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Cars
- `GET /api/cars` - List user's cars
- `POST /api/cars` - Create car
- `GET /api/cars/:id` - Get car details
- `PATCH /api/cars/:id` - Update car
- `DELETE /api/cars/:id` - Delete car
- `POST /api/cars/:id/photos` - Upload car photos
- `PATCH /api/cars/:id/photos/:photoId` - Update photo
- `DELETE /api/cars/:id/photos/:photoId` - Delete photo
- `POST /api/cars/:id/documents` - Upload documents
- `DELETE /api/cars/:id/documents/:docId` - Delete document

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/:id` - Get job details
- `PATCH /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/:id/photos` - Upload photos/videos
- `PATCH /api/jobs/:id/photos/:photoId` - Update photo
- `DELETE /api/jobs/:id/photos/:photoId` - Delete photo
- `POST /api/jobs/:id/attachments` - Upload attachments
- `POST /api/jobs/:id/phases` - Create phase
- `PATCH /api/jobs/:id/phases/:phaseId` - Update phase
- `DELETE /api/jobs/:id/phases/:phaseId` - Delete phase
- `POST /api/jobs/:id/phases/:phaseId/tasks` - Create task
- `PATCH /api/jobs/:id/tasks/:taskId` - Update task
- `DELETE /api/jobs/:id/tasks/:taskId` - Delete task
- `POST /api/jobs/:id/tasks/:taskId/comments` - Add comment
- `POST /api/jobs/:id/tasks/:taskId/photos` - Upload task photo
- `POST /api/jobs/:id/clone` - Clone job

### Service Records
- `GET /api/service-records` - List service records
- `POST /api/service-records` - Create service record
- `GET /api/service-records/:id` - Get service record
- `PATCH /api/service-records/:id` - Update service record
- `DELETE /api/service-records/:id` - Delete service record
- `POST /api/service-records/:id/attachments` - Upload attachment

### Receipts
- `GET /api/receipts` - List receipts (inbox)
- `POST /api/receipts` - Upload receipt
- `GET /api/receipts/:id` - Get receipt details
- `PATCH /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt
- `POST /api/receipts/:id/process` - Process with OCR/AI
- `POST /api/receipts/:id/attach-photo` - Attach additional photo
- `PATCH /api/receipts/:id/line-items/:itemId` - Update line item

### Posts & Feed
- `GET /api/feed` - Get public feed
- `POST /api/posts` - Create post
- `GET /api/posts/:id` - Get post details
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/media` - Upload post media
- `POST /api/posts/:id/publish` - Publish post
- `POST /api/posts/:id/like` - Like post
- `DELETE /api/posts/:id/like` - Unlike post
- `POST /api/posts/:id/bookmark` - Bookmark post
- `DELETE /api/posts/:id/bookmark` - Remove bookmark

### Connections & Sharing
- `GET /api/connections` - List connections
- `POST /api/connections/request` - Send friend request
- `POST /api/connections/:id/accept` - Accept request
- `POST /api/connections/:id/reject` - Reject request
- `POST /api/connections/:id/block` - Block user
- `DELETE /api/connections/:id` - Remove connection

### Invites
- `POST /api/invites` - Create invite
- `GET /api/invites` - List invites
- `POST /api/invites/:token/accept` - Accept invite
- `DELETE /api/invites/:id` - Revoke invite

### Shared Garages
- `GET /api/shared-garage` - List shared garages
- `GET /api/shared-garage/:userId` - Get shared garage details

### AI
- `POST /api/ai/chat` - AI assistant chat
- `POST /api/ai/analyze-receipt` - AI receipt analysis

### Media
- `GET /api/media/thumb` - Generate thumbnail
- `GET /uploads/:path` - Serve media file

### Export
- `GET /api/export/job/:id` - Export job
- `GET /api/export/car/:id` - Export car history
- `GET /api/export/garage` - Export full garage

### Translation
- `POST /api/translate` - Translate text

### User/Profile
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update profile
- `GET /api/users/:username` - Get public profile

### Settings
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - System statistics
- `POST /api/admin/invites` - Create admin invite

### Guest
- `POST /api/guest/import` - Import guest data

---

## Security & Privacy

### Authentication
- JWT-based session tokens
- HTTP-only secure cookies
- bcrypt password hashing (10 rounds)
- Session expiration
- Logout on all devices

### Authorization
- Server-side permission checks
- Role-based access control
- Owner/collaborator/viewer model
- Connection-based sharing
- Private by default

### Data Protection
- User data isolation
- Private photos/documents
- Public visibility toggles
- Invite-only registration (optional)
- Guest data in localStorage only

### API Security
- Session middleware on all protected routes
- CSRF protection (planned)
- Rate limiting (planned)
- Input validation
- SQL injection protection (Prisma)

### Media Security
- File type validation
- File size limits
- Path traversal prevention
- Signed URLs (planned)
- Private S3 ACLs (planned)
- Encryption at rest (S3 server-side)

### Known Security Issues (From Review)
1. ⚠️ `/uploads/[...path]` route is unauthenticated
2. ⚠️ Default S3 ACL is `public-read` (should be `private`)
3. ⚠️ S3 URLs are unsigned (should use presigned URLs)
4. ⚠️ Receipt processing reads local disk only (breaks when S3 enabled)

---

## Current Limitations & Known Issues

### Technical Debt

1. **Media Processing in Request Handlers**
   - FFmpeg runs synchronously in HTTP requests
   - Can cause timeouts on large videos
   - No async processing pipeline
   - Recommended: Move to background worker

2. **Storage Abstraction Issues**
   - S3 and local storage code paths differ
   - Receipt OCR only reads from local disk
   - No unified `readMedia`/`deleteMedia` helpers
   - Car documents bypass S3 entirely

3. **Code Duplication**
   - Video optimization code duplicated in multiple routes
   - Image optimization re-implemented per route
   - No centralized media processing library

4. **Inconsistent Size Limits**
   - Different max upload sizes per route (20MB to 250MB)
   - No central configuration
   - Spec calls for 2GB but not implemented

5. **No Upload Resumption**
   - Single-shot uploads only
   - No chunked upload support
   - Network failure = full retry
   - No progress tracking

6. **Media State Machine Missing**
   - No `processing` status on media records
   - Uploaded media immediately marked complete
   - No way to show "still processing" UI
   - No failed state tracking

### Functional Limitations

1. **Single-User Focus**
   - Multi-user features recently added
   - Sharing still being refined
   - No notifications system yet
   - Limited audit logging

2. **No Push Notifications**
   - Warranty expiration reminders manual
   - No maintenance due alerts
   - Friend request notifications in-app only

3. **Limited Export Formats**
   - JSON export only
   - PDF generation not implemented
   - No CSV export for analysis

4. **Search Constraints**
   - No full-text search index
   - LIKE-based queries only
   - No search across shared garages
   - No saved searches

5. **Template System Basic**
   - User templates work but limited
   - No template marketplace
   - No template versioning
   - No template sharing

6. **AI Features Basic**
   - Conversation history per job
   - No context window management
   - No multi-turn refinement UI
   - API key management basic

### Performance Concerns

1. **Database Scalability**
   - SQLite works for personal use
   - No connection pooling
   - Full-text search not indexed
   - Large media queries can be slow

2. **No CDN**
   - Media served from app server
   - No edge caching
   - Video streaming not optimized
   - No adaptive bitrate

3. **Client-Side Optimization**
   - Image compression limited to JPEG
   - No WebP generation client-side
   - Video compression client-side not implemented

### UX Gaps

1. **Progress Indication**
   - No real upload progress bar
   - Processing happens behind spinner
   - No estimated time remaining
   - Failed uploads show generic errors

2. **Mobile Optimization**
   - Works but not fully optimized
   - Some forms cumbersome on mobile
   - Photo gallery could be improved
   - Pinch-zoom support limited

3. **Accessibility**
   - Keyboard navigation incomplete
   - Screen reader support minimal
   - Color contrast could improve
   - Alt text not enforced

---

## Roadmap & Future Development

### Phase 1 - Security & Reliability (High Priority)
- ✅ Fix S3 public-read default → private
- ✅ Implement presigned URLs for media
- ✅ Add authentication to /uploads route
- ✅ Fix S3/local storage asymmetry
- ✅ Move FFmpeg to background processing
- ✅ Add processing status to media models

### Phase 2 - Core Feature Completion (High Priority)
- Edit projects after creation
- Delete projects with cascading cleanup
- Add/edit/delete phases
- Add/edit/delete tasks
- Edit/delete comments
- Task due dates and overdue indicators
- Enhanced car dashboard metrics

### Phase 3 - Service History Enhancements (High Priority)
- Service history improvements
- Mileage validation warnings
- Service-to-job linking refinements
- Parts cost rollup
- Service interval calculator

### Phase 4 - Warranty Dashboard (Medium Priority)
- Car-level warranty section
- Home dashboard warranty alerts
- Dedicated /warranties page
- Expiration notifications (email/push)
- Warranty claims tracking

### Phase 5 - Search & Discovery (Medium Priority)
- Global search implementation
- Full-text search indexing
- Advanced filters
- Saved searches
- Search across shared garages

### Phase 6 - Export & Backup (Medium Priority)
- Markdown export for projects
- CSV export for service history
- PDF generation for reports
- Automated backup scheduling
- Restore from backup UI

### Phase 7 - Multi-User Polish (Medium Priority)
- Public links for garages/projects
- Audit log for sharing actions
- In-app notification center
- Activity feed for friends
- Collaboration indicators

### Phase 8 - Advanced Media (Lower Priority)
- Chunked upload with resume
- HLS video streaming
- Multiple renditions (720p, 480p)
- CDN integration
- Video trimming/editing

### Phase 9 - Templates & Marketplace (Lower Priority)
- Template versioning
- Template sharing between users
- Community template library
- Template ratings/reviews
- Import from URL

### Phase 10 - AI Enhancements (Lower Priority)
- Multi-provider AI support
- Context window management
- Voice input for notes
- AI-generated maintenance plans
- Predictive maintenance alerts

### Phase 11 - OBD & IoT (Future)
- OBD-II integration
- Real-time diagnostic codes
- Live data monitoring
- Mileage auto-sync
- Geofencing for service reminders

### Phase 12 - Parts Inventory (Future)
- Parts catalog per garage
- Inventory tracking
- Reorder alerts
- Price comparison
- Barcode scanning

### Out of Scope (Per PRD)
- Cloud sync (currently local-first)
- Push notifications (planned but not committed)
- Advanced analytics dashboard
- Mobile apps (PWA only)
- Payment processing
- Marketplace for services

---

## Deployment & Operations

### Environment Variables

**Required:**
- `DATABASE_URL` - SQLite database path
- `JWT_SECRET` - Session token secret
- `NODE_ENV` - production/development

**Optional (AWS S3):**
- `AWS_ACCESS_KEY_ID` - S3 access key
- `AWS_SECRET_ACCESS_KEY` - S3 secret
- `AWS_REGION` - S3 region (default: us-east-1)
- `AWS_BUCKET` - S3 bucket name
- `AWS_ACL` - S3 ACL (should be empty for private)
- `AWS_SIGNED_URL_EXPIRES` - Signed URL expiry in seconds (default: 600)

**Optional (AI):**
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key (for fallback)

**Optional (Analytics):**
- `MATOMO_SITE_ID` - Matomo site ID
- `MATOMO_URL` - Matomo server URL

**Optional (Features):**
- `INLINE_VIDEO_TRANSCODE` - Enable sync video processing (default: false)
- `MAX_INLINE_VIDEO_BYTES` - Max size for sync processing (default: 50MB)

### Docker Deployment

**Build:**
```bash
docker build -t garage-work-manager .
```

**Run:**
```bash
docker-compose up -d
```

**Components:**
- Alpine Linux base
- Node.js runtime
- FFmpeg for video processing
- Tesseract for OCR
- SQLite database (volume mounted)
- Uploads directory (volume mounted)

### Database Migrations

**Apply migrations:**
```bash
npm run prisma migrate deploy
```

**Create migration:**
```bash
npm run prisma migrate dev --name migration_name
```

**Seed database:**
```bash
npm run db:seed
```

### Backup & Restore

**Backup database:**
```bash
cp app/prisma/dev.db backups/garage.db.$(date +%Y%m%d-%H%M%S).bak
```

**Backup uploads:**
```bash
tar -czf backups/uploads.$(date +%Y%m%d-%H%M%S).tgz app/public/uploads/
```

**Restore:**
```bash
# Stop app
docker-compose down
# Restore DB
cp backups/garage.db.TIMESTAMP.bak app/prisma/dev.db
# Restore uploads
tar -xzf backups/uploads.TIMESTAMP.tgz -C app/public/
# Restart
docker-compose up -d
```

### Monitoring

**Logs:**
```bash
docker-compose logs -f app
```

**Health Check:**
- App should respond at configured port
- Database connection verified on startup
- No metrics endpoint currently (planned)

**Storage Monitoring:**
- Monitor disk space for uploads
- Monitor S3 bucket size if enabled
- Database size growth

### Performance Tuning

**Recommended:**
- Use SSD for SQLite database
- Enable WAL mode for SQLite
- Configure adequate disk space for uploads
- Use S3 for large deployments
- Enable CDN for media (planned)

### Scaling Considerations

**Current Capacity:**
- Designed for personal use (1-10 users)
- Can handle ~100 vehicles per user
- Thousands of jobs and photos

**Scaling Limits:**
- SQLite limits concurrent writes
- No horizontal scaling
- Media storage on single volume
- No load balancing

**Migration Path:**
- PostgreSQL for multi-user production
- S3 for media at scale
- Redis for session storage
- Queue system for background jobs
- CDN for media delivery

---

## Conclusion

Garage Work Manager is a comprehensive vehicle maintenance tracking application designed for car enthusiasts and DIY mechanics. It combines project management, service history tracking, receipt management, and social features into a mobile-optimized Progressive Web App.

**Key Strengths:**
- Comprehensive feature set for vehicle maintenance
- Flexible support for multiple asset types
- Strong photo/media capabilities
- AI-powered assistance
- Multi-user sharing with privacy controls
- Active development with clear roadmap

**Areas for Improvement:**
- Media processing pipeline needs optimization
- Security hardening in progress
- Search and discovery features
- Export and backup capabilities
- Mobile UX refinements
- Performance at scale

**Best Use Cases:**
- Personal vehicle maintenance tracking
- DIY mechanic project documentation
- Small garage/shop operation
- Car enthusiast communities
- Family vehicle management

The application is actively developed with a clear focus on user privacy, offline capability, and mobile-first design, making it an excellent choice for anyone serious about tracking vehicle maintenance and projects.

---

**Document Metadata:**
- **Created:** May 14, 2026
- **Author:** Comprehensive analysis of car-maintenance app
- **Sources:** PRD.md, schema.prisma, code review documents, API routes, UI components
- **Version:** 1.0
- **Next Review:** When Phase 1-2 roadmap items complete
