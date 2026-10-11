import { useEffect, useRef, useState } from "react";
import { Bold, CornerUpLeft, Italic, Search, Send, Smile, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "./ui";
import { useAuth } from "../context/AuthContext";

const EMOJIS = ["👍", "❤️", "🎉", "🙏"];

function MessageBubble({ msg, mine, onReact, onReply, canReact, canReply, userId }) {
  const [showReactions, setShowReactions] = useState(false);
  const reactions = Object.entries(msg.reactions || {}).filter(([, ids]) => ids.length > 0);
  return (
    <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar name={msg.sender?.name} />
      <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-bold text-slate-700">{msg.sender?.name}</span>
          <span className="capitalize">{msg.sender?.role}</span>
          <span>{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</span>
        </div>
        <div
          style={mine ? { backgroundColor: "var(--portal-primary)" } : {}}
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
            mine ? "text-white font-normal" : "bg-slate-100 text-slate-800 border border-slate-200/60"
          }`}
        >
          {msg.replyTo && (
            <div className={`mb-2 rounded-lg border-l-2 px-2.5 py-1 text-xs ${mine ? "border-white/50 bg-black/15 text-white/90" : "border-slate-400 bg-white/70 text-slate-600"}`}>
              <span className="font-bold">{msg.replyTo.sender?.name || "Message"}</span>
              <p className="truncate opacity-90">{msg.replyTo.text}</p>
            </div>
          )}
          {msg.text.split("\n").map((line, lineIndex) => (
            <span key={lineIndex}>
              {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, partIndex) => {
                if (part.startsWith("**") && part.endsWith("**")) return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                if (part.startsWith("*") && part.endsWith("*")) return <em key={partIndex}>{part.slice(1, -1)}</em>;
                return part;
              })}
              {lineIndex < msg.text.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {reactions.map(([emoji, ids]) => (
            <button
              key={emoji}
              onClick={() => canReact && onReact(msg._id, emoji)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-transform active:scale-95 ${
                ids.includes(userId)
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {emoji} {ids.length}
            </button>
          ))}
          {canReact && (
            <div className="group relative">
              <button
                type="button"
                aria-label="Choose a reaction"
                aria-expanded={showReactions}
                onClick={() => setShowReactions((shown) => !shown)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <Smile size={14} />
              </button>
              {showReactions && (
                <div className="absolute bottom-full left-0 z-10 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => { onReact(msg._id, e); setShowReactions(false); }} className="rounded-full px-1.5 py-0.5 hover:bg-slate-100 transition-transform hover:scale-125">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {canReply && (
            <button
              type="button"
              title="Reply to message"
              aria-label="Reply to message"
              onClick={() => onReply(msg)}
              className="btn-reply"
            >
              <CornerUpLeft size={13} />
              <span>Reply</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatThread({
  chat,
  canPost = true,
  canReact = true,
  canReply = false,
  placeholder = "Type a message...",
  readOnlyNote = "You can read and react to messages in this group.",
  headerTitle = null,
  headerSubtitle = null,
  showSearchToggle = true,
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage(text.trim(), replyTo?._id);
      setText("");
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  function applyFormat(marker) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = text.slice(start, end);
    const replacement = selected ? `${marker}${selected}${marker}` : `${marker}${marker}`;
    const nextText = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
    setText(nextText);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = selected ? start + replacement.length : start + marker.length;
      input.setSelectionRange(cursor, selected ? cursor : cursor + marker.length);
    });
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  const displayedMessages = searchQuery.trim()
    ? chat.messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chat.messages;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top Header Row with Title and Search Icon */}
      {(headerTitle || showSearchToggle) && (
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1 mb-1">
          <div>
            {headerTitle ? (
              <>
                <p className="text-sm font-bold text-slate-800 leading-snug">{headerTitle}</p>
                {headerSubtitle && <p className="text-[11px] text-slate-400">{headerSubtitle}</p>}
              </>
            ) : <span />}
          </div>
          {showSearchToggle && (
            <div className="flex items-center gap-2">
              {showSearch ? (
                <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
                  <Search size={14} className="absolute left-2.5 text-slate-400" />
                  <input
                    autoFocus
                    className="input-field !py-1 !pl-8 !pr-7 text-xs w-44 sm:w-56"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  title="Search messages"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <Search size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {chat.loading && <p className="text-center text-sm text-navy-400">Loading messages...</p>}
        {!chat.loading && chat.messages.length === 0 && (
          <p className="py-10 text-center text-sm text-navy-400">No messages yet.</p>
        )}
        {!chat.loading && chat.messages.length > 0 && searchQuery.trim() && displayedMessages.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400 font-medium">No messages found matching &quot;{searchQuery}&quot;</p>
        )}
        {displayedMessages.map((m) => (
          <MessageBubble
            key={m._id}
            msg={m}
            mine={m.sender?._id === user.id || m.sender === user.id}
            onReact={chat.react}
            onReply={setReplyTo}
            canReact={canReact}
            canReply={canReply}
            userId={user.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <form onSubmit={submit} className="border-t border-slate-200/80 pt-3">
          {canReply && replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <CornerUpLeft size={14} className="shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate"><strong>{replyTo.sender?.name}</strong>: {replyTo.text}</span>
              <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
            </div>
          )}
          <div className="mb-2 flex gap-1">
            <button type="button" aria-label="Bold" title="Bold" onClick={() => applyFormat("**")} className="btn-ghost !p-2"><Bold size={16} /></button>
            <button type="button" aria-label="Italic" title="Italic" onClick={() => applyFormat("*")} className="btn-ghost !p-2"><Italic size={16} /></button>
          </div>
          <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            onKeyDown={handleKeyDown}
            className="input-field min-h-11 resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
          <button className="btn-primary" disabled={sending || !text.trim()}>
            <Send size={16} />
          </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-slate-200/80 pt-3 text-center text-xs text-slate-400">{readOnlyNote}</p>
      )}
    </div>
  );
}
