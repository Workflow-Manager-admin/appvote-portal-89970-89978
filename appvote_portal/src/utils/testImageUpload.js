import supabase from '../config/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test image upload to Supabase storage and verify URL access
 * 
 * This function will:
 * 1. Create a small base64 test image
 * 2. Upload it to Supabase
 * 3. Get the public URL
 * 4. Test access to the URL
 */
const testImageUpload = async () => {
  console.log('--- Testing Image Upload and URL Access ---');
  
  try {
    // Create a small test image (1x1 pixel transparent PNG as base64)
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    
    // Create a unique file name
    const fileName = `test-${uuidv4()}.png`;
    const filePath = `test/${fileName}`;
    
    console.log('Step 1: Uploading test image...');
    
    // Upload the image
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('app_images')
      .upload(filePath, imageData, {
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) {
      console.error('❌ Upload error:', uploadError.message);
      return;
    }
    
    console.log('✅ Image uploaded successfully:', uploadData);
    
    // Get public URL
    console.log('\nStep 2: Getting public URL...');
    const { data: publicUrlData } = supabase.storage
      .from('app_images')
      .getPublicUrl(filePath);
      
    if (!publicUrlData?.publicUrl) {
      console.error('❌ Failed to get public URL');
      return;
    }
    
    console.log('✅ Public URL:', publicUrlData.publicUrl);
    
    // Test if URL is accessible
    console.log('\nStep 3: Testing URL access (browser test required)');
    console.log('Please manually check if this URL is accessible in a browser:');
    console.log(publicUrlData.publicUrl);
    
    // Analyze the URL format
    const url = new URL(publicUrlData.publicUrl);
    console.log('\nURL analysis:');
    console.log('- Protocol:', url.protocol);
    console.log('- Hostname:', url.hostname);
    console.log('- Pathname:', url.pathname);
    console.log('- Contains "public" in path:', url.pathname.includes('public'));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  console.log('\n--- Image Upload Test Complete ---');
};

// Export the testing function
export default testImageUpload;
