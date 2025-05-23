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
    } else {
      console.log('Contest schema exists, checking for initial data');
      
      // Check if any weeks exist
      if (!data || data.length === 0) {
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
        console.log('Contest weeks already exist');
      }
      
      return true;
    }
  } catch (error) {
    console.error('Error setting up contest schema:', error.message);
    toast.error('Failed to set up contest feature. Some functionality may be limited.');
    return false;
  }
};

export default applyContestSchema;
