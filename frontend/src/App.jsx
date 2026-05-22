import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AssignTasks from './pages/AssignTasks';
import MyTasks from './pages/MyTasks';
import Projects from './pages/Projects';
import SuperPanel from './pages/SuperPanel';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e2435',
              color: '#e2e8f0',
              border: '1px solid #2d3748',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#48bb78', secondary: '#1e2435' } },
            error: { iconTheme: { primary: '#fc8181', secondary: '#1e2435' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          <Route path="/tasks/mine" element={
            <ProtectedRoute><MyTasks /></ProtectedRoute>
          } />

          <Route path="/tasks/assign" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']}><AssignTasks /></ProtectedRoute>
          } />

          <Route path="/projects" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']}><Projects /></ProtectedRoute>
          } />

          <Route path="/super-panel" element={
            <ProtectedRoute allowedRoles={['superadmin']}><SuperPanel /></ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
