import supabase from '../config/supabaseClient';

/**
 * Utility to test Supabase storage bucket configuration and permissions
 */
const testStorage = async () => {
  console.log('--- Testing Supabase Storage Configuration ---');
  
  // Step 1: Check if the bucket exists
  console.log('Step 1: Checking if app_images bucket exists...');
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error checking storage buckets:', listError.message);
      return;
    }
    
    const appImagesBucket = buckets?.find(bucket => bucket.name === 'app_images');
    
    if (!appImagesBucket) {
      console.error('❌ The "app_images" bucket does not exist!');
      console.log('Please create it manually in the Supabase dashboard');
      return;
    } else {
      console.log('✅ Bucket "app_images" found');
      console.log('Bucket details:', appImagesBucket);
    }
    
    // Step 2: Check public access and files
    console.log('\nStep 2: Testing bucket access and listing files...');
    const { data: files, error: filesError } = await supabase.storage
      .from('app_images')
      .list();
      
    if (filesError) {
      console.error('❌ Error listing files:', filesError.message);
      return;
    }
    
    console.log('✅ Successfully listed files in bucket. Found:', files?.length || 0, 'files');
    if (files && files.length > 0) {
      console.log('First few files:', files.slice(0, 3));
      
      // Step 3: Test getting public URL for a file
      const testFile = files[0];
      console.log('\nStep 3: Testing public URL generation for file:', testFile.name);
      
      const { data: publicUrlData } = supabase.storage
        .from('app_images')
        .getPublicUrl(testFile.name);
      
      if (publicUrlData) {
        console.log('✅ Public URL generated:', publicUrlData.publicUrl);
        
        // Step 4: Test URL access
        console.log('\nStep 4: Testing direct access to the URL...');
        console.log('Please manually check if this URL is accessible in a browser:');
        console.log(publicUrlData.publicUrl);
        
        // Check the format of the URL
        const urlPattern = new RegExp(`^https://.*\\.supabase\\.co/storage/v1/object/public/app_images/.*$`);
        if (urlPattern.test(publicUrlData.publicUrl)) {
          console.log('✅ URL format appears correct');
        } else {
          console.warn('⚠️ URL format may not be standard Supabase public URL');
        }
      } else {
        console.error('❌ Failed to generate public URL');
      }
    } else {
      console.log('No files found in bucket to test URL generation');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error.message);
  }
  
  console.log('\n--- Storage Test Complete ---');
};

// Export the testing function
export default testStorage;
