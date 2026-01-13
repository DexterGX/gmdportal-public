# File Upload Implementation Summary

## Overview

Replaced text-based "Image URL" inputs with actual file uploads using Supabase Storage for closet quote images.

## What Changed

### 1. Package Installation

- Installed `@supabase/supabase-js` for Supabase Storage integration

### 2. New Files Created

#### `src/lib/supabase/client.ts`

- Client-side Supabase helper using public anon key
- Used for browser-side operations

#### `src/lib/supabase/server.ts`

- Server-side Supabase admin helper using service role key
- Bypasses RLS for admin operations
- Used in API routes for file uploads

#### `src/app/api/closet-jobs/[jobId]/quotes/[quoteId]/files/route.ts`

- New endpoint for multipart file uploads
- Validates file size (max 10MB) and type (image/\* only)
- Uploads to Supabase Storage at path: `closet-jobs/{jobId}/quotes/{quoteId}/{timestamp}-{filename}`
- Creates `ClosetQuoteFile` database records with public URLs
- Returns array of uploaded file objects

#### `SUPABASE_SETUP.md`

- Complete setup instructions for Supabase Storage
- Step-by-step guide for getting API keys
- Bucket creation instructions
- Optional RLS policy configurations

### 3. Modified Files

#### `.env.local`

- Added `NEXT_PUBLIC_SUPABASE_URL` (already correct)
- Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` (needs real value)
- Added `SUPABASE_SERVICE_ROLE_KEY` (needs real value)

#### `src/app/closet-jobs/[jobId]/new-quote/NewQuoteForm.tsx`

**Before:**

- Text inputs for image URLs
- `files` state with `{fileUrl, type, caption}` objects
- Single-step submission with nested file creation

**After:**

- File input with `accept="image/*" multiple`
- `selectedFiles` state with `{file: File, preview: string, caption: string}` objects
- Preview grid showing thumbnails with remove buttons and caption inputs
- Two-step submission:
  1. Create quote → get quote ID
  2. Upload files using FormData to `/files` endpoint
- Object URL cleanup on unmount

#### `src/app/api/closet-jobs/[jobId]/quotes/route.ts`

**Before:**

- Accepted `files` array in request body
- Created nested `ClosetQuoteFile` records during quote creation

**After:**

- Removed `files` from request body
- Files are uploaded separately via dedicated endpoint
- Quote created without files, then files uploaded with quote ID

## File Upload Flow

```
User selects files
    ↓
Preview grid shows thumbnails + caption inputs
    ↓
User clicks "Submit Quote"
    ↓
[Step 1] POST /api/closet-jobs/{jobId}/quotes
    Creates quote, returns { id, quoteCode }
    ↓
[Step 2] POST /api/closet-jobs/{jobId}/quotes/{quoteId}/files
    Uploads files to Supabase Storage
    Creates ClosetQuoteFile DB records
    ↓
Navigate to quote detail page
```

## File Storage Structure

```
Supabase Storage Bucket: closet-quotes
└── closet-jobs/
    └── {jobId}/
        └── quotes/
            └── {quoteId}/
                ├── 1703123456789-kitchen-render.jpg
                ├── 1703123456790-bathroom-plan.png
                └── 1703123456791-closet-photo.jpg
```

## Database Schema

```prisma
model ClosetQuoteFile {
  id           String       @id @default(cuid())
  quoteId      String
  quote        ClosetQuote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  fileUrl      String       // Public URL from Supabase Storage
  caption      String?
  uploadedAt   DateTime     @default(now())
  uploadedById String
  uploadedBy   User         @relation(fields: [uploadedById], references: [id])
}
```

## Validation Rules

- **Max file size**: 10 MB per file
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/jpg`, `image/webp`, `image/gif`
- **Multiple uploads**: Supported (array of files)
- **Permissions**: Only quote's installer or admin can upload

## Required Setup Steps

1. **Get Supabase API keys** from project dashboard

   - Copy anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy service_role secret → `SUPABASE_SERVICE_ROLE_KEY`

2. **Create Storage bucket** in Supabase dashboard

   - Name: `closet-quotes`
   - Public: YES

3. **Restart dev server** after updating `.env.local`

4. **Test the flow**:
   - Create new quote
   - Upload images
   - Verify in Supabase Storage
   - Check ClosetQuoteFile table

## Error Handling

- Quote creation failure → Show error, stop submission
- File upload failure → Quote created, show warning, allow retry later
- Invalid file type → Rejected with 400 error
- File too large → Rejected with 400 error
- Unauthorized → 401 error
- Forbidden (not quote's installer) → 403 error

## Next Steps

1. Update quote display components to show uploaded images
2. Add drag-and-drop support to file input (optional enhancement)
3. Add file upload progress indicators (optional)
4. Consider adding image compression before upload (optional)
5. Add ability to delete/replace files after upload (optional)

## TypeScript Safety

- All endpoints properly typed
- File validation ensures type safety
- Null checks added for user object
- FormData properly typed for multipart uploads
