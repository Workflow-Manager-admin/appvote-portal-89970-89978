-- Create contest_weeks table to manage contest periods
CREATE TABLE public.contest_weeks (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add contest_week_id column to apps table
ALTER TABLE public.apps
ADD COLUMN contest_week_id INT REFERENCES public.contest_weeks(id);

-- Add contest_week_id column to votes table
ALTER TABLE public.votes
ADD COLUMN contest_week_id INT REFERENCES public.contest_weeks(id);

-- Create contest_winners table to record winners for each week
CREATE TABLE public.contest_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_week_id INT NOT NULL REFERENCES public.contest_weeks(id),
  app_id UUID NOT NULL REFERENCES public.apps(id),
  position INT NOT NULL CHECK (position BETWEEN 1 AND 3),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (contest_week_id, position) -- Ensure one app per position per week
);

-- Create initial contest weeks (4 weeks)
INSERT INTO public.contest_weeks (id, name, description, status)
VALUES
  (1, 'Week 1', 'First week of the app contest', 'upcoming'),
  (2, 'Week 2', 'Second week of the app contest', 'upcoming'),
  (3, 'Week 3', 'Third week of the app contest', 'upcoming'),
  (4, 'Week 4', 'Final week of the app contest', 'upcoming');

-- Row Level Security Policies

-- Enable RLS on contest_weeks
ALTER TABLE public.contest_weeks ENABLE ROW LEVEL SECURITY;

-- Enable RLS on contest_winners
ALTER TABLE public.contest_winners ENABLE ROW LEVEL SECURITY;

-- Contest Weeks Policies
-- Allow all authenticated users to view contest weeks
CREATE POLICY "Authenticated users can view contest weeks" 
  ON public.contest_weeks 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow only admins to insert, update or delete contest weeks
CREATE POLICY "Admins can manage contest weeks" 
  ON public.contest_weeks 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Contest Winners Policies
-- Allow all authenticated users to view contest winners
CREATE POLICY "Authenticated users can view contest winners" 
  ON public.contest_winners 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Allow only admins to insert, update or delete contest winners
CREATE POLICY "Admins can manage contest winners" 
  ON public.contest_winners 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));
