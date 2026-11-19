# 🎓 UNIVO — Academic Operating System & Campus Intelligence Platform

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_8.5-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.io-4.7-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Multi--LLM-Groq%20%7C%20Gemini%20%7C%20Claude%20%7C%20OpenAI-FF6F00?style=for-the-badge&logo=anthropic&logoColor=white" alt="AI Multi-LLM" />
  <img src="https://img.shields.io/badge/Auth-JWT_%26_RBAC-purple?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

---

## 🌟 Executive Overview

Higher education institutions routinely struggle with fragmented software tooling: Learning Management Systems (LMS) sit in disconnected silos, circulars get lost in crowded email inboxes, student-faculty communication spills into unmoderated third-party messaging apps, timetable updates cause confusion, and attendance tracking remains isolated.

**Univo** solves this institutional fragmentation by delivering a unified, enterprise-grade **Academic Operating System (AOS)**. Built with React, Node.js, Express, MongoDB, and Socket.io, Univo combines institutional governance, multi-persona portals, real-time collaboration, and an institution-grounded AI campus co-pilot into a single, cohesive web platform.

---

## 🏗️ System Architecture

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               React 18 Single Page App                 │
                                    │     (Tailwind CSS · Lucide Icons · Role Portals)       │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │
                                         REST API (HTTP/JSON)   │   Persistent WebSockets (WS)
                                                                ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │             Express.js + Socket.io Server              │
                                    │          JWT Security & RBAC Route Gatekeepers         │
                                    └───────┬───────────────────┬────────────────────┬───────┘
                                            │                   │                    │
                   ┌────────────────────────┘                   │                    └────────────────────────┐
                   ▼                                            ▼                                             ▼
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│        Academic Brain (RAG)          │     │        Document & File Engine        │      │       Real-Time Event Hub            │
│  - Live Timetable & Class Schedules  │     │  - In-Browser Excel Viewer (.xlsx)   │      │  - Isolated Socket.io Rooms          │
│  - Attendance Aggregation (Sandy)    │     │  - Mammoth Word Renderer (.docx)     │      │  - Subject Discussion Streams        │
│  - Assignments & Overdue Deadlines   │     │  - Interactive Slide Deck (.pptx)    │      │  - 1:1 Student-Faculty Direct Chat   │
│  - Multi-LLM (Groq/Gemini/OpenAI)    │     │  - Tesseract OCR & Text Chunker      │      │  - Campus Forum & Live Comments      │
│  - Deterministic Synthesizer Engine  │     │  - Streamed Secure PDF & Media       │      │  - Live Typing & Unread Indicators   │
└──────────────────┬───────────────────┘     └──────────────────┬───────────────────┘      └──────────────────┬───────────────────┘
                   │                                            │                                             │
                   └────────────────────────────────────┬───────┴─────────────────────────────────────────────┘
                                                        ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │               MongoDB Database (Atlas)                 │
                                    │    Compound Indexes · Self-Healing Schemas · RBAC      │
                                    └────────────────────────────────────────────────────────┘
```

---

## 🏛️ Role-Based Access Control (RBAC) & Portal Architecture

Univo implements comprehensive authorization at both the API layer (via Express role gatekeeper middleware) and the client routing layer (`<ProtectedRoute roles={[...]} />`). The system provides 6 tailored portals, each dynamically themed to match the user's role:

```
                                  ┌───────────────┐
                                  │  Super Admin  │
                                  └───────┬───────┘
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
             ┌───────────────┐                         ┌───────────────┐
             │   Operator    │                         │  HOD (Branch) │
             └───────┬───────┘                         └───────┬───────┘
                     │                                         │
                     ├────────────────────┬────────────────────┤
                     ▼                    ▼                    ▼
             ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
             │    Faculty    │    │  Coordinator  │    │    Student    │
             └───────────────┘    └───────────────┘    └───────────────┘
```

### 1. 🎓 Student Portal (`role: 'student'`)
- **Personalized Academic Dashboard**: Next-class countdown, urgent assignment due dates, unread official circulars, and quick-action shortcuts.
- **Live Attendance Dashboard**: Real-time integration with institutional attendance portals, tracking individual attendance against the university's critical **75% minimum threshold** with per-subject held/attended analytics.
- **Assignment Hub**: View requirements, attach work files, submit before deadlines, track evaluation scores, and review faculty feedback or revision requests.
- **Dynamic Timetable**: Room-mapped weekly schedule displaying periods, subjects, and assigned professors.
- **Subject Communities & 1:1 Inquiries**: Collaborate in course-wide discussion rooms or open a direct, 1-on-1 academic channel with the assigned subject faculty.
- **Personal Task Planner (`My Tasks`)**: Private, lightweight task planner with priorities and deadlines for personal academic organization.

### 2. 👨‍🏫 Faculty Portal (`role: 'faculty'`)
- **Teaching Load Management**: Multi-subject and multi-section tracking, including cross-branch departmental assignments.
- **Course Resource Publishing**: Upload unit-by-unit syllabi, lecture notes, lab manuals, and reference documents with automatic OCR text extraction and AI RAG chunking.
- **Assignment Lifecycle Management**: Publish assignments to target sections with attached briefs, rubric details, and strict deadlines.
- **Submission Evaluation & Feedback**: Preview submitted files directly in the browser, award marks, approve submissions, or request revisions with structured feedback.
- **Community Moderation**: Broadcast important notices in subject channels and resolve student academic questions in real time.

### 3. 🏛️ Head of Department (HOD) Portal (`role: 'hod'`)
- **Curriculum & Subject Management**: Provision subjects by branch and semester, bind academic course codes, and assign sections to faculty.
- **Faculty Oversight**: Comprehensive visibility over departmental teaching loads, uploaded course notes, assignment frequencies, and grading progress.
- **Departmental Analytics**: Real-time distribution metrics across Years 1 through 4 and batch-wise academic progression.
- **Branch Announcements**: Broadcast official communications to specific year groups and the HOD Community.
- **Semester Advancement**: Review student academic standing and advance eligible student cohorts to the next semester.

### 4. ⚙️ Operator Portal (`role: 'operator'`)
- **Academic Branch Configuration**: Dynamically manage section rosters per academic year (e.g., Year 1: Sections A-E; Year 4: Sections A-C).
- **Bulk Excel Onboarding**: Ingest entire student batches and faculty directories from `.xlsx` spreadsheets with automated duplicate detection, row validation, and account provisioning.
- **Academic Records Maintenance**: Bulk or individually update CGPA, Credits Earned, Total Attendance, and increment/decrement Backlogs (`+1`, `-1`).

### 5. 📢 Coordinator Portal (`role: 'coordinator'`)
- **Campus Buzz**: Post micro-announcements, event posters, club recruitment drives, and hackathon alerts with interactive reactions.
- **Campus Forum**: Author detailed academic and extracurricular articles with rich markdown formatting and moderate real-time discussions.

### 6. 🛡️ Super Admin Portal (`role: 'admin'`)
- **Institutional Governance**: Establish university branches and departments; assign Heads of Department (HODs) and Branch Operators.
- **Global User Administration**: Activate/deactivate accounts, oversee security policies, and manage system-wide credentials.

---

## 🔐 Comprehensive Permission Matrix

| Feature / Capability | Student | Faculty | HOD | Operator | Coordinator | Admin |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **View Dashboard & Timetable** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Grounded AI Campus Co-Pilot** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit Assignments** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Sync Live Attendance** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Create & Grade Assignments** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Upload Subject Resources (Notes/PDFs)** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Subject Discussion Chats** | ✅ (Enrolled) | ✅ (Assigned) | ✅ | ❌ | ❌ | ❌ |
| **Direct 1:1 Student-Faculty Chat** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Post Campus Buzz & Forum Articles** | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Comment on Campus Forum** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create/Assign Subjects & Sections** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Faculty Teaching Oversight** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Bulk Excel Import & Semester Advancement** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Create Branches & Assign HOD/Operator** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🤖 Institution-Grounded AI Campus Co-Pilot

```
                       ┌─────────────────────────────────────────┐
                       │              User Question              │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │         Academic Brain (RAG)            │
                       │   - Real-time Timetable & Current Class │
                       │   - Student Attendance & Safe Threshold │
                       │   - Assignments & Overdue Deadlines     │
                       │   - Circulars, Announcements & Buzz     │
                       │   - OCR Extracted Chunks of PDFs/Notes  │
                       └────────────────────┬────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    ┌──────────────────────┐                                  ┌──────────────────────┐
    │ Multi-LLM Providers  │                                  │ Local Academic       │
    │ 1. Groq (Llama 3.3)  │  (If all API keys offline /      │ Synthesizer Engine   │
    │ 2. Google Gemini     │   out of credits)                │ (Deterministic RAG)  │
    │ 3. OpenAI GPT-4o     │ ───────────────────────────────► │ 100% Uptime Guarntee │
    │ 4. Anthropic Claude  │                                  │ Grounded Citations   │
    └──────────────────────┘                                  └──────────────────────┘
```

### Why Univo AI is an Engineering Highlight
Most AI chatbots in education are generic API wrappers prone to hallucinations. **Univo AI is strictly grounded in the university's internal operational records:**

1. **Real-Time Institutional Context Aggregation**:
   When a user asks *"What is my next class?"*, *"Do I have any assignment due today?"*, or *"Summarize the Unit 1 Cloud Computing notes"*, the **Academic Brain** (`academicBrain.js`) gathers verified data across Mongo collections (timetable slots, attendance logs, active assignments, faculty notices, and chunked course documents) before query execution.
2. **Multi-LLM Fallback Architecture**:
   - **Groq Cloud (Llama 3.3 70B)**: Ultra-low latency inference (500+ tokens/sec) for instantaneous answers.
   - **Google Gemini (1.5 Flash)**: High reasoning accuracy on syllabus queries.
   - **OpenAI (GPT-4o / GPT-4o-mini)**: Comprehensive academic responses.
   - **Anthropic Claude (3.5 Sonnet)**: Deep document comprehension.
3. **Deterministic Local Academic Synthesizer (Zero-Failure Guarantee)**:
   If external LLM APIs fail, face rate-limits, or exhaust credit balances ($0.00), Univo does **not** fail. Instead, the built-in **Deterministic Academic Synthesizer** parses the question against verified institutional state and outputs a formatted markdown response with verified citations.
4. **Automated Document OCR & Semantic Extraction**:
   When faculty upload course materials, the server utilizes **Tesseract OCR**, **pdf-parse**, and **mammoth** to extract and chunk text so students can query documents directly from the chat interface.

---

## 💬 Real-Time Communication Hub (Socket.io)

Univo replaces unmoderated external chat groups with an isolated, secure campus communication system:
- **`group:<groupId>`**: Announcement groups for HODs and batch-specific Year Groups (e.g., ECE Year 3). Room membership is computed dynamically from `branch` + `year` (requiring zero manual membership migration when students advance).
- **`subject:<subjectId>`**: Dedicated community for each curriculum course, enabling students and assigned faculty to discuss coursework.
- **`direct:<subjectId>-<studentId>-<facultyId>`**: Private, authenticated direct inquiry channels between students and their course professors.
- **`forum:<postId>`**: Real-time collaborative discussion threads on published campus articles.
- **Live Typing Indicators & Unread Badges**: Real-time typing indicators (`typing`) and dynamic unread notification increments.

---

## 📄 Universal In-Browser Document Previewer

Univo eliminates the friction of having to download unknown files just to review notes or submissions:
- 📊 **Excel (`.xlsx`, `.xls`)**: Interactive spreadsheet viewer with sheet tab switching, fast text filtering across rows, pagination (50 rows/page), and copy-to-clipboard.
- 📝 **Word (`.docx`, `.doc`)**: Native HTML conversion via Mammoth with interactive zoom controls (50% to 150%).
- 📽️ **PowerPoint (`.pptx`, `.ppt`)**: Slide-by-slide inspection deck with search across slide notes.
- 📑 **PDF & Multimedia**: Seamless in-browser reading, image zoom, audio player, and video player with secure token verification.

---

## 🎓 Curriculum & Student Lifecycle Engine

- **Independent Section Allocations**: Branches support independently configured section lists per academic year.
- **Dynamic Semester-to-Year Derivation**: Semesters 1 through 8 automatically derive Years 1 through 4, ensuring batch promotions require zero database migrations.
- **Cross-Departmental Teaching**: Allows faculty members from one department (e.g., Mathematics or ECE) to be officially assigned to teach sections in another branch (e.g., CSE).
- **Bulk Excel Operations**: Operators and HODs can onboard entire student batches from `.xlsx` workbooks and perform signed backlog adjustments (`+1`, `-1`).
- **Alumni Management**: Students advancing past semester 8 are automatically transitioned to Alumni status with full historical record preservation.

---

## 🔒 Key Engineering Highlights

- **Zero Hardcoded Secrets**: All authentication keys, database connection strings, and AI tokens are loaded via strictly scoped environment variables.
- **Defense-in-Depth Authorization**: Backend route verification (`allow(role)`) independently validates every request against the signed JWT payload.
- **Safe File Uploads**: Uploads are sanitized, isolated, and served through controlled endpoints with disposition headers.
- **Self-Healing Database Migrations**: Automated schema reconciliation on server startup ensures index consistency and schema version upgrades without manual DBA intervention.
- **Dynamic Port Recovery (`freePort.js`)**: Built-in developer utility that detects port collisions and safely frees local development ports.

---

## 🛠️ Technology Stack

| Domain | Technologies & Libraries |
|:---|:---|
| **Frontend** | React 18, Vite 5, Tailwind CSS, React Router v6, Lucide React, Axios, Socket.io-client, date-fns |
| **Backend** | Node.js (v18+), Express.js, Socket.io, Multer, Bcrypt.js, JsonWebToken, Cors, Dotenv |
| **Database** | MongoDB, Mongoose v8.5 (Schema validation, compound indexing, automated migration pipelines) |
| **AI & OCR** | Groq SDK / Fetch, Google Gemini API, OpenAI API, Anthropic Claude SDK, Tesseract.js, pdf-parse, Mammoth |
| **Data Processing** | ExcelJS (Bulk imports/exports), Adm-Zip, Python rendering helpers |
| **Communications** | Nodemailer (SMTP dispatch for urgent announcements, circulars, and password reset OTPs) |

---

## 📂 Project Structure

```
Univo/
├── client/                           # React + Vite Frontend
│   ├── public/                       # Static public assets
│   ├── src/
│   │   ├── api/                      # Axios client with interceptors & JWT injection
│   │   ├── components/               # Reusable UI (Sidebar, AIChatWidget, Feed, MarkdownRenderer, etc.)
│   │   ├── context/                  # AuthContext (RBAC) and SocketContext (WebSockets)
│   │   ├── hooks/                    # Custom hooks (useChat, etc.)
│   │   ├── layouts/                  # DashboardLayout with dynamic portal themes
│   │   ├── pages/                    # Core screens (Overview, AiChat, Tasks, Attendance, Bookmarks, etc.)
│   │   │   ├── hod/                  # HOD-exclusive screens (SubjectManagement, FacultyOversight, Analytics)
│   │   │   └── operator/             # Operator screens (Branches, Users, Excel Batch Tools)
│   │   ├── utils/                    # Portal theme palettes, upload helpers
│   │   ├── App.jsx                   # Role-guarded route definitions
│   │   └── main.jsx                  # React DOM entry point
│   ├── tailwind.config.js            # Tailwind theme configuration
│   ├── vite.config.js                # Vite build & local API proxy configuration
│   ├── vercel.json                   # Vercel SPA client rewrite routing
│   └── package.json
│
├── server/                           # Express + Socket.io Backend
│   ├── config/                       # MongoDB database connection
│   ├── controllers/                  # Controller logic (Auth, Users, AI, Tasks, Subjects, etc.)
│   ├── middleware/                   # JWT Auth, Role Gatekeeper (`roles.js`), Multer storage
│   ├── models/                       # Mongoose Schemas (User, Branch, Subject, Task, Message, etc.)
│   ├── routes/                       # Express REST endpoints
│   ├── sockets/                      # Socket.io room management & event dispatchers
│   ├── utils/
│   │   ├── academicBrain.js          # RAG context aggregator & local academic synthesizer
│   │   ├── fileContentExtractor.js   # PDF, Word, Excel, and text parser
│   │   ├── ocrExtractor.js           # Tesseract OCR engine for scanned notes
│   │   ├── sandyAttendance.js        # External institutional attendance sync
│   │   ├── seed.js                   # Comprehensive demo dataset generator
│   │   └── freePort.js               # Cross-platform utility to auto-free port 5000
│   ├── server.js                     # Main server entry & socket initialization
│   ├── .env.example                  # Safe configuration template
│   └── package.json
│
├── .gitignore                        # Strict rules protecting credentials & builds
├── package.json                      # Monorepo scripts (dev, build, seed, install)
└── SETUP_AND_CREDENTIALS.md          # Private local setup & demo credentials (Ignored by Git)
```

---

## 📄 License
This project is licensed under the MIT License. Built for universities, educators, and students.
