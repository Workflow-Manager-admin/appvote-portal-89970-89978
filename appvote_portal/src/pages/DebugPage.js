import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import supabase from '../config/supabaseClient';
import ImageDebugger from '../utils/ImageDebugger';
import { validateContestSchema, fixContestSchemaIssues } from '../utils/validateContestSchema';

/**
 * Contest Schema Debugger component helps diagnose and fix schema issues
 */
const ContestSchemaDebugger = () => {
  const [validating, setValidating] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [fixResults, setFixResults] = useState(null);

  const handleValidateClick = async () => {
    setValidating(true);
    try {
      const results = await validateContestSchema();
      setValidationResults(results);
      console.log('Schema validation results:', results);
    } catch (error) {
      console.error('Error validating schema:', error);
      toast.error('Error validating schema');
    } finally {
      setValidating(false);
    }
  };

  const handleFixClick = async () => {
    if (!validationResults) {
      toast.error('Please validate schema first');
      return;
    }

    setFixing(true);
    try {
      const results = await fixContestSchemaIssues(validationResults);
      setFixResults(results);
      console.log('Schema fix results:', results);
      
      if (results.success) {
        toast.success('Schema issues fixed! Validating again...');
        // Re-validate to confirm fixes
        const updatedResults = await validateContestSchema();
        setValidationResults(updatedResults);
        
        if (updatedResults.success) {
          toast.success('Schema is now valid!');
        } else {
          toast.warn('Some issues could not be fixed automatically');
        }
      } else {
        toast.error('Some issues could not be fixed automatically');
      }
    } catch (error) {
      console.error('Error fixing schema:', error);
      toast.error('Error fixing schema');
    } finally {
      setFixing(false);
    }
  };
  
  const renderValidationStatus = () => {
    if (!validationResults) return null;
    
    return (
      <div style={{ marginTop: '15px' }}>
        <h4>Schema Validation Results</h4>
        <div style={{ 
          padding: '10px',
          backgroundColor: validationResults.success ? 'rgba(0, 128, 0, 0.15)' : 'rgba(255, 0, 0, 0.15)',
          borderRadius: '4px',
          borderLeft: validationResults.success ? '4px solid green' : '4px solid red',
          marginBottom: '10px'
        }}>
          <strong>Status: </strong> 
          {validationResults.success ? 'Valid Schema ✅' : 'Invalid Schema ❌'}
        </div>
        
        {!validationResults.success && (
          <div>
            <h5>Tables</h5>
            <ul>
              <li>contest_weeks: {validationResults.tables.contest_weeks ? '✅ Exists' : '❌ Missing'}</li>
              <li>contest_winners: {validationResults.tables.contest_winners ? '✅ Exists' : '❌ Missing'}</li>
            </ul>
            
            <h5>Columns</h5>
            <ul>
              <li>apps.contest_week_id: {validationResults.columns.apps_contest_week_id ? '✅ Exists' : '❌ Missing'}</li>
              <li>votes.contest_week_id: {validationResults.columns.votes_contest_week_id ? '✅ Exists' : '❌ Missing'}</li>
            </ul>
            
            <h5>Issues</h5>
            <ul>
              {validationResults.issues.map((issue, index) => (
                <li key={index} style={{ color: '#ff4d4d' }}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  
  const renderFixResults = () => {
    if (!fixResults) return null;
    
    return (
      <div style={{ marginTop: '15px' }}>
        <h4>Fix Results</h4>
        <div style={{ 
          padding: '10px',
          backgroundColor: fixResults.success ? 'rgba(0, 128, 0, 0.15)' : 'rgba(255, 255, 0, 0.15)',
          borderRadius: '4px',
          borderLeft: fixResults.success ? '4px solid green' : '4px solid yellow',
          marginBottom: '10px'
        }}>
          <strong>Status: </strong> 
          {fixResults.success ? 'All issues fixed ✅' : 'Some issues fixed, some remain ⚠️'}
        </div>
        
        <h5>Operations Performed</h5>
        <ul>
          {fixResults.operations.map((op, index) => (
            <li key={index}>{op}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <p>Use this tool to validate and fix the contest schema. This helps troubleshoot issues where the app shows "Contest schema required" or is stuck on "Loading Apps...".</p>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button 
          onClick={handleValidateClick} 
          className="btn"
          disabled={validating}
        >
          {validating ? 'Validating...' : 'Validate Schema'}
        </button>
        
        {validationResults && !validationResults.success && (
          <button 
            onClick={handleFixClick} 
            className="btn"
            disabled={fixing}
          >
            {fixing ? 'Fixing...' : 'Fix Schema Issues'}
          </button>
        )}
      </div>
      
      {renderValidationStatus()}
      {renderFixResults()}
    </div>
  );
};

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
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2>Contest Schema Debugger</h2>
        <ContestSchemaDebugger />
      </div>
      
      {/* Advanced image debugger component */}
      <ImageDebugger />
    </div>
  );
};

export default DebugPage;
