import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../config/supabaseClient';
import ImageDebugger from '../utils/ImageDebugger';

/**
 * A temporary debug page to test image loading and Supabase storage functionality
 * This can be removed after resolving image issues
 */
const DebugPage = () => {
  const [bucketStatus, setBucketStatus] = useState('Checking...');
  const [files, setFiles] = useState([]);
  const [testImageUrl, setTestImageUrl] = useState(null);
  const [testResult, setTestResult] = useState(null);
  
  useEffect(() => {
    // Check if app_images bucket exists
    const checkBucket = async () => {
      try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        
        if (error) {
          setBucketStatus(`Error: ${error.message}`);
          return;
        }
        
        const bucket = buckets.find(b => b.name === 'app_images');
        
        if (bucket) {
          setBucketStatus(`Found: ${bucket.name} (Public: ${bucket.public ? 'Yes' : 'No'})`);
          
          // List files in bucket
          const { data, error: listError } = await supabase.storage
            .from('app_images')
            .list();
            
          if (listError) {
            setFiles([`Error listing files: ${listError.message}`]);
          } else {
            setFiles(data || []);
          }
          
        } else {
          setBucketStatus('Not found. Please create it in Supabase dashboard.');
        }
      } catch (e) {
        setBucketStatus(`Exception: ${e.message}`);
      }
    };
    
    checkBucket();
  }, []);
  
  const handleTestUpload = async () => {
    setTestResult('Uploading test image...');
    
    try {
      // Create a simple 1x1 pixel image
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
      
      // Upload test image
      const filePath = `debug/test-${Date.now()}.png`;
      const { error } = await supabase.storage
        .from('app_images')
        .upload(filePath, imageData, {
          contentType: 'image/png'
        });
        
      if (error) {
        setTestResult(`Upload failed: ${error.message}`);
        return;
      }
      
      setTestResult('Upload successful! Generating URL...');
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('app_images')
        .getPublicUrl(filePath);
        
      if (!urlData || !urlData.publicUrl) {
        setTestResult('Failed to generate public URL');
        return;
      }
      
      setTestImageUrl(urlData.publicUrl);
      setTestResult(`Success! URL: ${urlData.publicUrl}`);
      
    } catch (e) {
      setTestResult(`Error: ${e.message}`);
    }
  };

  return (
    <div className="container">
      <h1>Storage Debugging</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <Link to="/" className="btn">← Back to Home</Link>
      </div>
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2>Bucket Status</h2>
        <p>app_images: <strong>{bucketStatus}</strong></p>
        
        <h3>Files in Bucket</h3>
        {files.length === 0 ? (
          <p>No files found</p>
        ) : (
          <ul>
            {files.map((file, i) => (
              <li key={i}>
                {file.name} ({file.metadata?.mimetype || 'unknown type'})
                {file.id && (
                  <button 
                    onClick={async () => {
                      const { data } = supabase.storage
                        .from('app_images')
                        .getPublicUrl(file.name);
                        
                      if (data?.publicUrl) {
                        window.open(data.publicUrl, '_blank');
                      } else {
                        alert('Could not generate public URL');
                      }
                    }}
                    style={{ marginLeft: '10px' }}
                  >
                    View
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2>Test Image Upload</h2>
        <button onClick={handleTestUpload} className="btn">Upload Test Image</button>
        
        {testResult && (
          <div style={{ marginTop: '15px' }}>
            <p><strong>Result:</strong> {testResult}</p>
            
            {testImageUrl && (
              <div>
                <p>Test image:</p>
                <img 
                  src={testImageUrl} 
                  alt="Test"
                  style={{ border: '1px solid #ccc', maxWidth: '100%' }} 
                  onError={() => {
                    setTestResult(prev => `${prev}\nError: Image failed to load in browser`);
                  }}
                />
                <p>
                  <a href={testImageUrl} target="_blank" rel="noopener noreferrer">
                    Open image directly in new tab
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Advanced image debugger component */}
      <ImageDebugger />
    </div>
  );
};

export default DebugPage;
