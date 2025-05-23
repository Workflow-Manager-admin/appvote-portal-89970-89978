import { createClient } from '@supabase/supabase-js';

// Get environment variables for Supabase connection
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate environment variables for Supabase connection
const validateSupabaseEnv = () => {
  const missing = [];
  if (!supabaseUrl) missing.push('REACT_APP_SUPABASE_URL');
  if (!supabaseKey) missing.push('REACT_APP_SUPABASE_ANON_KEY');
  
  if (missing.length > 0) {
    console.error('🚨 ERROR: Missing Supabase environment variables:');
    missing.forEach(variable => console.error(`   - ${variable} is not defined`));
    console.error('\nPlease check your .env file and ensure these variables are correctly set.');
    console.error('Environment Variables Reference:');
    console.error('  REACT_APP_SUPABASE_URL=your_project_url');
    console.error('  REACT_APP_SUPABASE_ANON_KEY=your_anon_key');
    
    // Only log a truncated version of values if they exist (for debugging)
    if (supabaseUrl) console.log(`REACT_APP_SUPABASE_URL starts with: ${supabaseUrl.substring(0, 10)}...`);
    if (supabaseKey) console.log(`REACT_APP_SUPABASE_ANON_KEY exists but may be incorrect`);
    
    return false;
  }
  return true;
};

// Validate environment variables and log connection info
const isValid = validateSupabaseEnv();
if (isValid) {
  console.log(`Connecting to Supabase project: ${supabaseUrl}`);
}

// Initialize the Supabase client with strict environment variables (no fallbacks)
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks if the required storage bucket exists
 * Note: Storage buckets should be created in Supabase dashboard - not via client SDK
 * 
 * The anon key doesn't have permission to create buckets (42501: must be owner of schema storage)
 * This function now only checks if the bucket exists and logs guidance if it doesn't
 */
export const initializeStorage = async () => {
  try {
    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error checking storage buckets:', listError.message);
      return;
    }
    
    const appImagesBucket = buckets?.find(bucket => bucket.name === 'app_images');
    
    if (!appImagesBucket) {
      console.warn(
        'The "app_images" storage bucket does not exist. Please create it manually in the Supabase dashboard:\n' +
        '1. Go to Storage in your Supabase dashboard\n' +
        '2. Click "Create bucket" and name it "app_images"\n' +
        '3. Enable public access and set appropriate permissions'
      );
      return false;
    } else {
      console.log('Storage bucket "app_images" found');
      
      // Check if bucket is public
      if (!appImagesBucket.public) {
        console.warn(
          'WARNING: The "app_images" bucket may not be configured as public.\n' +
          'This can cause image loading failures. Please check the bucket settings in Supabase dashboard.\n' +
          'Make sure to enable "Public bucket" option in the bucket settings.'
        );
      }
      
      // Try to verify storage access by listing files
      try {
        const { data: files, error: filesError } = await supabase.storage
          .from('app_images')
          .list();
          
        if (filesError) {
          console.error('Error accessing bucket files:', filesError.message);
          return false;
        }
        
        console.log(`Successfully accessed app_images bucket. Contains ${files?.length || 0} files.`);
        return true;
      } catch (accessError) {
        console.error('Error testing bucket access:', accessError.message);
        return false;
      }
    }
  } catch (error) {
    console.error('Error checking storage buckets:', error.message);
    return false;
  }
};

// Helper function to get a public URL and append cache-busting parameter
export const getImageUrl = (bucket, path) => {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    
    if (data && data.publicUrl) {
      // Add a cache buster if needed
      const url = new URL(data.publicUrl);
      // Only add cache buster if not already present
      if (!url.searchParams.has('_cb')) {
        url.searchParams.append('_cb', new Date().getTime());
      }
      return url.toString();
    }
    
    return null;
  } catch (error) {
    console.error('Error generating public URL:', error);
    return null;
  }
};

export default supabase;
