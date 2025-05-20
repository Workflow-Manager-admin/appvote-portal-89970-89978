# Supabase Storage Setup Guide

## Issue: '42501: must be owner of schema storage' Error

If you encounter the error `42501: must be owner of schema storage` when setting up the AppVote Portal, this is because storage buckets in Supabase cannot be created using SQL or the client SDK with anonymous credentials.

## Correct Way to Set Up Storage

Storage buckets must be set up manually through the Supabase dashboard:

1. Log in to your [Supabase dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to the "Storage" section in the left sidebar
4. Click "Create bucket"
5. Name the bucket `app_images`
6. Configure bucket permissions:
   - Enable "Public bucket" option (for image display)
   - Set appropriate RLS (Row Level Security) policies:

### Recommended RLS Policies for app_images bucket

- **For file uploads**:
  ```sql
  (bucket_id = 'app_images' AND auth.role() = 'authenticated')
  ```

- **For file updates**:
  ```sql
  (bucket_id = 'app_images' AND auth.uid() = owner)
  ```

- **For file deletes**:
  ```sql
  (bucket_id = 'app_images' AND auth.uid() = owner)
  ```

- **For file downloads** (public access):
  ```sql
  (bucket_id = 'app_images')
  ```

## Understanding Supabase Permissions

In Supabase:
- The `anon` key (used in the client) has very limited permissions
- SQL commands like `COMMENT ON SCHEMA storage` require schema owner privileges
- Storage bucket creation is an administrative operation that requires proper authorization

## Alternative Methods

If you need to programmatically create buckets (e.g., for CI/CD):

1. Use the Supabase Management API with a service role key
2. Use the Supabase CLI with appropriate credentials
3. Use Terraform with the Supabase provider

For this application, the simplest approach is manual bucket creation through the dashboard as described above.
