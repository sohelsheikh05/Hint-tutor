// Copy content from canvas: server.js
import express from "express";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// In-memory session store (for dev/demo). For production, swap with Redis.
const SESSIONS = new Map();

// Config from .env
const LLM_API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = process.env.LLM_API_KEY;
const MODEL = process.env.MODEL || "gpt-4o-mini";
const PORT = process.env.PORT || 3000;

if (!LLM_API_KEY) {
  console.warn("[HintTutor] WARNING: LLM_API_KEY is not set. Set it in server/.env");
}

/**
 * Call the LLM (OpenAI-style chat endpoint).
 * Adjust this if you use a different provider.
 */
async function callLLM(messages, maxTokens = 256, temperature = 0.7) {
  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("[HintTutor] LLM error:", res.status, txt);
    throw new Error(`LLM error: ${res.status} ${txt}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content");
  }
  return content;
}

/**
 * POST /start
 * Body: { question: string }
 *
 * Starts a new hint session for the given question.
 * Returns: { sessionId, hint }
 */
app.post("/start", async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'question' in body" });
    }

    const sessionId = uuidv4();

    const systemPrompt = `
You are HintTutor, a step-by-step tutor.
The user wants to solve the problem themselves, and only wants one hint at a time.
RULES:
- Provide exactly ONE short, focused hint now.
- Do NOT give the full solution.
- Prefer a Socratic style (ask guiding questions).
- Keep the hint to 1–3 sentences.
`;

    const messages = [
      { role: "system", content: systemPrompt.trim() },
      {
        role: "user",
        content: `Problem:\n${question}\n\nThe user wants to start hint-by-hint mode. Give the first hint only.`,
      },
    ];

    const firstHint = await callLLM(messages, 200);

    // Store session
    SESSIONS.set(sessionId, {
      question,
      history: [...messages, { role: "assistant", content: firstHint }],
      hintIndex: 1,
    });

    return res.json({ sessionId, hint: firstHint });
  } catch (err) {
    console.error("[HintTutor] /start error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /session/:id/next
 * Body: { userAttempt: string }
 *
 * Sends user's attempt + history to the LLM and gets the next hint.
 * Returns: { hint, done }
 */
app.post("/session/:id/next", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { userAttempt } = req.body || {};

    const session = SESSIONS.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Append user's attempt to history
    session.history.push({
      role: "user",
      content: `User attempt / reasoning:\n${userAttempt || "(no text)"}\n\nRespond with the next hint.`,
    });

    const systemPrompt = `
You are HintTutor.
The user is trying to solve the problem step by step.
RULES:
- Analyze the user's latest attempt.
- If they are partially correct, acknowledge briefly and push them gently to the next step.
- If they are off track, nudge them back without revealing the full solution.
- Provide EXACTLY ONE short, clear hint (1–3 sentences).
- Do NOT dump the full solution.
- If the user has clearly solved the problem completely, respond with "DONE" plus a very short confirmation.
`;

    const messages = [{ role: "system", content: systemPrompt.trim() }, ...session.history];

    const hint = await callLLM(messages, 250);

    session.history.push({ role: "assistant", content: hint });
    session.hintIndex += 1;

    // Simple heuristic: if model says DONE or too many hints, mark done
    const done =
      hint.toLowerCase().includes("done") ||
      session.hintIndex > 12; // safety cap – you can tune this

    SESSIONS.set(sessionId, session);

    return res.json({ hint, done });
  } catch (err) {
    console.error("[HintTutor] /session/:id/next error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /session/:id/solution
 *
 * Asks the LLM for a full solution based on the conversation so far.
 * Returns: { solution }
 */
app.get("/session/:id/solution", async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = SESSIONS.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const systemPrompt = `
You are HintTutor.
The user has now asked for the full solution to the problem.
Provide:
- a clear explanation of the reasoning
- if appropriate, clean and correct code
- keep it concise but complete
No need to hide any steps now.
`;

    const messages = [{ role: "system", content: systemPrompt.trim() }, ...session.history];

    const solution = await callLLM(messages, 1024);

    // Optionally delete session when done
    SESSIONS.delete(sessionId);

    return res.json({ solution });
  } catch (err) {
    console.error("[HintTutor] /session/:id/solution error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /session/:id
 *
 * Debug/info endpoint: returns the question and last hint for a session.
 * Returns: { question, lastHint }
 */
app.get("/session/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = SESSIONS.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const lastMsg = session.history[session.history.length - 1];
  return res.json({
    question: session.question,
    lastHint: lastMsg?.content || null,
  });
});

app.listen(PORT, () => {
  console.log(`HintTutor mediator running on http://localhost:${PORT}`);
});
