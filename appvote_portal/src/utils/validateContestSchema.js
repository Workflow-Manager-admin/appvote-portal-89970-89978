import supabase from '../config/supabaseClient';

/**
 * Comprehensive validation and troubleshooting of the contest schema
 * This utility checks for the presence of tables, columns, and data required by the contest feature
 */
const validateContestSchema = async () => {
  const results = {
    tables: {},
    columns: {},
    data: {},
    issues: [],
    success: true
  };
  
  console.log('Validating contest schema structure...');
  
  try {
    // Check if contest_weeks table exists
    console.log('Checking contest_weeks table...');
    try {
      const { data: contestWeeks, error: weeksError } = await supabase
        .from('contest_weeks')
        .select('id, name, status')
        .limit(1);
        
      if (weeksError) {
        if (weeksError.code === '42P01') {
          console.error('Table contest_weeks does not exist');
          results.tables.contest_weeks = false;
          results.issues.push('Table contest_weeks does not exist');
          results.success = false;
        } else {
          console.error('Error checking contest_weeks table:', weeksError);
          results.tables.contest_weeks = false;
          results.issues.push(`Error checking contest_weeks: ${weeksError.message}`);
          results.success = false;
        }
      } else {
        results.tables.contest_weeks = true;
        results.data.contest_weeks = contestWeeks.length;
      }
    } catch (error) {
      console.error('Exception checking contest_weeks table:', error);
      results.tables.contest_weeks = false;
      results.issues.push(`Exception checking contest_weeks: ${error.message}`);
      results.success = false;
    }
    
    // Check if contest_winners table exists
    console.log('Checking contest_winners table...');
    try {
      const { data: contestWinners, error: winnersError } = await supabase
        .from('contest_winners')
        .select('id')
        .limit(1);
        
      if (winnersError) {
        if (winnersError.code === '42P01') {
          console.error('Table contest_winners does not exist');
          results.tables.contest_winners = false;
          results.issues.push('Table contest_winners does not exist');
          results.success = false;
        } else {
          console.error('Error checking contest_winners table:', winnersError);
          results.tables.contest_winners = false;
          results.issues.push(`Error checking contest_winners: ${winnersError.message}`);
          results.success = false;
        }
      } else {
        results.tables.contest_winners = true;
        results.data.contest_winners = contestWinners.length;
      }
    } catch (error) {
      console.error('Exception checking contest_winners table:', error);
      results.tables.contest_winners = false;
      results.issues.push(`Exception checking contest_winners: ${error.message}`);
      results.success = false;
    }
    
    // Check if apps table has contest_week_id column
    console.log('Checking apps.contest_week_id column...');
    try {
      const { data: apps, error: appsError } = await supabase
        .from('apps')
        .select('contest_week_id')
        .limit(1);
        
      if (appsError) {
        if (appsError.code === '42703') {
          console.error('Column contest_week_id does not exist in apps table');
          results.columns.apps_contest_week_id = false;
          results.issues.push('Column contest_week_id does not exist in apps table');
          results.success = false;
        } else {
          console.error('Error checking apps.contest_week_id column:', appsError);
          results.columns.apps_contest_week_id = false;
          results.issues.push(`Error checking apps.contest_week_id: ${appsError.message}`);
          results.success = false;
        }
      } else {
        results.columns.apps_contest_week_id = true;
      }
    } catch (error) {
      console.error('Exception checking apps.contest_week_id column:', error);
      results.columns.apps_contest_week_id = false;
      results.issues.push(`Exception checking apps.contest_week_id: ${error.message}`);
      results.success = false;
    }
    
    // Check if votes table has contest_week_id column
    console.log('Checking votes.contest_week_id column...');
    try {
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('contest_week_id')
        .limit(1);
        
      if (votesError) {
        if (votesError.code === '42703') {
          console.error('Column contest_week_id does not exist in votes table');
          results.columns.votes_contest_week_id = false;
          results.issues.push('Column contest_week_id does not exist in votes table');
          results.success = false;
        } else {
          console.error('Error checking votes.contest_week_id column:', votesError);
          results.columns.votes_contest_week_id = false;
          results.issues.push(`Error checking votes.contest_week_id: ${votesError.message}`);
          results.success = false;
        }
      } else {
        results.columns.votes_contest_week_id = true;
      }
    } catch (error) {
      console.error('Exception checking votes.contest_week_id column:', error);
      results.columns.votes_contest_week_id = false;
      results.issues.push(`Exception checking votes.contest_week_id: ${error.message}`);
      results.success = false;
    }
  } catch (error) {
    console.error('Error in schema validation:', error);
    results.success = false;
    results.issues.push(`General validation error: ${error.message}`);
  }
  
  return results;
};

/**
 * Attempts to fix detected schema issues by executing appropriate SQL commands
 */
const fixContestSchemaIssues = async (validationResults) => {
  const results = {
    operations: [],
    success: true
  };
  
  // Only proceed if we have validation results
  if (!validationResults) {
    console.error('No validation results provided');
    return { success: false, operations: ['No validation results provided'] };
  }
  
  try {
    // Create contest_weeks table if missing
    if (validationResults.tables.contest_weeks === false) {
      console.log('Creating missing contest_weeks table...');
      try {
        const { error } = await supabase.rpc('execute_sql', {
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
        
        if (error) {
          console.error('Failed to create contest_weeks table:', error);
          results.operations.push(`Failed to create contest_weeks table: ${error.message}`);
          results.success = false;
        } else {
          results.operations.push('Created contest_weeks table');
        }
      } catch (error) {
        console.error('Exception creating contest_weeks table:', error);
        results.operations.push(`Exception creating contest_weeks table: ${error.message}`);
        results.success = false;
      }
    }
    
    // Create contest_winners table if missing
    if (validationResults.tables.contest_winners === false) {
      console.log('Creating missing contest_winners table...');
      try {
        const { error } = await supabase.rpc('execute_sql', {
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
        
        if (error) {
          console.error('Failed to create contest_winners table:', error);
          results.operations.push(`Failed to create contest_winners table: ${error.message}`);
          results.success = false;
        } else {
          results.operations.push('Created contest_winners table');
        }
      } catch (error) {
        console.error('Exception creating contest_winners table:', error);
        results.operations.push(`Exception creating contest_winners table: ${error.message}`);
        results.success = false;
      }
    }
    
    // Add contest_week_id column to apps table if missing
    if (validationResults.columns.apps_contest_week_id === false) {
      console.log('Adding contest_week_id column to apps table...');
      try {
        const { error } = await supabase.rpc('execute_sql', {
          query: `
            ALTER TABLE public.apps
            ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
          `
        });
        
        if (error) {
          console.error('Failed to add contest_week_id to apps table:', error);
          results.operations.push(`Failed to add contest_week_id to apps table: ${error.message}`);
          results.success = false;
        } else {
          results.operations.push('Added contest_week_id column to apps table');
        }
      } catch (error) {
        console.error('Exception adding contest_week_id to apps table:', error);
        results.operations.push(`Exception adding contest_week_id to apps table: ${error.message}`);
        results.success = false;
      }
    }
    
    // Add contest_week_id column to votes table if missing
    if (validationResults.columns.votes_contest_week_id === false) {
      console.log('Adding contest_week_id column to votes table...');
      try {
        const { error } = await supabase.rpc('execute_sql', {
          query: `
            ALTER TABLE public.votes
            ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
          `
        });
        
        if (error) {
          console.error('Failed to add contest_week_id to votes table:', error);
          results.operations.push(`Failed to add contest_week_id to votes table: ${error.message}`);
          results.success = false;
        } else {
          results.operations.push('Added contest_week_id column to votes table');
        }
      } catch (error) {
        console.error('Exception adding contest_week_id to votes table:', error);
        results.operations.push(`Exception adding contest_week_id to votes table: ${error.message}`);
        results.success = false;
      }
    }
    
    // If contest_weeks table exists but has no data, add initial weeks
    if (validationResults.tables.contest_weeks === true && 
        validationResults.data.contest_weeks === 0) {
      console.log('Adding initial contest weeks...');
      try {
        const { error } = await supabase
          .from('contest_weeks')
          .insert([
            { id: 1, name: 'Week 1', description: 'First week of the app contest', status: 'upcoming' },
            { id: 2, name: 'Week 2', description: 'Second week of the app contest', status: 'upcoming' },
            { id: 3, name: 'Week 3', description: 'Third week of the app contest', status: 'upcoming' },
            { id: 4, name: 'Week 4', description: 'Final week of the app contest', status: 'upcoming' }
          ]);
          
        if (error) {
          console.error('Failed to insert initial contest weeks:', error);
          results.operations.push(`Failed to insert initial contest weeks: ${error.message}`);
          results.success = false;
        } else {
          results.operations.push('Added 4 initial contest weeks');
        }
      } catch (error) {
        console.error('Exception adding initial contest weeks:', error);
        results.operations.push(`Exception adding initial contest weeks: ${error.message}`);
        results.success = false;
      }
    }
    
    // Set up RLS policies if we created new tables
    if (validationResults.tables.contest_weeks === false || 
        validationResults.tables.contest_winners === false) {
      console.log('Setting up RLS policies...');
      try {
        // Enable RLS on contest_weeks
        await supabase.rpc('execute_sql', {
          query: 'ALTER TABLE public.contest_weeks ENABLE ROW LEVEL SECURITY;'
        });
        
        // Enable RLS on contest_winners
        await supabase.rpc('execute_sql', {
          query: 'ALTER TABLE public.contest_winners ENABLE ROW LEVEL SECURITY;'
        });
        
        // Add policies for contest_weeks
        await supabase.rpc('execute_sql', {
          query: `
            CREATE POLICY IF NOT EXISTS "Authenticated users can view contest weeks" 
            ON public.contest_weeks 
            FOR SELECT 
            USING (auth.role() = 'authenticated');
            
            CREATE POLICY IF NOT EXISTS "Admins can manage contest weeks" 
            ON public.contest_weeks 
            FOR ALL 
            USING (EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() 
              AND profiles.role = 'admin'
            ));
          `
        });
        
        // Add policies for contest_winners
        await supabase.rpc('execute_sql', {
          query: `
            CREATE POLICY IF NOT EXISTS "Authenticated users can view contest winners" 
            ON public.contest_winners 
            FOR SELECT 
            USING (auth.role() = 'authenticated');
            
            CREATE POLICY IF NOT EXISTS "Admins can manage contest winners" 
            ON public.contest_winners 
            FOR ALL 
            USING (EXISTS (
              SELECT 1 FROM profiles 
              WHERE profiles.id = auth.uid() 
              AND profiles.role = 'admin'
            ));
          `
        });
        
        results.operations.push('Set up RLS policies for contest tables');
      } catch (error) {
        console.error('Error setting up RLS policies:', error);
        results.operations.push(`Error setting up RLS policies: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error fixing schema issues:', error);
    results.success = false;
    results.operations.push(`General error during fix: ${error.message}`);
  }
  
  return results;
};

export { validateContestSchema, fixContestSchemaIssues };
