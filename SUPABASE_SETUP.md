# Supabase Storage Setup for Closet Quote File Uploads

## 1. Get Your Supabase Keys

1. Go to your Supabase project dashboard: https://app.supabase.com/project/vfeoodmoexxuxgilveve
2. Click on **Settings** (gear icon in the sidebar)
3. Click on **API**
4. Copy the following values:
   - **anon public** key → Replace `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
   - **service_role secret** key → Replace `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

## 2. Create Storage Bucket

1. In your Supabase dashboard, go to **Storage** in the sidebar
2. Click **New bucket**
3. Set the following:
   - **Name**: `closet-quotes`
   - **Public bucket**: YES (so images can be displayed via public URLs)
   - Click **Create bucket**

## 3. Configure Bucket Policies (Optional but Recommended)

By default, the service role key can upload files. For additional security, you can set up Row Level Security (RLS) policies:

1. In the Storage section, click on the `closet-quotes` bucket
2. Go to **Policies**
3. Add the following policies:

### Upload Policy (Authenticated users only)

```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'closet-quotes');
```

### Public Read Policy

```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'closet-quotes');
```

### Delete Policy (Admin only - optional)

```sql
CREATE POLICY "Admin can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'closet-quotes'
  AND auth.jwt() ->> 'role' = 'admin'
);
```

## 4. File Structure

Files will be uploaded to the following path structure:

```
closet-quotes/
  └── closet-jobs/
      └── {jobId}/
          └── quotes/
              └── {quoteId}/
                  └── {timestamp}-{filename}
```

Example: `closet-quotes/closet-jobs/cm8j3kl0x0000abc123/quotes/cm8j3xyz0001def456/1234567890-kitchen-render.jpg`

## 5. Test the Setup

After adding your keys to `.env.local`:

1. Restart your Next.js dev server
2. Go to a closet job and create a new quote
3. Try uploading images using the file upload interface
4. Verify:
   - Files appear in Supabase Storage bucket
   - Database rows are created in `ClosetQuoteFile` table
   - Images display correctly in the quote detail view

## 6. Allowed File Types & Limits

- **Max size**: 10 MB per file
- **Allowed types**: image/jpeg, image/png, image/jpg, image/webp, image/gif
- **Multiple uploads**: Yes, users can upload multiple images per quote

## Implementation Details

### API Endpoints

- **POST** `/api/closet-jobs/[jobId]/quotes/[quoteId]/files` - Upload files for a quote

### Database Schema

```prisma
model ClosetQuoteFile {
  id           String       @id @default(cuid())
  quoteId      String
  quote        ClosetQuote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  fileUrl      String       // Supabase Storage public URL
  caption      String?      // Optional caption for the image
  uploadedAt   DateTime     @default(now())
  uploadedById String
  uploadedBy   User         @relation(fields: [uploadedById], references: [id])
}
```

### Form Changes

- Old: Text inputs for image URLs
- New: File upload with preview grid, drag-and-drop support (future), caption fields

### Two-Step Submission Process

1. Create quote → Get quote ID
2. Upload files using quote ID → Save to storage and database
