import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { LogIn, Mail, Lock, Eye, EyeOff, CheckSquare, ShieldX, AlertCircle } from 'lucide-react';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  member: 'Member',
};

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roleError, setRoleError] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [requiredRole, setRequiredRole] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const quickLogin = (email, password, role) => {
    setForm({ email, password });
    setRequiredRole(role);
    setRoleError(null);
    // Do NOT clear loginError — let it stay until the user submits again
  };

  const handleEmailChange = (e) => {
    setForm({ ...form, email: e.target.value });
    // Don't clear roleError or loginError here — let them stay until next submit
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setRoleError(null);
    // Keep any existing error visible during loading; it will update on completion
    try {
      const res = await api.post('/auth/login', form);
      const loggedInUser = res.data.user;

      // Role validation if a demo button set a required role
      if (requiredRole && loggedInUser.role !== requiredRole) {
        setRoleError({ expected: requiredRole, got: loggedInUser.role });
        setLoading(false);
        return;
      }

      // Success — clear errors and navigate
      setLoginError('');
      setRoleError(null);
      login(res.data.token, loggedInUser);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><CheckSquare size={28} /></div>
          <h1 className="auth-logo-text">TeamFlow</h1>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="login-email"
                type="email"
                className={`form-input ${roleError || loginError ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleEmailChange}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className={`form-input ${loginError ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
              <button type="button" className="input-icon-right" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Role mismatch error banner */}
          {roleError && (
            <div className="role-restricted-box" style={{ marginBottom: 0, marginTop: '-.25rem' }}>
              <div className="role-restricted-icon">
                <ShieldX size={20} />
              </div>
              <div className="role-restricted-content">
                <p className="role-restricted-title">
                  You are not {ROLE_LABELS[roleError.expected] === 'Admin' ? 'an' : 'a'} {ROLE_LABELS[roleError.expected]}
                </p>
                <p className="role-restricted-msg">
                  This account has <strong>{ROLE_LABELS[roleError.got]}</strong> access.
                  Please use a valid <strong>{ROLE_LABELS[roleError.expected]}</strong> account.
                </p>
              </div>
            </div>
          )}

          {/* Login error banner (wrong email / password / non-existent account) */}
          {loginError && (
            <div className="role-restricted-box" style={{ marginBottom: 0, marginTop: '-.25rem' }} aria-live="polite">
              <div className="role-restricted-icon">
                <AlertCircle size={20} />
              </div>
              <div className="role-restricted-content">
                <p className="role-restricted-title">Invalid Credentials</p>
                <p className="role-restricted-msg">{loginError}</p>
              </div>
            </div>
          )}

          <button id="login-submit" type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        {/* Quick demo access */}
        <div className="demo-logins">
          <p className="demo-logins-label">Quick demo access:</p>
          <div className="demo-logins-grid">
            <button
              className={`demo-btn demo-super ${requiredRole === 'superadmin' ? 'demo-btn-active' : ''}`}
              onClick={() => quickLogin('superadmin@gmail.com', 'Admin@1234', 'superadmin')}
            >
              Super Admin
            </button>
            <button
              className={`demo-btn demo-admin ${requiredRole === 'admin' ? 'demo-btn-active' : ''}`}
              onClick={() => quickLogin('arjunmehta@gmail.com', 'Admin@1234', 'admin')}
            >
              Admin
            </button>
            <button
              className={`demo-btn demo-member ${requiredRole === 'member' ? 'demo-btn-active' : ''}`}
              onClick={() => quickLogin('priyasharma@gmail.com', 'Member@1234', 'member')}
            >
              Member
            </button>
          </div>
          <p style={{ fontSize: '.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '.4rem' }}>
            Clicking a button fills the credentials automatically
          </p>
        </div>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
