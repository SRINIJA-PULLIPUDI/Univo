import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BookOpen,
  Bookmark,
  CheckSquare,
  Zap,
  Newspaper,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  CalendarClock,
  CircleUserRound,
  ClipboardCheck,
  ListTodo,
  Bot,
} from "lucide-react";

export function getNavItems(role) {
  const overview = { label: "Dashboard", path: "", icon: LayoutDashboard };
  const aiChat = { label: "AI Assistant", path: "ai-chat", icon: Bot, isAi: true };
  const announcements = { label: "Announcements", path: "announcements", icon: MessageSquare };
  const circulars = { label: "Circulars", path: "circulars", icon: FileText };
  const resources = { label: "Resources", path: "resources", icon: BookOpen };
  const bookmarks = { label: "Bookmarks", path: "bookmarks", icon: Bookmark };
  const tasks = { label: "Assignments", path: "tasks", icon: CheckSquare };
  const buzz = { label: "Buzz", path: "buzz", icon: Zap };
  const forum = { label: "Forum", path: "forum", icon: Newspaper };
  const timetable = { label: role === "student" ? "TimeTable" : "Timetable", path: "timetable", icon: CalendarClock };
  const attendance = { label: "Attendance", path: "attendance", icon: ClipboardCheck };
  const myTasks = { label: "My Tasks", path: "my-tasks", icon: ListTodo };
  const profile = { label: "Profile", path: "profile", icon: CircleUserRound };

  switch (role) {
    case "student":
      return [overview, announcements, circulars, resources, tasks, timetable, attendance, bookmarks, myTasks, buzz, forum, profile, aiChat];
    case "faculty":
      return [overview, announcements, circulars, resources, bookmarks, tasks, timetable, myTasks, buzz, forum, profile, aiChat];
    case "coordinator":
      return [overview, buzz, forum, myTasks, profile, aiChat];
    case "hod":
      return [
        overview,
        announcements,
        circulars,
        resources,
        bookmarks,
        tasks,
        myTasks,
        { label: "Subject Management", path: "subject-management", icon: ClipboardList },
        { label: "Faculty Oversight", path: "faculty-oversight", icon: Users },
        { label: "People", path: "users", icon: Users },
        timetable,
        buzz,
        forum,
        profile,
        aiChat,
      ];
    case "operator":
      return [
        overview,
        { label: "Branches", path: "branches", icon: Building2 },
        announcements,
        circulars,
        { label: "Users", path: "users", icon: Users },
        { label: "Subject Management", path: "subject-management", icon: ClipboardList },
        tasks,
        bookmarks,
        myTasks,
        buzz,
        forum,
        profile,
        aiChat,
      ];
    case "admin":
      return [overview, { label: "Branches", path: "branches", icon: Building2 }, { label: "Users", path: "users", icon: Users }, profile, aiChat];
    default:
      return [overview, aiChat];
  }
}

export const ROLE_LABEL = {
  student: "Student Portal",
  faculty: "Faculty Portal",
  coordinator: "Coordinator Portal",
  hod: "HOD Portal",
  operator: "Operator Portal",
  admin: "Admin Portal",
};
