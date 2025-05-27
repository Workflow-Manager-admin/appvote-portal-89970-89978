import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

/**
 * AddApp is robust to async restoration of user/context:
 *  - UI gated until user and contest context fully restored (prevents flicker/incorrect state after refresh).
 *  - Submission guarded by current context.
 */
// PUBLIC_INTERFACE
const AddApp = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Auth and contest context hooks
  const { user, loading: authLoading } = useAuth();
  const { currentWeek, canSubmitApps, hasValidContestStructure, loading: contestLoading } = useContest();
  const navigate = useNavigate();

  // App is ready to render/submit only when user and contest context are available/restored
  // This `ready` flag (and any data-load logic) depends robustly upon all async-loaded state
  const ready =
    !authLoading &&
    !contestLoading &&
    user &&
    hasValidContestStructure &&
    currentWeek;

  // --- KEEP IN SYNC: If you later fetch per-user or per-contest data here (for form enablement), update dependencies below accordingly! ---
  // This useEffect serves two key goals:
  //   1. If you ever fetch data on-mount (e.g. user quota, contest week info), always retry on session/context ready or after a page refresh.
  //   2. Documentation: Show maintainers exactly what state determines if this page's API/data needs to be (re)loaded.
  useEffect(() => {
    // Nothing to fetch on-mount currently (app form is static),
    // but if you add API calls here in future (e.g. pre-fill, rate-limit, quotas)
    // ensure to trigger them here, with [user, authLoading, contestLoading, hasValidContestStructure, currentWeek] as dependencies.
    //
    // Example (pseudocode):
    // if (ready) { fetchUserQuotaOrOtherData(); }
    //
    // NOTE: This pattern guarantees correct retrigger after page restore/refresh/session restore,
    // ensuring the form/UX is always correct for the up-to-date user and contest context.
  }, [user, authLoading, contestLoading, hasValidContestStructure, currentWeek]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  // PUBLIC_INTERFACE
  // onSubmit is robust: checks context/user *at trigger time*.
  const onSubmit = async (data) => {
    // If somehow triggered before restoration (should never happen), block
    if (authLoading || contestLoading || !user || !hasValidContestStructure || !currentWeek) {
      toast.error('Required context is not yet restored. Please wait...');
      return;
    }

    // Check if app submission is allowed (contest is active)
    if (!canSubmitApps() || !currentWeek) {
      toast.error('Apps can only be submitted during active contests');
      return;
    }

    setLoading(true);

    try {
      const { name, link } = data;
      const imageFile = data.image[0];
      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        try {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          console.log('Uploading image to path:', filePath);
          
          // Upload the file to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('app_images')
            .upload(filePath, imageFile);

          if (uploadError) {
            console.error('Image upload error:', uploadError);
            throw new Error(`Image upload failed: ${uploadError.message}`);
          }
          
          console.log('Image uploaded successfully:', uploadData);

          // Get the public URL of the uploaded file with our helper function
          const publicUrl = getImageUrl('app_images', filePath);

          if (!publicUrl) {
            throw new Error('Failed to generate public URL for the image');
          }
          
          console.log('Generated public URL:', publicUrl);
          imageUrl = publicUrl;
        } catch (uploadError) {
          console.error('Error in image upload process:', uploadError);
          throw uploadError;
        }
      }

      // Save app data to database, include contest_week_id if schema supports it
      const { error: appError } = await supabase
        .from('apps')
        .insert([
          {
            name,
            link,
            image_url: imageUrl,
            user_id: user.id,
            ...(hasValidContestStructure && currentWeek ? { contest_week_id: currentWeek.id } : {})
          }
        ]);

      if (appError) {
        throw appError;
      }

      toast.success('App submitted successfully!');
      reset();
      setImagePreview(null);
      navigate('/');
    } catch (error) {
      console.error('Error submitting app:', error.message);
      toast.error(error.message || 'Failed to submit app');
    } finally {
      setLoading(false);
    }
  };

  // Render
  if (authLoading || contestLoading) {
    return (
      <div className="container add-app-page">
        <div className="loading-container">
          <div className="loading">
            <div className="loading-spinner"></div>
            <div>Restoring user and contest context...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container add-app-page">
        <div className="locked-message">
          <h2>You must be logged in to submit an app.</h2>
        </div>
      </div>
    );
  }

  // If contest structure is missing, block with message
  if (!hasValidContestStructure || !currentWeek) {
    return (
      <div className="container add-app-page">
        <div className="locked-message">
          <h2>Contest data is not available. Please try again later.</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container add-app-page">
      <h1 className="page-title">Add Your App</h1>
      
      {/* Contest status message - only show if contest structure exists */}
      {hasValidContestStructure && currentWeek && (
        <div className={`contest-status-banner ${currentWeek.status}`}>
          {currentWeek.status === 'active' ? (
            <>Contest is active! Submit your app for {currentWeek.name}.</>
          ) : (
            <>App submissions are currently closed. Please wait for an active contest.</>
          )}
        </div>
      )}
      
      <div className="add-app-form-container">
        {/* Only enable form if ready and can submit */}
        <form onSubmit={handleSubmit(onSubmit)} className="add-app-form">
          <div className="form-group">
            <label htmlFor="name">App Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your app name"
              {...register('name', { 
                required: 'App name is required',
                maxLength: {
                  value: 100,
                  message: 'App name must be less than 100 characters'
                }
              })}
              className={errors.name ? 'input-error' : ''}
              disabled={loading || !ready || !canSubmitApps()}
            />
            {errors.name && <p className="error-message">{errors.name.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="link">App URL</label>
            <input
              id="link"
              type="url"
              placeholder="https://yourapp.com"
              {...register('link', { 
                required: 'App URL is required',
                pattern: {
                  value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
                  message: 'Please enter a valid URL'
                }
              })}
              className={errors.link ? 'input-error' : ''}
              disabled={loading || !ready || !canSubmitApps()}
            />
            {errors.link && <p className="error-message">{errors.link.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="image">App Screenshot/Preview Image</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              {...register('image', { required: 'App image is required' })}
              onChange={handleImageChange}
              className={errors.image ? 'input-error' : ''}
              disabled={loading || !ready || !canSubmitApps()}
            />
            {errors.image && <p className="error-message">{errors.image.message}</p>}
            <small className="form-hint">Max file size: 5MB. Recommended resolution: 800x600px.</small>
          </div>

          {imagePreview && (
            <div className="image-preview">
              <h3>Preview</h3>
              <img 
                src={imagePreview} 
                alt="App preview" 
                style={{ maxWidth: '100%', maxHeight: '300px' }} 
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-submit" 
            disabled={loading || !ready || !canSubmitApps()}
          >
            {loading
              ? 'Submitting...'
              : canSubmitApps()
                ? 'Submit App'
                : 'Submissions Closed'}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * MAINTENANCE:
 * The AddApp page is robust to contest/user context restoration, page refreshes, and async session restore.
 * If you fetch extra context or data here in the future (ex: per-user quotas, contest settings), use the above useEffect,
 * with these dependencies, to ensure correct (re-)triggering after page restore or user switch.
 */
export default AddApp;
