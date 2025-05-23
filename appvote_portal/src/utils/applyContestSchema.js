import supabase from '../config/supabaseClient';
import { toast } from 'react-toastify';

/**
 * Utility function to apply the necessary database schema changes for the contest feature
 * This handles schema creation in case it doesn't exist yet
 */
const applyContestSchema = async () => {
  console.log('Checking contest schema...');
  
  try {
    // Check if contest_weeks table exists
    const { count, error: checkError } = await supabase
      .from('contest_weeks')
      .select('*', { count: 'exact', head: true });
    
    if (checkError && checkError.code === '42P01') {
      console.log('Contest tables do not exist yet, need to create schema');
      
      // Apply schema in order
      
      // 1. Create contest_weeks table
      const { error: weeksError } = await supabase.rpc(
        'execute_sql',
        {
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
        }
      );
      
      if (weeksError) {
        throw new Error(`Failed to create contest_weeks table: ${weeksError.message}`);
      }
      
      // 2. Add contest_week_id column to apps table
      const { error: appsError } = await supabase.rpc(
        'execute_sql',
        {
          query: `
            ALTER TABLE public.apps
            ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
          `
        }
      );
      
      if (appsError) {
        throw new Error(`Failed to add contest_week_id to apps: ${appsError.message}`);
      }
      
      // 3. Add contest_week_id column to votes table
      const { error: votesError } = await supabase.rpc(
        'execute_sql',
        {
          query: `
            ALTER TABLE public.votes
            ADD COLUMN IF NOT EXISTS contest_week_id INT REFERENCES public.contest_weeks(id);
          `
        }
      );
      
      if (votesError) {
        throw new Error(`Failed to add contest_week_id to votes: ${votesError.message}`);
      }
      
      // 4. Create contest_winners table
      const { error: winnersError } = await supabase.rpc(
        'execute_sql',
        {
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
        }
      );
      
      if (winnersError) {
        throw new Error(`Failed to create contest_winners table: ${winnersError.message}`);
      }
      
      // 5. Insert initial contest weeks
      const { error: insertError } = await supabase
        .from('contest_weeks')
        .insert([
          { id: 1, name: 'Week 1', description: 'First week of the app contest', status: 'upcoming' },
          { id: 2, name: 'Week 2', description: 'Second week of the app contest', status: 'upcoming' },
          { id: 3, name: 'Week 3', description: 'Third week of the app contest', status: 'upcoming' },
          { id: 4, name: 'Week 4', description: 'Final week of the app contest', status: 'upcoming' }
        ]);
      
      if (insertError) {
        // If the error is about unique constraint, the weeks may already exist
        if (insertError.code !== '23505') {
          throw new Error(`Failed to insert contest weeks: ${insertError.message}`);
        }
      }
      
      console.log('Successfully created contest schema');
      return true;
    } else if (checkError) {
      console.error('Error checking contest schema:', checkError);
      return false;
    } else {
      console.log('Contest schema already exists');
      return true;
    }
  } catch (error) {
    console.error('Error setting up contest schema:', error.message);
    toast.error('Failed to set up contest feature. Some functionality may be limited.');
    return false;
  }
};

export default applyContestSchema;
