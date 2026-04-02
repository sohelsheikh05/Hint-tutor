import express from "express";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { OpenRouter } from "@openrouter/sdk";
import cors from "cors";

dotenv.config();

const app = express();


app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || "openai/gpt-4o-mini";




if (!process.env.OPENROUTER_API_KEY) {
  console.error(" OPENROUTER_API_KEY missing in .env");
  process.exit(1);
}




const SESSIONS = new Map();
const MAX_CONTEXT_MESSAGES = 10; 


function pruneHistory(history) {
  if (history.length > MAX_CONTEXT_MESSAGES + 2) {
    
    return [
      history[0], 
      history[1], 
      ...history.slice(-MAX_CONTEXT_MESSAGES)
    ];
  }
  return history;
}


async function callLLM(messages, session, maxTokens = 300) {
  const prunedMessages = pruneHistory(messages);
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-OpenRouter-Title": "HintTutor",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: prunedMessages,
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", response.status, errorText);
      throw new Error(`OpenRouter API failed with status ${response.status}`);
    }

    const completion = await response.json();
    
  
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error("Invalid response format from OpenRouter.");
    }

    const content = completion.choices[0].message.content;
    const usage = completion.usage || { total_tokens: 0 };
    
 
    if (session) {
      session.tokensUsed += usage.total_tokens || 0;
    }

    return { content, usage };
  } catch (error) {
    console.error("LLM API Call Error:", error);
    throw new Error("Failed to fetch response from language model.");
  }
}


app.post("/start", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "A valid question string is required." });
    }

    const sessionId = uuidv4();
    const systemPrompt = `
You are HintTutor.

Rules:
- Give exactly ONE hint
- Do NOT give the full solution
- Ask guiding questions
- Keep hints short (1-3 sentences)
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Problem:\n${question}` }
    ];

    
    const sessionRecord = {
      id: sessionId,
      question,
      history: messages,
      hintIndex: 1,
      tokensUsed: 0,
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    SESSIONS.set(sessionId, sessionRecord);

    const { content: firstHint, usage } = await callLLM(messages, sessionRecord, 300);

    sessionRecord.history.push({ role: "assistant", content: firstHint });

    res.json({
      sessionId,
      hint: firstHint,
      tokensUsed: sessionRecord.tokensUsed,
      recentUsage: usage
    });

  } catch (err) {
    console.error("Start Session Error:", err.message);
    res.status(500).json({ error: "Server error setting up the session." });
  }
});


app.post("/session/:id/next", async (req, res) => {
  try {
   
    const session = SESSIONS.get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: "Session not found or expired." });
    }
    
    session.lastActive = Date.now();
    const { userAttempt } = req.body;

    if (userAttempt) {
      session.history.push({
        role: "user",
        content: `User attempt:\n${userAttempt}`
      });
    }

    const { content: hint, usage } = await callLLM(session.history, session, 300);
    
    session.history.push({ role: "assistant", content: hint });
    session.hintIndex++;

    const done = hint.toLowerCase().includes("done") || session.hintIndex > 10;

    res.json({
      hint,
      done,
      tokensUsed: session.tokensUsed,
      recentUsage: usage
    });

  } catch (err) {
    console.error("Next Hint Error:", err.message);
    res.status(500).json({ error: "Server error while fetching the next hint." });
  }
});


app.get("/session/:id/solution", async (req, res) => {
  try {
    const session = SESSIONS.get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: "Session not found or expired." });
    }
    
    session.lastActive = Date.now();

   
    if (session.history.length > 0 && session.history[0].role === "system") {
      session.history[0].content = `You are an expert technical tutor. 
The user has requested the full solution and you MUST provide it. 
From this point forward, ignore the previous rule about "only providing hints". 
You are now permitted to provide complete code solutions, translations (e.g. Java, Python), and direct answers.`;
    }

    session.history.push({ 
      role: "user", 
      content: "I am completely stuck. Please provide the full, clear solution to the problem." 
    });

    
    const { content: solution, usage } = await callLLM(session.history, session, 1500);

    
    session.history.push({
      role: "assistant",
      content: solution
    });
    session.hintIndex++;

    res.json({ 
      solution, 
      finalTokensUsed: session.tokensUsed,
      recentUsage: usage 
    });

  } catch (err) {
    console.error("Solution Retrieval Error:", err.message);
    res.status(500).json({ error: "Server error retrieving the full solution." });
  }
});


app.get("/session/:id", (req, res) => {
  const session = SESSIONS.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  const assistantMsgs = session.history.filter(m => m.role === "assistant");
  const lastHint = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].content : null;

  res.json({
    question: session.question,
    lastHint,
    hintCount: session.hintIndex,
    tokensUsed: session.tokensUsed
  });
});


setInterval(() => {
  const now = Date.now();
  for (const [id, session] of SESSIONS.entries()) {
    if (now - session.lastActive > 1000 * 60 * 60) { 
      SESSIONS.delete(id);
    }
  }
}, 1000 * 60 * 60);

app.listen(PORT, () => {
  console.log(` HintTutor running on http://localhost:${PORT}`);
 
});