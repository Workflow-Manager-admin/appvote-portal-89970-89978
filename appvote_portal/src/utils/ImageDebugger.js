import { useState, useEffect } from 'react';
import supabase from '../config/supabaseClient';

/**
 * A component to help debug image loading issues
 * This can be temporarily added to any page to provide 
 * detailed information about image loading
 */
const ImageDebugger = () => {
  const [debugInfo, setDebugInfo] = useState({
    bucketExists: false,
    bucketInfo: null,
    testImageUploaded: false,
    testImageUrl: null,
    publicUrlWorks: null,
    corsIssue: null,
    networkErrors: [],
    loading: true,
    error: null,
  });
  
  useEffect(() => {
    const runTests = async () => {
      try {
        // Check if bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
          throw new Error(`Bucket list error: ${listError.message}`);
        }
        
        const bucket = buckets?.find(b => b.name === 'app_images');
        
        setDebugInfo(prev => ({
          ...prev,
          bucketExists: !!bucket,
          bucketInfo: bucket || null
        }));
        
        // If bucket exists, try to upload a test image
        if (bucket) {
          // Create a small test image (1x1 pixel transparent PNG as base64)
          const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
          
          const fileName = `debug-test-${Date.now()}.png`;
          const filePath = `debug/${fileName}`;
          
          // Try to upload
          const { error: uploadError } = await supabase.storage
            .from('app_images')
            .upload(filePath, imageData, {
              contentType: 'image/png',
              upsert: true
            });
            
          if (uploadError) {
            setDebugInfo(prev => ({
              ...prev,
              testImageUploaded: false,
              error: `Upload error: ${uploadError.message}`
            }));
          } else {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('app_images')
              .getPublicUrl(filePath);
              
            const publicUrl = publicUrlData?.publicUrl;
            
            setDebugInfo(prev => ({
              ...prev,
              testImageUploaded: true,
              testImageUrl: publicUrl
            }));
            
            // Test if URL is accessible via fetch
            if (publicUrl) {
              try {
                const response = await fetch(publicUrl, { method: 'HEAD' });
                setDebugInfo(prev => ({
                  ...prev,
                  publicUrlWorks: response.ok,
                  corsIssue: response.ok ? false : 'Possible CORS issue'
                }));
              } catch (fetchError) {
                setDebugInfo(prev => ({
                  ...prev,
                  publicUrlWorks: false,
                  corsIssue: `Fetch error: ${fetchError.message}`,
                  networkErrors: [...prev.networkErrors, fetchError.message]
                }));
              }
            }
          }
        }
      } catch (error) {
        setDebugInfo(prev => ({
          ...prev,
          error: error.message
        }));
      } finally {
        setDebugInfo(prev => ({
          ...prev,
          loading: false
        }));
      }
    };
    
    runTests();
    
    // Monitor network errors
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch(...args);
        
        // Check if this is an image request and log errors
        const url = args[0].toString();
        if (url.includes('app_images') && !response.ok) {
          setDebugInfo(prev => ({
            ...prev,
            networkErrors: [...prev.networkErrors, `Fetch error for ${url}: ${response.status} ${response.statusText}`]
          }));
        }
        
        return response;
      } catch (error) {
        setDebugInfo(prev => ({
          ...prev,
          networkErrors: [...prev.networkErrors, `Fetch error: ${error.message}`]
        }));
        throw error;
      }
    };
    
    return () => {
      // Restore original fetch
      window.fetch = originalFetch;
    };
  }, []);
  
  return (
    <div style={{ 
      padding: '20px', 
      margin: '20px auto', 
      maxWidth: '800px', 
      background: '#2a2a2a', 
      borderRadius: '8px',
      color: '#fff' 
    }}>
      <h2>Image Debug Information</h2>
      
      {debugInfo.loading ? (
        <p>Running image diagnostics...</p>
      ) : (
        <div>
          <h3>Storage Bucket Status</h3>
          <ul>
            <li>Bucket exists: <strong>{debugInfo.bucketExists ? '✅ Yes' : '❌ No'}</strong></li>
            {debugInfo.bucketInfo && (
              <li>
                Bucket details: 
                <pre>{JSON.stringify(debugInfo.bucketInfo, null, 2)}</pre>
              </li>
            )}
          </ul>
          
          <h3>Test Image Upload</h3>
          <ul>
            <li>Image uploaded: <strong>{debugInfo.testImageUploaded ? '✅ Yes' : '❌ No'}</strong></li>
            {debugInfo.testImageUrl && (
              <>
                <li>Image URL: <code>{debugInfo.testImageUrl}</code></li>
                <li>URL accessible: <strong>{
                  debugInfo.publicUrlWorks === null ? 'Testing...' :
                  debugInfo.publicUrlWorks ? '✅ Yes' : '❌ No'
                }</strong></li>
                {debugInfo.corsIssue && (
                  <li>CORS issue: {debugInfo.corsIssue}</li>
                )}
                <li>Test image: <img 
                  src={debugInfo.testImageUrl} 
                  alt="Test pixel"
                  onError={() => {
                    setDebugInfo(prev => ({
                      ...prev,
                      networkErrors: [...prev.networkErrors, 'Image tag failed to load test image']
                    }));
                  }}
                  style={{ border: '1px solid #ccc' }}
                /></li>
              </>
            )}
          </ul>
          
          {debugInfo.networkErrors.length > 0 && (
            <>
              <h3>Network Errors</h3>
              <ul>
                {debugInfo.networkErrors.map((error, i) => (
                  <li key={i}><code>{error}</code></li>
                ))}
              </ul>
            </>
          )}
          
          {debugInfo.error && (
            <div style={{ color: '#ff4d4d', marginTop: '20px' }}>
              <h3>Error</h3>
              <p>{debugInfo.error}</p>
            </div>
          )}
          
          <h3>Recommendations</h3>
          <ul>
            {!debugInfo.bucketExists && (
              <li>Create the "app_images" bucket in Supabase dashboard</li>
            )}
            {debugInfo.bucketExists && !debugInfo.testImageUploaded && (
              <li>Check if the bucket has proper write permissions for authenticated users</li>
            )}
            {debugInfo.testImageUploaded && !debugInfo.publicUrlWorks && (
              <li>Enable public access policy for the bucket in Supabase dashboard</li>
            )}
            {debugInfo.corsIssue && (
              <li>Check CORS configuration in Supabase storage settings</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageDebugger;
