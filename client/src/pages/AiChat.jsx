import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Calendar,
  Clock,
  BookOpen,
  ClipboardCheck,
  AlertTriangle,
  Zap,
  MessageSquare,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  CheckCheck,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import MarkdownRenderer from "../components/MarkdownRenderer";

const PROMPT_STARTERS = [
  {
    icon: Clock,
    title: "Next Class",
    query: "What is my next class?",
    color: "from-sky-500/20 to-blue-500/10 text-sky-700 border-sky-200",
  },
  {
    icon: Calendar,
    title: "Tomorrow's Schedule",
    query: "What is my schedule for tomorrow?",
    color: "from-indigo-500/20 to-violet-500/10 text-indigo-700 border-indigo-200",
  },
  {
    icon: AlertTriangle,
    title: "Deadlines Today",
    query: "Are there any deadlines today?",
    color: "from-amber-500/20 to-orange-500/10 text-amber-700 border-amber-200",
  },
  {
    icon: BookOpen,
    title: "Summarize Unit 1",
    query: "Summarize the Unit 1 pdf in short for me.",
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-700 border-emerald-200",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance Status",
    query: "What is my current attendance?",
    color: "from-cyan-500/20 to-blue-500/10 text-cyan-700 border-cyan-200",
  },
  {
    icon: Zap,
    title: "Latest Campus Buzz",
    query: "Tell me about the latest buzz",
    color: "from-purple-500/20 to-pink-500/10 text-purple-700 border-purple-200",
  },
  {
    icon: HelpCircle,
    title: "Mid-Exam Questions",
    query: "Generate mid-exam preparation questions for my subjects",
    color: "from-rose-500/20 to-red-500/10 text-rose-700 border-rose-200",
  },
  {
    icon: MessageSquare,
    title: "Announcements & Circulars",
    query: "What are the latest circulars and announcements?",
    color: "from-blue-500/20 to-indigo-500/10 text-blue-700 border-blue-200",
  },
];

export default function AiChat() {
  const { user } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(conversationId || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation list
  useEffect(() => {
    loadConversations();
  }, []);

  // Sync route param with active conversation
  useEffect(() => {
    if (conversationId && conversationId !== activeConvId) {
      setActiveConvId(conversationId);
      loadConversationMessages(conversationId);
    } else if (!conversationId && !activeConvId) {
      setMessages([]);
    }
  }, [conversationId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function loadConversations() {
    try {
      const res = await api.get("/ai-chat/conversations");
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }

  async function loadConversationMessages(id) {
    if (!id) return;
    try {
      const res = await api.get(`/ai-chat/conversations/${id}`);
      setMessages(res.data.messages || []);
      setActiveConvId(id);
    } catch (err) {
      console.error("Failed to load conversation messages:", err);
      setActiveConvId(null);
      setMessages([]);
      navigate("/app/ai-chat", { replace: true });
    }
  }

  function handleNewChat() {
    setActiveConvId(null);
    setMessages([]);
    navigate("/app/ai-chat");
    inputRef.current?.focus();
  }

  async function selectConversation(id) {
    if (id === activeConvId) return;
    setActiveConvId(id);
    navigate(`/app/ai-chat/${id}`);
    loadConversationMessages(id);
  }

  async function handleDeleteConversation(e, id) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await api.delete(`/ai-chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (activeConvId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }

  function startRename(e, conv) {
    e.stopPropagation();
    setEditingTitleId(conv._id);
    setEditTitleVal(conv.title);
  }

  async function submitRename(e, id) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!editTitleVal.trim()) return;
    try {
      await api.patch(`/ai-chat/conversations/${id}`, { title: editTitleVal.trim() });
      setConversations((prev) =>
        prev.map((c) => (c._id === id ? { ...c, title: editTitleVal.trim() } : c))
      );
      setEditingTitleId(null);
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  }

  async function handleSendMessage(overrideQuestion) {
    const q = (overrideQuestion ?? input).trim();
    if (!q || busy) return;

    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Optimistic user message
    const tempUserMsg = {
      _id: "temp-" + Date.now(),
      role: "user",
      text: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setBusy(true);

    try {
      const res = await api.post("/ai-chat", {
        question: q,
        conversationId: activeConvId || undefined,
      });

      const { conversationId: newConvId, answer, sourcesUsed } = res.data;

      // Assistant message
      const assistantMsg = {
        _id: "res-" + Date.now(),
        role: "assistant",
        text: answer,
        sourcesUsed: sourcesUsed || [],
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If this was a new conversation, update route and history list
      if (!activeConvId || activeConvId !== newConvId) {
        setActiveConvId(newConvId);
        navigate(`/app/ai-chat/${newConvId}`, { replace: true });
        loadConversations();
      }
    } catch (err) {
      console.error("AI Error:", err);
      const errMsg = {
        _id: "err-" + Date.now(),
        role: "assistant",
        text: "I encountered a brief connection issue while accessing the academic database. Please try again or rephrase your query.",
        sourcesUsed: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  function copyToClipboard(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Group conversations by relative time
  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: [],
  };

  const now = new Date();
  filteredConversations.forEach((conv) => {
    const d = new Date(conv.updatedAt || conv.createdAt);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) groups["Today"].push(conv);
    else if (diffDays === 1) groups["Yesterday"].push(conv);
    else if (diffDays <= 7) groups["Previous 7 Days"].push(conv);
    else groups["Older"].push(conv);
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 font-body">
      {/* 1. Left Sidebar: ChatGPT-style Conversation History */}
      <aside
        className={`relative flex flex-col border-r border-slate-200/90 bg-[#0B111E] text-slate-200 transition-all duration-300 ease-in-out shrink-0 z-20 ${
          sidebarOpen ? "w-72" : "w-0 -translate-x-full overflow-hidden"
        }`}
      >
        {/* Top Action: New Chat */}
        <div className="p-3.5 border-b border-slate-800/80">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-950/40 hover:from-sky-500 hover:to-blue-500 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              <span>New Conversation</span>
            </div>
            <span className="text-[10px] text-sky-200 font-medium px-1.5 py-0.5 rounded-md bg-white/15">
              Esc / +
            </span>
          </button>

          {/* Search conversation */}
          {conversations.length > 3 && (
            <div className="relative mt-2.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg bg-slate-900/90 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 border border-slate-800 focus:outline-none focus:border-sky-500/60"
              />
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-40 text-sky-400" />
              <p className="font-semibold text-slate-300">No chat history yet</p>
              <p className="mt-1 text-[11px] text-slate-400">
                Ask a question to start an institution-grounded session.
              </p>
            </div>
          ) : (
            Object.entries(groups).map(([groupName, items]) => {
              if (!items.length) return null;
              return (
                <div key={groupName} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {groupName}
                  </div>
                  {items.map((conv) => {
                    const isActive = conv._id === activeConvId;
                    const isEditing = editingTitleId === conv._id;

                    return (
                      <div
                        key={conv._id}
                        onClick={() => !isEditing && selectConversation(conv._id)}
                        className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all cursor-pointer ${
                          isActive
                            ? "bg-slate-800/90 text-white font-medium border border-sky-500/40 shadow-xs"
                            : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <MessageSquare
                            size={14}
                            className={`shrink-0 ${isActive ? "text-sky-400" : "text-slate-400"}`}
                          />
                          {isEditing ? (
                            <form
                              onSubmit={(e) => submitRename(e, conv._id)}
                              className="flex items-center gap-1 w-full"
                            >
                              <input
                                autoFocus
                                value={editTitleVal}
                                onChange={(e) => setEditTitleVal(e.target.value)}
                                onBlur={(e) => submitRename(e, conv._id)}
                                className="w-full bg-slate-900 px-1.5 py-0.5 rounded text-xs text-white border border-sky-400 focus:outline-none"
                              />
                            </form>
                          ) : (
                            <span className="truncate">{conv.title}</span>
                          )}
                        </div>

                        {/* Quick Action Icons */}
                        {!isEditing && (
                          <div
                            className={`flex items-center gap-1 ${
                              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            } transition-opacity shrink-0`}
                          >
                            <button
                              onClick={(e) => startRename(e, conv)}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                              title="Rename chat"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv._id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              title="Delete chat"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Status Card: Grounding Scope */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-slate-200">Academic Grounding Active</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Trained on Timetable • Attendance • Resources • Assignments • Circulars • Announcements
          </p>
        </div>
      </aside>

      {/* 2. Main Chat Canvas */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
        {/* Top Header Bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-4 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white shadow-xs">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-sm font-bold text-slate-900 leading-none">
                    Univo AI Assistant
                  </h1>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Academic RAG
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Institution approved knowledge engine for {user.name} ({user.role.toUpperCase()})
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>New Chat</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-16 space-y-6">
          {messages.length === 0 ? (
            /* Welcome Empty State with Action Starter Cards */
            <div className="mx-auto max-w-3xl pt-4 pb-8 animate-in fade-in duration-300">
              <div className="text-center mb-8">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0B2545] via-[#134074] to-[#0284C7] text-white shadow-xl shadow-sky-950/20 mb-4 ring-4 ring-sky-50">
                  <Bot size={34} />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                  Hi {user.name.split(" ")[0]}! What can I help you with today?
                </h2>
                <p className="mt-2 text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  I answer strictly using your institution's verified timetable, attendance records, lecture notes, assignments, announcements, and circulars.
                </p>
              </div>

              {/* Grid of Prompt Starter Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {PROMPT_STARTERS.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s.query)}
                      className={`flex flex-col items-start text-left p-3.5 rounded-2xl border bg-gradient-to-b ${s.color} hover:scale-[1.02] hover:shadow-md transition-all duration-200 cursor-pointer`}
                    >
                      <div className="p-2 rounded-xl bg-white shadow-xs mb-2">
                        <Icon size={16} />
                      </div>
                      <span className="font-bold text-xs text-slate-900 block">{s.title}</span>
                      <span className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-tight">
                        "{s.query}"
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Conversation Messages */
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m._id || idx}
                    className={`flex items-start gap-3.5 ${
                      isUser ? "justify-end" : "justify-start"
                    } animate-in fade-in slide-in-from-bottom-2 duration-200`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0B2545] to-[#0284C7] text-white shadow-sm mt-0.5">
                        <Bot size={16} />
                      </div>
                    )}

                    <div
                      className={`relative group max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                        isUser
                          ? "bg-gradient-to-r from-[#0C2340] to-[#123962] text-white font-medium"
                          : "bg-white text-slate-900 border border-slate-200/90 shadow-sm"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      ) : (
                        <div>
                          <MarkdownRenderer content={m.text} />

                          {/* Sources Used Badge */}
                          {m.sourcesUsed && m.sourcesUsed.length > 0 && (
                            <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck size={11} className="text-emerald-500" />
                                Verified Grounding:
                              </span>
                              {m.sourcesUsed.map((src, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80 text-[10px] font-semibold"
                                >
                                  {src}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Toolbar on Assistant Message */}
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>Univo Academic Assistant</span>
                            <button
                              onClick={() => copyToClipboard(m._id || idx, m.text)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-600 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-50"
                              title="Copy response"
                            >
                              {copiedId === (m._id || idx) ? (
                                <>
                                  <CheckCheck size={12} className="text-emerald-500" />
                                  <span className="text-emerald-600 font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Waiting / Generating Telemetry Card */}
              {busy && (
                <div className="flex items-start gap-3.5 justify-start animate-in fade-in duration-200">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0B2545] to-[#0284C7] text-white shadow-sm">
                    <Bot size={16} />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-2xl bg-white border border-sky-200/80 px-4 py-3 shadow-xs">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-sky-600 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-sky-700 animate-bounce" />
                    </div>
                    <span className="text-xs font-semibold text-sky-900">
                      Querying verified institutional records & timetable...
                    </span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* 3. Bottom Input Box & Disclaimer */}
        <div className="border-t border-slate-200/90 bg-white px-4 py-3 md:px-8 lg:px-16">
          <div className="mx-auto max-w-3xl">
            {/* Quick Follow-up Pills when in conversation */}
            {messages.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Quick Query:
                </span>
                {PROMPT_STARTERS.slice(0, 4).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.query)}
                    className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}

            {/* Input Composer Field */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-end rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm focus-within:border-sky-600 focus-within:ring-2 focus-within:ring-sky-100 transition-all"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about timetable, attendance, assignments, notes, or circulars..."
                className="w-full resize-none bg-transparent px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none max-h-36 leading-relaxed"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold transition-all cursor-pointer ${
                  input.trim() && !busy
                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/30 hover:from-sky-500 hover:to-blue-500 hover:scale-105 active:scale-95"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
                title="Send message (Enter)"
              >
                <Send size={16} />
              </button>
            </form>

            <p className="mt-2 text-center text-[10px] text-slate-400">
              Univo AI answers strictly using institution-approved academic data.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
