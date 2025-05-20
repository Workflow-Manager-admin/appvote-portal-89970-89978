import { useState, useEffect } from 'react';
import supabase, { getImageUrl } from '../config/supabaseClient';

/**
 * A utility component that can find and repair broken image URLs in the database
 * This can be added to the admin dashboard temporarily to fix image issues
 */
const ImageRepairTool = () => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [apps, setApps] = useState([]);
  const [brokenImages, setBrokenImages] = useState([]);
  const [repairStatus, setRepairStatus] = useState(null);
  const [repairComplete, setRepairComplete] = useState(false);

  useEffect(() => {
    fetchAllApps();
  }, []);
  
  const fetchAllApps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('id, name, image_url')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching apps:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const analyzeImages = async () => {
    setAnalyzing(true);
    setBrokenImages([]);
    setRepairStatus(null);
    setRepairComplete(false);
    
    const broken = [];
    
    try {
      // Check each app's image URL
      for (const app of apps) {
        if (!app.image_url) continue; // Skip apps without images
        
        try {
          // If URL doesn't include the bucket name, it might be malformed
          if (!app.image_url.includes('app_images')) {
            broken.push({
              ...app,
              reason: 'URL may be malformed',
              repairable: false
            });
            continue;
          }
          
          // Try to extract the path from the URL
          let path = null;
          try {
            // Extract the path after the bucket name
            const match = app.image_url.match(/app_images\/([^?]+)/);
            if (match && match[1]) {
              path = match[1];
            }
          } catch (e) {
            console.error('Error parsing URL:', e);
          }
          
          if (!path) {
            broken.push({
              ...app,
              reason: 'Unable to extract file path',
              repairable: false
            });
            continue;
          }
          
          // Check if the file actually exists in storage
          const { data: fileExists, error: fileError } = await supabase.storage
            .from('app_images')
            .list(path.split('/').slice(0, -1).join('/') || '');
            
          if (fileError) {
            broken.push({
              ...app,
              reason: `Storage error: ${fileError.message}`,
              repairable: false,
              path
            });
            continue;
          }
          
          const fileName = path.split('/').pop();
          const fileInStorage = fileExists.some(f => f.name === fileName);
          
          if (!fileInStorage) {
            broken.push({
              ...app,
              reason: 'File not found in storage',
              repairable: false,
              path
            });
            continue;
          }
          
          // Generate a new URL with our helper and compare
          const newUrl = getImageUrl('app_images', path);
          if (newUrl && newUrl !== app.image_url) {
            broken.push({
              ...app,
              reason: 'URL format could be improved',
              repairable: true,
              oldUrl: app.image_url,
              newUrl,
              path
            });
          }
        } catch (appError) {
          broken.push({
            ...app,
            reason: `Error analyzing: ${appError.message}`,
            repairable: false
          });
        }
      }
      
      setBrokenImages(broken);
    } catch (error) {
      console.error('Error during image analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };
  
  const repairImages = async () => {
    setRepairComplete(false);
    setRepairStatus('Starting repair process...');
    const results = [];
    
    try {
      // Filter only repairable images
      const toRepair = brokenImages.filter(img => img.repairable);
      
      for (let i = 0; i < toRepair.length; i++) {
        const img = toRepair[i];
        setRepairStatus(`Repairing ${i + 1}/${toRepair.length}: ${img.name}`);
        
        try {
          // Update the URL in the database
          const { error } = await supabase
            .from('apps')
            .update({ image_url: img.newUrl })
            .eq('id', img.id);
            
          if (error) {
            results.push({
              id: img.id,
              name: img.name,
              success: false,
              message: error.message
            });
          } else {
            results.push({
              id: img.id,
              name: img.name,
              success: true,
              message: 'URL updated'
            });
          }
        } catch (updateError) {
          results.push({
            id: img.id,
            name: img.name,
            success: false,
            message: updateError.message
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setRepairStatus(`Repair complete. ${results.filter(r => r.success).length}/${toRepair.length} images updated.`);
      setRepairComplete(true);
      
      // Refetch apps after repair
      await fetchAllApps();
    } catch (error) {
      setRepairStatus(`Error during repair: ${error.message}`);
    }
  };
  
  return (
    <div className="admin-section">
      <h2>Image URL Repair Tool</h2>
      <p>This tool checks for potential issues with image URLs and can repair them.</p>
      
      <div className="action-buttons">
        <button 
          onClick={analyzeImages} 
          className="btn" 
          disabled={analyzing || loading || apps.length === 0}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Images'}
        </button>
        
        {brokenImages.length > 0 && brokenImages.some(img => img.repairable) && (
          <button 
            onClick={repairImages} 
            className="btn" 
            disabled={analyzing || loading}
            style={{ marginLeft: '10px' }}
          >
            Repair Fixable Images
          </button>
        )}
      </div>
      
      {loading && <p>Loading apps...</p>}
      {analyzing && <p>Analyzing image URLs, please wait...</p>}
      {repairStatus && <p>{repairStatus}</p>}
      
      {brokenImages.length > 0 && (
        <div className="results-section">
          <h3>Analysis Results</h3>
          <p>Found {brokenImages.length} images with potential issues. {brokenImages.filter(i => i.repairable).length} can be automatically repaired.</p>
          
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>App Name</th>
                  <th>Issue</th>
                  <th>Repairable</th>
                  <th>Current URL</th>
                  <th>Suggested URL</th>
                </tr>
              </thead>
              <tbody>
                {brokenImages.map(img => (
                  <tr key={img.id}>
                    <td>{img.name}</td>
                    <td>{img.reason}</td>
                    <td>{img.repairable ? '✅ Yes' : '❌ No'}</td>
                    <td>
                      <div style={{ maxWidth: '200px', wordBreak: 'break-all' }}>
                        {img.image_url}
                      </div>
                    </td>
                    <td>
                      {img.repairable && (
                        <div style={{ maxWidth: '200px', wordBreak: 'break-all' }}>
                          {img.newUrl}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {brokenImages.length === 0 && !analyzing && !loading && (
        <p>{repairComplete ? 'All issues have been fixed!' : 'No image issues found or analysis not yet run.'}</p>
      )}
    </div>
  );
};

export default ImageRepairTool;
