import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { loginWithEmail, adminUser, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin@focusora.app');
  const [password, setPassword] = useState('admin123456');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect immediately
  React.useEffect(() => {
    if (adminUser) {
      navigate('/', { replace: true });
    }
  }, [adminUser, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please fill in both fields.');
      return;
    }

    let emailToUse = username.trim();
    if (!emailToUse.includes('@')) {
      emailToUse = `${emailToUse}@focusora.app`;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(emailToUse, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Admin authentication error:', err);
      if (err.code === 'auth/wrong-password') {
        setErrorMessage('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Too many attempts. Please wait a few moments.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error. Check your connection.');
      } else {
        setErrorMessage(err.message || 'Invalid credentials. Please verify your details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-box">
        {/* Brand */}
        <div className="login-brand">
          <img
            src="/logo.png"
            alt="Focusora"
            className="brand-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'logo.png';
            }}
          />
          <span className="brand-badge">Admin</span>
        </div>

        <div className="login-title-section">
          <h1>Sign in</h1>
          <p>Access the Focusora management console</p>
        </div>

        {errorMessage && (
          <div className="error-alert">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username or email</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              placeholder="admin@focusora.app"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting || loading}
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="eye-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="submit-button"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer">
          <span>Focusora Internal • Production Dashboard</span>
        </div>
      </div>
    </div>
  );
};
