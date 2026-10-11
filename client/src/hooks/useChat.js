import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";

// kind: "group" | "subject" | "direct"
// id: groupId | subjectId | direct room string
// fetchUrl / postUrl: API paths (postUrl defaults to fetchUrl)
export function useChat({ kind, id, fetchUrl, postUrl, readUrl }) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!fetchUrl) return;
    setLoading(true);
    api
      .get(fetchUrl)
      .then((res) => {
        setMessages(res.data.messages || []);
        if (readUrl) {
          api.post(readUrl).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [fetchUrl, readUrl]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit(`${kind}:join`, id);

    const onNew = (msg) => {
      const belongs =
        (kind === "group" && msg.group === id) ||
        (kind === "subject" && msg.subject === id) ||
        (kind === "direct" && msg.room === id);
      if (belongs) {
        setMessages((prev) => [...prev, msg]);
        if (readUrl) api.post(readUrl).catch(() => {});
      }
    };
    const onReaction = (msg) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    };

    socket.on("message:new", onNew);
    socket.on("message:reaction", onReaction);
    return () => {
      socket.emit(`${kind}:leave`, id);
      socket.off("message:new", onNew);
      socket.off("message:reaction", onReaction);
    };
  }, [socket, id, kind, readUrl]);

  async function sendMessage(text, replyTo) {
    const res = await api.post(postUrl || fetchUrl, { text, replyTo: replyTo || undefined });
    // socket broadcast will also deliver this to us; append optimistically
    // only if the socket round-trip hasn't already added it
    setMessages((prev) =>
      prev.some((m) => m._id === res.data.message._id) ? prev : [...prev, res.data.message]
    );
  }

  async function react(messageId, emoji) {
    const response = await api.post(`/groups/messages/${messageId}/react`, { emoji });
    setMessages((prev) => prev.map((message) => message._id === response.data.message._id ? response.data.message : message));
  }

  return { messages, loading, sendMessage, react, reload: load };
}
