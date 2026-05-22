import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { UserPlus, User, Mail, Lock, Eye, EyeOff, CheckSquare, ShieldX } from 'lucide-react';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restricted, setRestricted] = useState(false); // show restriction banner
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setForm({ ...form, role });
    setRestricted(false); // reset banner when role changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Block admin / superadmin self-registration — show UI banner
    if (form.role === 'admin' || form.role === 'superadmin') {
      setRestricted(true);
      return;
    }

    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill in all fields.'); return;
    }
    if (form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters.'); return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.'); return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', { ...form, role: 'member' });
      login(res.data.token, res.data.user);
      toast.success('Account created! Welcome to TeamFlow.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
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

        <h2 className="auth-title">Create account</h2>
        <p className="auth-subtitle">Join your team on TeamFlow</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full name</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input id="reg-name" type="text" className="form-input" placeholder="Priya Sharma"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input id="reg-email" type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input id="reg-password" type={showPass ? 'text' : 'password'} className="form-input" placeholder="Min 6 characters"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="input-icon-right" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select id="reg-role" className="form-select" value={form.role}
              onChange={handleRoleChange}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>

          {/* Restriction banner — shown when Admin or SuperAdmin is selected and Register is clicked */}
          {restricted && (
            <div className="role-restricted-box">
              <div className="role-restricted-icon">
                <ShieldX size={20} />
              </div>
              <div className="role-restricted-content">
                <p className="role-restricted-title">
                  Cannot register as {form.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                </p>
                <p className="role-restricted-msg">
                  {form.role === 'superadmin'
                    ? 'There is only one Super Admin — pre-created by the system. You cannot self-register as Super Admin.'
                    : 'Admin accounts can only be created by the Super Admin. Please register as a Member. Your Super Admin can promote you to Admin later.'}
                </p>
              </div>
            </div>
          )}

          <button id="reg-submit" type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : <><UserPlus size={16} /> Register</>}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
