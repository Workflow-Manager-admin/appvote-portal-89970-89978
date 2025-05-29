import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if user is already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [formError, setFormError] = useState('');

  const onSubmit = async (data) => {
    setSubmitting(true);
    setFormError('');
    setEmailNotConfirmed(false);

    try {
      const { email, password } = data;
      const { error } = await login(email, password);

      if (error) {
        // Supabase may return "Email not confirmed" or similar
        if (
          error.message &&
          (error.message.toLowerCase().includes('email not confirmed') ||
            error.message.toLowerCase().includes('email not verified') ||
            error.message.toLowerCase().includes('confirm your email'))
        ) {
          setEmailNotConfirmed(true);
        } else {
          setFormError(error.message || 'Failed to sign in');
          toast.error(error.message || 'Failed to sign in');
        }
      } else {
        toast.success('Signed in successfully');
        // Navigation will happen automatically via the useEffect
      }
    } catch (error) {
      console.error('Error during login:', error);
      setFormError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <Link to="/" className="logo logo-auth">
            <span className="logo-symbol">*</span> Kavia AI App Contest
          </Link>
          <h2 className="auth-title">Sign In</h2>
        </div>

        {emailNotConfirmed && (
          <div className="verify-notice" style={{
            background: '#fff1ea',
            border: '1px solid #d35400',
            color: '#b75d17',
            padding: '14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            Email not confirmed. Please check your inbox and click the verification link before logging in.
          </div>
        )}
        {formError && !emailNotConfirmed && (
          <div className="form-error-message" style={{
            background: '#ffeaea',
            border: '1px solid #ed2c2c',
            color: '#d91400',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '12px',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i,
                  message: 'Invalid email address'
                }
              })}
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <p className="error-message">{errors.email.message}</p>}
            <small className="form-hint">You can use email aliases (e.g., example+1@email.com)</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              {...register('password', { 
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
              className={errors.password ? 'input-error' : ''}
            />
            {errors.password && <p className="error-message">{errors.password.message}</p>}
          </div>
          
          <button 
            type="submit" 
            className="btn btn-auth" 
            disabled={submitting}
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
          
          <p className="auth-switch">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
