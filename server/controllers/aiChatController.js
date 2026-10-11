const Anthropic = require("@anthropic-ai/sdk");
const AiConversation = require("../models/AiConversation");
const AiMessage = require("../models/AiMessage");
const Subject = require("../models/Subject");
const canAccessSubject = require("../utils/subjectAccess");
const {
  gatherAcademicContext,
  buildSystemAcademicContextPrompt,
  synthesizeAcademicResponse,
} = require("../utils/academicBrain");

let client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 3500 })
  : null;
let lastAnthropicErrorTime = 0;

// GET /api/ai-chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const list = await AiConversation.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ conversations: list });
  } catch (err) {
    res.status(500).json({ message: "Failed to load chat history", error: err.message });
  }
};

// POST /api/ai-chat/conversations
exports.createConversation = async (req, res) => {
  try {
    const title = (req.body.title || "New Chat").trim();
    const conv = await AiConversation.create({
      user: req.user._id,
      title,
    });
    res.status(201).json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: "Failed to create conversation", error: err.message });
  }
};

// GET /api/ai-chat/conversations/:id
exports.getConversation = async (req, res) => {
  try {
    const conv = await AiConversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conv) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const messages = await AiMessage.find({ conversation: conv._id }).sort({ createdAt: 1 });
    res.json({ conversation: conv, messages });
  } catch (err) {
    res.status(500).json({ message: "Failed to load conversation", error: err.message });
  }
};

// PATCH /api/ai-chat/conversations/:id
exports.updateConversation = async (req, res) => {
  try {
    const { title } = req.body;
    const conv = await AiConversation.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { title: title.trim() },
      { new: true }
    );
    if (!conv) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: "Failed to update conversation", error: err.message });
  }
};

// DELETE /api/ai-chat/conversations/:id
exports.deleteConversation = async (req, res) => {
  try {
    const conv = await AiConversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!conv) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    await AiMessage.deleteMany({ conversation: conv._id });
    res.json({ message: "Conversation deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete conversation", error: err.message });
  }
};

// LLM API Callers (Native fetch, zero dependencies)
async function callGeminiAPI(apiKey, systemPrompt, question) {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUSER QUESTION: ${question}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error: ${errText}`);
  }
  const data = await res.json();
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return txt || "";
}

async function callGroqAPI(apiKey, systemPrompt, question) {
  const models = [
    process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          max_tokens: 1500,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Groq model ${model} failed (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      const content = (choice?.content && choice.content.trim()) || (choice?.reasoning && choice.reasoning.trim()) || "";
      if (content) return content;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq models failed");
}

async function callOpenAIAPI(apiKey, systemPrompt, question) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API Error: ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// POST /api/ai-chat (or ask)
// Body: { question, conversationId?, subjectId? }
exports.ask = async (req, res) => {
  try {
    const { question, subjectId } = req.body;
    let { conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: "A question is required" });
    }

    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!(await canAccessSubject(req.user, subject))) {
        return res.status(403).json({ message: "You cannot ask questions about this subject" });
      }
    }

    // Find or create conversation
    let conv = null;
    if (conversationId) {
      conv = await AiConversation.findOne({ _id: conversationId, user: req.user._id });
    }

    if (!conv) {
      const cleanTitle = question.trim().replace(/\s+/g, " ");
      const words = cleanTitle.split(" ").slice(0, 6).join(" ");
      const title = words.length > 36 ? words.slice(0, 36) + "..." : words;
      conv = await AiConversation.create({
        user: req.user._id,
        title: title || "New Conversation",
      });
      conversationId = conv._id;
    }

    // Save user's question to message history
    const userMsg = await AiMessage.create({
      conversation: conv._id,
      user: req.user._id,
      role: "user",
      text: question.trim(),
    });

    // 1. Gather all verified institutional context
    const academicContext = await gatherAcademicContext(req.user, question, subjectId);

    let answerText = "";
    let sourcesUsed = [];
    let llmSuccess = false;
    let anthropicLowCredit = false;

    const academicPrompt = buildSystemAcademicContextPrompt(academicContext);
    const systemPrompt = [
      "You are Univo AI, the official institution-grounded campus co-pilot.",
      "You must strictly answer using ONLY the approved institution academic context provided below (Timetable, Attendance, Assignments, Announcements, Circulars, Resources, Buzz).",
      "Under NO circumstance invent information not present in the institutional records.",
      "Format your responses cleanly using markdown (bold headings, bullet points, concise tables where suitable).",
      "Be polite, direct, clear, and highly helpful to students and faculty.",
      `\n--- INSTITUTION APPROVED ACADEMIC DATA ---\n${academicPrompt}\n------------------------------------------`,
    ].join("\n");

    // 2. Try configured LLM providers in priority order:

    // 2A. Groq API (Ultra-Fast 500+ tokens/s & Free Tier - Llama 3.3 70B)
    if (!llmSuccess && process.env.GROQ_API_KEY) {
      try {
        const groqAnswer = await callGroqAPI(process.env.GROQ_API_KEY, systemPrompt, question.trim());
        if (groqAnswer && groqAnswer.trim()) {
          answerText = groqAnswer.trim();
          llmSuccess = true;
          sourcesUsed = ["Groq Llama 3.3 70B (Institution-Grounded RAG)"];
        }
      } catch (groqErr) {
        console.warn("Groq API call note:", groqErr.message);
      }
    }

    // 2B. Google Gemini (Free Tier / No credits needed)
    if (!llmSuccess && process.env.GEMINI_API_KEY) {
      try {
        const geminiAnswer = await callGeminiAPI(process.env.GEMINI_API_KEY, systemPrompt, question.trim());
        if (geminiAnswer && geminiAnswer.trim()) {
          answerText = geminiAnswer.trim();
          llmSuccess = true;
          sourcesUsed = ["Google Gemini AI (Institution-Grounded RAG)"];
        }
      } catch (geminiErr) {
        console.warn("Gemini API call note:", geminiErr.message);
      }
    }

    // 2B. OpenAI API
    if (!llmSuccess && process.env.OPENAI_API_KEY) {
      try {
        const openaiAnswer = await callOpenAIAPI(process.env.OPENAI_API_KEY, systemPrompt, question.trim());
        if (openaiAnswer && openaiAnswer.trim()) {
          answerText = openaiAnswer.trim();
          llmSuccess = true;
          sourcesUsed = ["OpenAI GPT-4o (Institution-Grounded RAG)"];
        }
      } catch (openaiErr) {
        console.warn("OpenAI API call note:", openaiErr.message);
      }
    }

    // 2C. Anthropic Claude
    const isCoolingOff = Date.now() - lastAnthropicErrorTime < 5 * 60 * 1000;
    if (!llmSuccess && client && !isCoolingOff) {
      try {
        const model = process.env.ANTHROPIC_MODEL === "claude-sonnet-4-6"
          ? "claude-3-5-sonnet-20241022"
          : process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

        const response = await client.messages.create({
          model,
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: question.trim() }],
        });

        answerText = response.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .filter(Boolean)
          .join("\n");

        if (answerText && answerText.trim()) {
          llmSuccess = true;
          sourcesUsed = ["Anthropic Claude (Institution-Grounded Database)"];
        }
      } catch (llmErr) {
        lastAnthropicErrorTime = Date.now();
        if (llmErr.status === 400 || (llmErr.message && llmErr.message.includes("credit balance is too low"))) {
          anthropicLowCredit = true;
          console.warn("[Anthropic AI] Credit balance is $0.00. Falling back to High-Precision Local Academic Engine.");
        } else {
          console.warn("[Anthropic AI] API call note:", llmErr.message);
        }
      }
    }

    // 3. Fallback: High-Precision Deterministic Academic Synthesizer
    if (!llmSuccess || !answerText) {
      const synthesized = synthesizeAcademicResponse(req.user, question, academicContext);
      answerText = synthesized.answer;
      sourcesUsed = synthesized.sources;

      if (anthropicLowCredit) {
        sourcesUsed.unshift("⚠️ Anthropic Balance $0.00 (Grounded by Univo Academic Engine)");
      }
    }

    // Save assistant message to conversation history
    const assistantMsg = await AiMessage.create({
      conversation: conv._id,
      user: req.user._id,
      role: "assistant",
      text: answerText,
      sourcesUsed,
    });

    // Update conversation timestamp
    conv.lastMessageAt = new Date();
    await conv.save();

    res.json({
      conversationId: conv._id,
      conversationTitle: conv.title,
      answer: answerText,
      sourcesUsed,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    });
  } catch (err) {
    console.error("AI Chat Controller Error:", err);
    res.status(500).json({
      message: "The AI Chat Bot encountered an unexpected error",
      error: err.message,
    });
  }
};
