import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Planner from './pages/Planner.jsx';
import Subjects from './pages/Subjects.jsx';
import Schedule from './pages/Schedule.jsx';
import MockExams from './pages/MockExams.jsx';
import TestResults from './pages/TestResults.jsx';
import Analytics from './pages/Analytics.jsx';
import Timeline from './pages/Timeline.jsx';
import PlannerHistory from './pages/PlannerHistory.jsx';
import AIPlanner from './pages/AIPlanner.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute>
              <Subjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-exams"
          element={
            <ProtectedRoute>
              <MockExams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-results"
          element={
            <ProtectedRoute>
              <TestResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-planner"
          element={
            <ProtectedRoute>
              <AIPlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planner"
          element={
            <ProtectedRoute>
              <Planner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <Timeline />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planner-history"
          element={
            <ProtectedRoute>
              <PlannerHistory />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
