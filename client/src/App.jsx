import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Announcements from "./pages/Announcements";
import Circulars from "./pages/Circulars";
import Resources from "./pages/Resources";
import SubjectDetail from "./pages/SubjectDetail";
import Bookmarks from "./pages/Bookmarks";
import Tasks from "./pages/Tasks";
import AssignmentDetails from "./pages/AssignmentDetails";
import MyTasks from "./pages/MyTasks";
import Attendance from "./pages/Attendance";
import Profile from "./pages/Profile";
import Timetable from "./pages/Timetable";
import Buzz from "./pages/Buzz";
import Forum from "./pages/Forum";
import ForumPost from "./pages/ForumPost";
import FilePreview from "./pages/FilePreview";
import AiChat from "./pages/AiChat";

import SubjectManagement from "./pages/hod/SubjectManagement";
import FacultyOversight from "./pages/hod/FacultyOversight";
import Analytics from "./pages/hod/Analytics";
import Branches from "./pages/operator/Branches";
import Users from "./pages/operator/Users";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/file-preview/:category/:filename" element={<ProtectedRoute><FilePreview /></ProtectedRoute>} />

      <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Overview />} />
        <Route path="announcements" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator"]}><Announcements /></ProtectedRoute>} />
        <Route path="circulars" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator"]}><Circulars /></ProtectedRoute>} />
        <Route path="resources" element={<ProtectedRoute roles={["student", "faculty", "hod"]}><Resources /></ProtectedRoute>} />
        <Route path="resources/:subjectId" element={<ProtectedRoute roles={["student", "faculty", "hod"]}><SubjectDetail /></ProtectedRoute>} />
        <Route path="bookmarks" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator"]}><Bookmarks /></ProtectedRoute>} />
        <Route path="tasks" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator"]}><Tasks /></ProtectedRoute>} />
        <Route path="tasks/:taskId" element={<ProtectedRoute roles={["faculty", "hod", "operator"]}><AssignmentDetails /></ProtectedRoute>} />
        <Route path="my-tasks" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator", "coordinator"]}><MyTasks /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute roles={["student"]}><Attendance /></ProtectedRoute>} />
        <Route path="profile" element={<Profile />} />
        <Route path="timetable" element={<ProtectedRoute roles={["student", "faculty", "hod"]}><Timetable /></ProtectedRoute>} />
        <Route path="buzz" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator", "coordinator"]}><Buzz /></ProtectedRoute>} />
        <Route path="forum" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator", "coordinator"]}><Forum /></ProtectedRoute>} />
        <Route path="forum/:postId" element={<ProtectedRoute roles={["student", "faculty", "hod", "operator", "coordinator"]}><ForumPost /></ProtectedRoute>} />
        <Route path="ai-chat" element={<ProtectedRoute><AiChat /></ProtectedRoute>} />
        <Route path="ai-chat/:conversationId" element={<ProtectedRoute><AiChat /></ProtectedRoute>} />

        {/* HOD only */}
        <Route path="subject-management" element={<ProtectedRoute roles={["hod", "operator"]}><SubjectManagement /></ProtectedRoute>} />
        <Route path="faculty-oversight" element={<ProtectedRoute roles={["hod"]}><FacultyOversight /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute roles={["hod"]}><Analytics /></ProtectedRoute>} />

        {/* Operator + HOD */}
        <Route path="users" element={<ProtectedRoute roles={["admin", "operator", "hod"]}><Users /></ProtectedRoute>} />
        <Route path="branches" element={<ProtectedRoute roles={["admin", "operator"]}><Branches /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
