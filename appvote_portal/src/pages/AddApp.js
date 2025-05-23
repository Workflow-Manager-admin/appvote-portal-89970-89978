import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

const AddApp = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const { user } = useAuth();
  const { currentWeek, canSubmitApps, hasValidContestStructure } = useContest();
  const navigate = useNavigate();

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

  const onSubmit = async (data) => {
    if (!user) {
      toast.error('You must be logged in to add an app');
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
      navigate('/');
    } catch (error) {
      console.error('Error submitting app:', error.message);
      toast.error(error.message || 'Failed to submit app');
    } finally {
      setLoading(false);
    }
  };

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
                  value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
                  message: 'Please enter a valid URL'
                }
              })}
              className={errors.link ? 'input-error' : ''}
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
            disabled={loading || !canSubmitApps()}
          >
            {loading ? 'Submitting...' : canSubmitApps() ? 'Submit App' : 'Submissions Closed'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddApp;
