import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

const FORM_STORAGE_KEY = "addAppFormState";

/**
 * Utility: Save form state (excluding File objects) to localStorage.
 */
function persistFormState(form, imagePreview) {
  // Exclude file objects; can only store values/strings
  const data = {
    name: form.name || "",
    link: form.link || "",
    imagePreview: imagePreview || null,
  };
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Utility: Load form state from localStorage.
 */
function loadFormState() {
  const data = localStorage.getItem(FORM_STORAGE_KEY);
  if (!data) return { name: "", link: "", imagePreview: null };
  try {
    const parsed = JSON.parse(data);
    return {
      name: parsed.name || "",
      link: parsed.link || "",
      imagePreview: parsed.imagePreview || null,
    };
  } catch {
    return { name: "", link: "", imagePreview: null };
  }
}

/**
 * Utility: Clear form persisted state (localStorage).
 */
function clearFormState() {
  localStorage.removeItem(FORM_STORAGE_KEY);
}

const AddApp = () => {
  const { user } = useAuth();
  const { currentWeek, canSubmitApps, hasValidContestStructure } = useContest();
  const navigate = useNavigate();

  // Restore from storage
  const restored = loadFormState();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      name: restored.name,
      link: restored.link,
    }
  });
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(restored.imagePreview);
  // react-hook-form does not persist file input (image) nor can file object be stored, must prompt user to reselect

  // Keep localStorage in sync as user types
  useEffect(() => {
    const subscription = () => {
      const current = getValues();
      persistFormState(current, imagePreview);
    };
    // Listen to all input value changes
    const unsubscribe = register("name", {
      onChange: subscription
    });
    register("link", { onChange: subscription });

    // On unmount, cleanup. Make sure to only call if it's actually a function.
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
    // eslint-disable-next-line
  }, [register, getValues, imagePreview]);

  // Also persist image preview changes
  useEffect(() => {
    // Save preview each time it changes along with the current values
    persistFormState(getValues(), imagePreview);
    // eslint-disable-next-line
  }, [imagePreview]);

  // On mount, restore form state and image preview
  useEffect(() => {
    setValue("name", restored.name);
    setValue("link", restored.link);
    setImagePreview(restored.imagePreview);
    // eslint-disable-next-line
  }, []); // only on initial mount

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

    // Create preview URL (store only the blob URL in localStorage, file object must be reselected by user)
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    // Do not persist file object
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
      const imageFile = data.image && data.image[0];
      let imageUrl = null;

      if (imageFile) {
        try {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('app_images')
            .upload(filePath, imageFile);

          if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError.message}`);
          }

          // Get the public URL of the uploaded file with our helper function
          const publicUrl = getImageUrl('app_images', filePath);

          if (!publicUrl) {
            throw new Error('Failed to generate public URL for the image');
          }
          imageUrl = publicUrl;
        } catch (uploadError) {
          throw uploadError;
        }
      } else {
        toast.error("Please select a preview image.");
        setLoading(false);
        return;
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

      // Clear localStorage and form states
      clearFormState();
      reset();
      setImagePreview(null);

      navigate('/');
    } catch (error) {
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
        <form onSubmit={handleSubmit(onSubmit)} className="add-app-form" autoComplete="off">
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
              autoComplete="off"
              onBlur={() => persistFormState(getValues(), imagePreview)}
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
                  // Accepts ONLY URLs that start with 'https://'
                  value: /^https:\/\/[\w\-]+(\.[\w\-]+)+[\/#?]?.*$/,
                  message: 'Please enter a valid HTTPS URL (must start with https://)'
                }
              })}
              className={errors.link ? 'input-error' : ''}
              autoComplete="off"
              onBlur={() => persistFormState(getValues(), imagePreview)}
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
