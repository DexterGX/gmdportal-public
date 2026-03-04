# Accessories Tracker - Setup Instructions

## Quick Start

### 1. Run Database Migration
```bash
cd c:\Users\fbersan\Documents\GitHub\GMDportal
npx prisma migrate dev --name add_accessories_tracker
npx prisma generate
```

This will:
- Create the AccessoryTracker, AccessoryItem, and AccessoryItemEvent tables
- Add all required enums (AccessoryItemStatus, AccessoryCategory, etc.)
- Generate TypeScript types

### 2. Verify Installation
After running the migration, restart your development server:
```bash
npm run dev
```

### 3. Access the Module
Navigate to: `http://localhost:3000/accessories`

The "Accessories" link will also appear in:
- Sidebar navigation (when in Accessories program)
- Dashboard "Others" menu

## Files Created

```
✅ Database Schema
   prisma/schema.prisma                                (Updated)

✅ Server Actions
   src/lib/accessories.ts                              (New)
   src/lib/programsConfig.ts                           (Updated)

✅ Pages & Components
   src/app/accessories/
      ├── layout.tsx                                   (New)
      ├── page.tsx                                     (New - Server)
      ├── AccessoriesClient.tsx                        (New - Client)
      ├── new/
      │   ├── page.tsx                                 (New - Server)
      │   └── NewAccessoryTrackerClient.tsx            (New - Client)
      └── [trackerId]/
          ├── page.tsx                                 (New - Server)
          ├── AccessoryTrackerDetailClient.tsx         (New - Client)
          ├── AddItemModal.tsx                         (New - Client)
          └── EditItemModal.tsx                        (New - Client)

✅ Documentation
   ACCESSORIES_TRACKER.md                              (New)
   ACCESSORIES_SETUP.md                                (This file)
```

## Post-Installation Checklist

- [ ] Database migration completed successfully
- [ ] No TypeScript errors (after `npx prisma generate`)
- [ ] Development server running
- [ ] Can access `/accessories` page
- [ ] Can see "Accessories" in sidebar navigation
- [ ] Create a test tracker
- [ ] Add a test item
- [ ] Change item status
- [ ] Test mobile responsive views

## Permissions

The module is accessible to the following roles:
- **admin** - Full access (view, create, edit, delete)
- **office** - Full access (view, create, edit, delete)
- **finance** - Full access (view, create, edit, delete)
- **sales** - View only

To modify permissions, edit:
```typescript
// src/app/accessories/page.tsx
if (!["admin", "office", "finance", "sales"].includes(appRole)) {
  redirect("/dashboard");
}

// src/app/accessories/new/page.tsx
if (!["admin", "office", "finance"].includes(appRole)) {
  redirect("/accessories");
}
```

## Database Models Summary

### AccessoryTracker
- One tracker per Job (unique constraint on jobId)
- Tracks invoice and remeasure approval dates
- Optional department categorization
- Audit trail (createdBy, updatedBy)

### AccessoryItem
- Multiple items per tracker
- Full details (name, category, qty, sku, vendor, link)
- Optional pricing (cost, retail)
- Status workflow with date tracking
- Priority levels
- Assignment to users
- Audit trail

### AccessoryItemEvent
- Event log for each item
- Tracks status changes, notes, and field edits
- Full user attribution

## Common Use Cases

### Creating a Tracker
1. Go to `/accessories`
2. Click "New Tracker"
3. Search for a Job (must be ONGOING or ON_HOLD)
4. Set milestone dates
5. Save

### Adding Items
1. Open tracker detail page
2. Click "Add Item"
3. Fill in item details
4. Set initial status (usually READY_TO_ORDER)
5. Save

### Tracking Progress
1. Edit item to change status
2. Switch to "Status & Dates" tab
3. Update status
4. Dates auto-fill based on status
5. Add note if needed
6. Save

### Monitoring Issues
1. Use "Needs Attention" filter on list page
2. Shows items with:
   - Status = ISSUE
   - ETA passed but not delivered

## Troubleshooting

### TypeScript Errors After Migration
If you see errors about missing Prisma types:
```bash
npx prisma generate
```
Then restart your IDE/editor.

### "accessoryTracker does not exist" Error
This means the migration hasn't been run yet:
```bash
npx prisma migrate dev --name add_accessories_tracker
```

### Cannot Access /accessories Page
1. Check you're logged in
2. Check your user role (must be admin/office/finance/sales)
3. Check browser console for errors
4. Verify the navigation entry exists in programsConfig.ts

### Items Not Saving
1. Check browser console for errors
2. Verify database connection
3. Check server logs
4. Ensure Prisma client is generated

## Next Steps

After successful installation:

1. **Create Test Data**: Create a tracker with a few items to test the workflow
2. **Train Users**: Share the ACCESSORIES_TRACKER.md documentation with your team
3. **Customize**: Adjust categories, statuses, or fields as needed for your workflow
4. **Monitor**: Check the event history to ensure audit trail is working

## Support

For questions or issues:
- Review the main documentation: ACCESSORIES_TRACKER.md
- Check the browser console for errors
- Review server logs for API errors
- Contact the development team

## Optional Enhancements

Consider adding these features in the future:
- [ ] Dashboard widget showing summary stats
- [ ] Email notifications for overdue items
- [ ] Bulk operations (status updates, exports)
- [ ] Photo uploads for items
- [ ] Integration with purchase order system
- [ ] Budget tracking and cost reports
- [ ] Vendor management
- [ ] Advanced filtering and sorting

## Migration Details

The migration creates:

**3 New Tables:**
- accessory_tracker
- accessory_item  
- accessory_item_event

**5 New Enums:**
- AccessoryDepartment (CABINETS, COUNTERTOPS, BOTH)
- AccessoryCategory (HANDLE, PULLOUT, TRIM, HARDWARE, SINK, FAUCET, APPLIANCE, LIGHTING, OTHER)
- AccessoryItemStatus (9 statuses for workflow)
- AccessoryPriority (LOW, NORMAL, HIGH, URGENT)
- AccessoryEventType (STATUS_CHANGE, NOTE, FIELD_EDIT, CREATED)

**Indexes Added:**
- accessory_tracker: jobId
- accessory_item: trackerId, status, assignedToUserId
- accessory_item_event: itemId, createdAt

All changes are non-breaking and don't affect existing tables.
