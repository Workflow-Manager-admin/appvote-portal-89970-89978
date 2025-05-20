-- Create profiles table to store user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  registration_number TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create apps table to store app submissions
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key relationship between apps.user_id and profiles.id
-- This ensures proper relationship for REST queries and data integrity
ALTER TABLE public.apps
  ADD CONSTRAINT fk_apps_profiles
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Create votes table to track votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, app_id) -- Ensure one vote per app per user
);

-- Row Level Security Policies
-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on apps
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- Enable RLS on votes
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Allow users to see their own profile
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Additional policy to allow newly signed-up users to create their profiles
CREATE POLICY "Allow users to create their own profile during registration" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (true);

-- Allow authenticated users to view basic profile information
CREATE POLICY "Authenticated users can view basic profile info" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Apps Policies
-- Allow all authenticated users to view apps
CREATE POLICY "Authenticated users can view all apps" 
  ON public.apps 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow users to insert their own apps
CREATE POLICY "Users can insert their own apps" 
  ON public.apps 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
  
-- Allow users to access apps related to their profile
CREATE POLICY "Users can access apps linked to their profile" 
  ON public.apps 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = apps.user_id 
    AND profiles.id = auth.uid()
  ));

-- Allow users to update their own apps
CREATE POLICY "Users can update their own apps" 
  ON public.apps 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Allow users to delete their own apps
CREATE POLICY "Users can delete their own apps" 
  ON public.apps 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Votes Policies
-- Allow all authenticated users to view votes
CREATE POLICY "Authenticated users can view all votes" 
  ON public.votes 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow users to insert their own votes
CREATE POLICY "Users can insert their own votes" 
  ON public.votes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own votes
CREATE POLICY "Users can delete their own votes" 
  ON public.votes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create Bucket for App Images
-- Note: This would typically be done via Supabase UI or API, not SQL
-- Creating a function to set up the bucket
CREATE OR REPLACE FUNCTION create_app_images_bucket()
RETURNS void AS $$
BEGIN
  -- This is a placeholder function
  -- In practice, you would create the bucket via the Supabase UI or API
  RAISE NOTICE 'Please create a bucket named "app_images" via Supabase UI or API';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_app_images_bucket();

-- Storage bucket permissions
-- Note: These would typically be configured via the Supabase UI
-- This SQL file doesn't create storage buckets - that needs to be done via UI or API

/*
Storage Bucket Setup Instructions:

1. Go to the Supabase Dashboard
2. Navigate to Storage
3. Create a new bucket named "app_images"
4. Configure the following permissions:
   - Allow public access: Yes (for image display)
   - Auth users can upload: Yes
   - Auth users can update their own files: Yes
   - Auth users can delete their own files: Yes
*/
