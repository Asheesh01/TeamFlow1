import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  ShieldCheck,
  LogOut,
  Users,
  CheckSquare,
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    member: 'Member',
  }[user?.role] || 'User';

  const roleColor = {
    superadmin: 'var(--role-super)',
    admin: 'var(--role-admin)',
    member: 'var(--role-member)',
  }[user?.role];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <CheckSquare size={22} />
        </div>
        <span className="sidebar-logo-text">TeamFlow</span>
      </div>

      {/* User info */}
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <p className="sidebar-user-name">{user?.name}</p>
          <span className="sidebar-role-badge" style={{ color: roleColor, borderColor: roleColor }}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <p className="sidebar-nav-label">Navigation</p>

        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/tasks/mine" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <ClipboardList size={18} />
          <span>My Tasks</span>
        </NavLink>

        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <p className="sidebar-nav-label" style={{ marginTop: '1rem' }}>Management</p>

            <NavLink to="/tasks/assign" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Users size={18} />
              <span>Assign Tasks</span>
            </NavLink>

            <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FolderOpen size={18} />
              <span>Projects</span>
            </NavLink>
          </>
        )}

        {user?.role === 'superadmin' && (
          <>
            <p className="sidebar-nav-label" style={{ marginTop: '1rem' }}>Super Admin</p>
            <NavLink to="/super-panel" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={18} />
              <span>Super Panel</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Logout */}
      <button className="sidebar-logout" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  );
};

export default Sidebar;
