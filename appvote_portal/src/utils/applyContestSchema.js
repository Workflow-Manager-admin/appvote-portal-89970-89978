import supabase from '../config/supabaseClient';
import { toast } from 'react-toastify';

/**
 * Utility function to apply the necessary database schema changes for the contest feature
 * This handles schema creation in case it doesn't exist yet
 */
const applyContestSchema = async () => {
  console.log('Checking contest schema...');
  
  try {
    // First, check if the contest_weeks table exists
    console.log('Checking if contest_weeks table exists...');
    const { data: tablesData, error: tablesError } = await supabase
      .rpc('get_tables');
      
    if (tablesError) {
      // If RPC fails, fallback to direct query
      console.log('RPC failed, falling back to direct query...');
      const { data, error: checkError } = await supabase
        .from('contest_weeks')
        .select('id')
        .limit(1);
      
      if (checkError && checkError.code === '42P01') {
        console.log('Contest tables do not exist yet. Schema changes need to be applied manually in the Supabase SQL editor.');
        console.log('Please run the SQL commands from contest_schema.sql in your Supabase project.');
        
        toast.info(
          'Contest feature requires database setup. Please contact admin to apply schema changes.',
          { autoClose: 10000 }
        );
        return false;
      } else if (checkError) {
        console.error('Error checking contest schema:', checkError);
        return false;
      }
    }
    
    // Verify that apps table has the contest_week_id column
    console.log('Verifying apps table schema...');
    try {
      const { data: columnCheck, error: columnError } = await supabase
        .from('apps')
        .select('contest_week_id')
        .limit(1);
        
      // If we get a "column does not exist" error
      if (columnError && (columnError.code === '42703' || columnError.message.includes('does not exist'))) {
        console.error('The contest_week_id column is missing in the apps table:', columnError.message);
        toast.error('Database schema is incomplete. Please contact admin to complete setup.');
        return false;
      }
    } catch (columnCheckError) {
      console.log('Error checking column schema:', columnCheckError);
    }
    
    // Check if any weeks exist in the contest_weeks table
    console.log('Checking for existing contest weeks...');
    const { data: weeksData, error: weeksError } = await supabase
      .from('contest_weeks')
      .select('id')
      .limit(1);
      
    if (!weeksError) {
      console.log('Contest schema exists, checking for initial data');
      
      // Check if any weeks exist
      if (!weeksData || weeksData.length === 0) {
        console.log('No contest weeks found - will insert initial weeks');
        // Insert initial weeks if table exists but is empty
        const { error: insertError } = await supabase
          .from('contest_weeks')
          .insert([
            { id: 1, name: 'Week 1', description: 'First week of the app contest', status: 'upcoming' },
            { id: 2, name: 'Week 2', description: 'Second week of the app contest', status: 'upcoming' },
            { id: 3, name: 'Week 3', description: 'Third week of the app contest', status: 'upcoming' },
            { id: 4, name: 'Week 4', description: 'Final week of the app contest', status: 'upcoming' }
          ]);
          
        if (insertError) {
          console.error('Error inserting initial weeks:', insertError);
        } else {
          console.log('Successfully inserted initial contest weeks');
        }
      } else {
        console.log('Contest weeks already exist:', weeksData.length, 'found');
      }
      
      return true;
    } else {
      console.error('Error checking for contest weeks:', weeksError);
      return false;
    }
  } catch (error) {
    console.error('Error setting up contest schema:', error.message);
    toast.error('Failed to set up contest feature. Some functionality may be limited.');
    return false;
  }
};

export default applyContestSchema;
