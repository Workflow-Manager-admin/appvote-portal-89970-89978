import supabase from '../config/supabaseClient';

/**
 * Executes the SQL commands to set up the contest schema
 * This is an admin utility function and would typically be called manually
 */
const executeContestSchema = async () => {
  console.log('Attempting to execute contest schema setup...');

  // Wrap each operation in try-catch so we can continue even if some fail
  // (e.g., if tables/columns already exist)
  
  try {
    console.log('Creating contest_weeks table...');
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.contest_weeks (
          id INT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          start_date TIMESTAMP WITH TIME ZONE,
          end_date TIMESTAMP WITH TIME ZONE,
          status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'completed')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
  } catch (error) {
    console.error('Error creating contest_weeks table:', error);
  }

  try {
    console.log('Adding contest_week_id to apps table...');
    await supabase.rpc('execute_sql', {
      query: `
        ALTER TABLE public.apps
        ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
      `
    });
  } catch (error) {
    console.error('Error adding contest_week_id to apps table:', error);
  }

  try {
    console.log('Adding contest_week_id to votes table...');
    await supabase.rpc('execute_sql', {
      query: `
        ALTER TABLE public.votes
        ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
      `
    });
  } catch (error) {
    console.error('Error adding contest_week_id to votes table:', error);
  }

  try {
    console.log('Creating contest_winners table...');
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.contest_winners (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          contest_week_id INT NOT NULL REFERENCES public.contest_weeks(id),
          app_id UUID NOT NULL REFERENCES public.apps(id),
          position INT NOT NULL CHECK (position BETWEEN 1 AND 3),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE (contest_week_id, position)
        );
      `
    });
  } catch (error) {
    console.error('Error creating contest_winners table:', error);
  }

  try {
    console.log('Setting up RLS policies...');
    
    // Enable RLS on contest_weeks
    await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE public.contest_weeks ENABLE ROW LEVEL SECURITY;'
    });

    // Enable RLS on contest_winners
    await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE public.contest_winners ENABLE ROW LEVEL SECURITY;'
    });

    // Policy for viewing contest weeks
    await supabase.rpc('execute_sql', {
      query: `
        CREATE POLICY "Authenticated users can view contest weeks" 
        ON public.contest_weeks 
        FOR SELECT 
        USING (auth.role() = 'authenticated');
      `
    });

    // Policy for admin management of contest weeks
    await supabase.rpc('execute_sql', {
      query: `
        CREATE POLICY "Admins can manage contest weeks" 
        ON public.contest_weeks 
        FOR ALL 
        USING (EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        ));
      `
    });

    // Policy for viewing contest winners
    await supabase.rpc('execute_sql', {
      query: `
        CREATE POLICY "Authenticated users can view contest winners" 
        ON public.contest_winners 
        FOR SELECT 
        USING (auth.role() = 'authenticated');
      `
    });

    // Policy for admin management of contest winners
    await supabase.rpc('execute_sql', {
      query: `
        CREATE POLICY "Admins can manage contest winners" 
        ON public.contest_winners 
        FOR ALL 
        USING (EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        ));
      `
    });
  } catch (error) {
    console.error('Error setting up RLS policies:', error);
  }

  try {
    console.log('Adding initial contest weeks...');
    const { data: existingWeeks } = await supabase
      .from('contest_weeks')
      .select('id');

    if (!existingWeeks || existingWeeks.length === 0) {
      await supabase
        .from('contest_weeks')
        .insert([
          { id: 1, name: 'Week 1', description: 'First week of the app contest', status: 'upcoming' },
          { id: 2, name: 'Week 2', description: 'Second week of the app contest', status: 'upcoming' },
          { id: 3, name: 'Week 3', description: 'Third week of the app contest', status: 'upcoming' },
          { id: 4, name: 'Week 4', description: 'Final week of the app contest', status: 'upcoming' }
        ]);
    }
  } catch (error) {
    console.error('Error adding initial contest weeks:', error);
  }

  console.log('Contest schema setup complete!');
};

export default executeContestSchema;
