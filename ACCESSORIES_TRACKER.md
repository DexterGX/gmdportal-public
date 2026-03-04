# Accessories Tracker Module

## Overview

The Accessories Tracker module helps track accessory purchases for cabinet and countertop jobs. After departments complete remeasure, finance can track items (handles, pullouts, hardware, etc.) through their entire lifecycle from order to installation.

## Features

### ✅ Tracker Management

- Create one tracker per job
- Track key milestone dates (Invoice Created, Remeasure Approved)
- Associate with existing Jobs and Customers
- Department categorization (Cabinets, Countertops, Both)
- Full audit trail of who created/updated trackers

### ✅ Item Tracking

Each accessory item can track:

- **Details**: Name, Category, Quantity, SKU, Vendor, Product Link
- **Pricing**: Cost and Retail prices (optional)
- **Status**: Complete workflow from pending to installed
- **Dates**: Ordered, ETA, Delivered, Checked In, Installed
- **Priority**: Low, Normal, High, Urgent
- **Assignment**: Assign items to specific users

### ✅ Status Workflow

```
PENDING_REMEASURE_APPROVAL → READY_TO_ORDER → ORDERED →
IN_TRANSIT → DELIVERED → CHECKED_IN → INSTALLED
```

Special statuses:

- **NOT_NEEDED**: Item no longer required
- **ISSUE**: Problems (backorder, damaged, etc.)

### ✅ Smart Features

- **Auto-date setting**: When status changes to ORDERED/DELIVERED/etc., dates are automatically set
- **Needs Attention**: Highlights items with issues or overdue ETAs
- **Event History**: Full audit log of all status changes, notes, and edits
- **Mobile Responsive**: Tables become cards, forms stack, optimized for all devices

### ✅ Permissions

- **View**: admin, office, finance, sales
- **Create/Edit**: admin, office, finance

## Database Schema

### AccessoryTracker

```prisma
model AccessoryTracker {
  id                   String           @id @default(cuid())
  jobId                String           @unique
  job                  Job              @relation(...)
  invoiceCreatedAt     DateTime?
  remeasureApprovedAt  DateTime?
  department           AccessoryDepartment?
  notes                String?
  createdByUserId      String?
  updatedByUserId      String?
  createdAt            DateTime
  updatedAt            DateTime
  items                AccessoryItem[]
}
```

### AccessoryItem

```prisma
model AccessoryItem {
  id                  String              @id @default(cuid())
  trackerId           String
  category            AccessoryCategory
  name                String
  quantity            Int
  sku                 String?
  vendor              String?
  linkUrl             String?
  cost                Decimal?
  retail              Decimal?
  status              AccessoryItemStatus
  priority            AccessoryPriority
  orderedAt           DateTime?
  etaAt               DateTime?
  deliveredAt         DateTime?
  checkedInAt         DateTime?
  installedAt         DateTime?
  assignedToUserId    String?
  lastStatusChangedAt DateTime?
  createdByUserId     String?
  updatedByUserId     String?
  createdAt           DateTime
  updatedAt           DateTime
  events              AccessoryItemEvent[]
}
```

### AccessoryItemEvent

```prisma
model AccessoryItemEvent {
  id              String    @id @default(cuid())
  itemId          String
  type            AccessoryEventType
  fromStatus      AccessoryItemStatus?
  toStatus        AccessoryItemStatus?
  message         String?
  changedByUserId String?
  createdAt       DateTime
}
```

## Routes

### `/accessories`

**List all accessory trackers**

- Search by job/customer name
- Filter by status, department, needs attention
- Desktop: Table view with status counts
- Mobile: Card view with key info
- Shows "Needs Attention" flag for issues/overdue items

### `/accessories/new`

**Create new tracker**

- Job selector with autocomplete search
- Milestone date inputs (Invoice Created, Remeasure Approved)
- Department selection
- Notes field

### `/accessories/[trackerId]`

**Tracker detail and item management**

- Customer info summary
- Milestone dates
- Quick stats
- Full items list with inline actions
- Add/Edit/Delete items
- View item history
- Desktop: Full table with all columns
- Mobile: Item cards with expandable details

## API / Server Actions

Located in `/src/lib/accessories.ts`:

### Tracker Operations

- `getAccessoryTrackers(filters)` - List with filtering
- `getAccessoryTracker(trackerId)` - Get single with full relations
- `createAccessoryTracker(data)` - Create new tracker
- `updateAccessoryTracker(trackerId, data)` - Update tracker

### Item Operations

- `addAccessoryItem(trackerId, data)` - Add item to tracker
- `updateAccessoryItem(itemId, data)` - Update item details
- `changeAccessoryItemStatus(itemId, newStatus, userId, options)` - Change status with auto-dates
- `deleteAccessoryItem(itemId, userId)` - Remove item
- `addAccessoryItemNote(itemId, note, userId)` - Add note to item

### Utility Functions

- `getJobsForSelector(search)` - Get jobs for dropdown
- `getAccessoryItemEvents(itemId)` - Get event history
- `getAccessoryTrackerStats()` - Dashboard statistics

## UI Components

### Modals

- **AddItemModal**: Add new accessory item
- **EditItemModal**: Edit details or change status (tabbed interface)

### Status Badges

Color-coded badges for all statuses:

- Pending/Ready: Blue
- Ordered: Yellow
- In Transit: Purple
- Delivered/Checked In: Green
- Installed: Gray
- Issue: Red
- Not Needed: Muted gray

### Priority Badges

- Low: Gray
- Normal: Blue
- High: Orange
- Urgent: Red

## Usage Workflow

### 1. Create Tracker

1. Navigate to `/accessories`
2. Click "New Tracker"
3. Search and select a Job
4. Set milestone dates if available
5. Add department and notes
6. Save

### 2. Add Items

1. Open tracker detail
2. Click "Add Item"
3. Fill in item details (name, category, qty, vendor, etc.)
4. Set initial status and priority
5. Add ETA if known
6. Save

### 3. Update Status

1. Click Edit on an item
2. Switch to "Status & Dates" tab
3. Change status
4. Add optional note
5. Adjust dates if needed (or let auto-fill)
6. Save

### 4. Monitor Progress

- Use list view to see all trackers
- "Needs Attention" filter shows problematic items
- Status counts show quick overview
- Item history shows full audit trail

## Mobile Responsiveness

### List Page (`/accessories`)

- Search and filters stack vertically
- Table becomes card list
- Each card shows job, customer, status counts
- Tap card for details

### Detail Page (`/accessories/[trackerId]`)

- Info sections stack vertically
- Items table becomes individual cards
- Each item card shows key details
- Action buttons stack horizontally
- Modals are mobile-optimized

### Forms (`/accessories/new`)

- All inputs stack vertically
- Job selector optimized for touch
- Date pickers use native mobile controls
- Large touch targets for buttons

## Migration

To apply the database changes:

```bash
npx prisma migrate dev --name add_accessories_tracker
npx prisma generate
```

## Integration Points

### Existing Models

- **Job**: One-to-one relation with AccessoryTracker
- **Customer**: Retrieved through Job relation
- **User**: For created/updated by tracking and assignments

### Navigation

Added to:

- Main program "Others" section
- New "Accessories Tracker" program in sidebar
- Available to: admin, office, finance, sales roles

### Auth

Uses existing `getCurrentUserWithRole()` helper

- Guards routes by role
- Tracks user actions in audit trail

## Future Enhancements

Potential additions:

- Bulk status updates
- Export to Excel/PDF
- Email notifications for overdue items
- Budget tracking and cost summaries
- Photo uploads for items
- Vendor management
- Purchase order generation
- Integration with accounting system
- Dashboard widgets/summary cards
- Advanced filtering (date ranges, cost ranges)
- Bulk import from CSV

## Files Created

```
src/
  lib/
    accessories.ts                   # Server actions & types
    programsConfig.ts                # Updated with new program
  app/
    accessories/
      layout.tsx                     # Layout wrapper
      page.tsx                       # List page (server)
      AccessoriesClient.tsx          # List client component
      new/
        page.tsx                     # New tracker page (server)
        NewAccessoryTrackerClient.tsx # New tracker form
      [trackerId]/
        page.tsx                     # Detail page (server)
        AccessoryTrackerDetailClient.tsx # Detail client
        AddItemModal.tsx             # Add item modal
        EditItemModal.tsx            # Edit item modal

prisma/
  schema.prisma                      # Updated with new models
```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Create a tracker for an existing job
- [ ] Add multiple items with different categories
- [ ] Change item status and verify auto-dates
- [ ] Test all status transitions
- [ ] Edit item details
- [ ] Delete an item
- [ ] Test search and filters on list page
- [ ] Verify "Needs Attention" highlighting
- [ ] Test mobile responsive behavior
- [ ] Verify permissions (different roles)
- [ ] Check audit trail/event history

## Support

For questions or issues with the Accessories Tracker module, please contact the development team or create an issue in the project repository.
