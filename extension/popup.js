const API_BASE = "http://localhost:3000"; // or your deployed backend

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

function setStorage(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

async function init() {
  const { lastSelection, hintSessionId } = await getStorage([
    "lastSelection",
    "hintSessionId",
  ]);

  const questionEl = document.getElementById("question");
  const hintEl = document.getElementById("hint");

  if (!questionEl || !hintEl) return;

  if (!lastSelection) {
    questionEl.innerText =
      "No selection yet. Highlight text and right-click → Ask HintTutor.";
    return;
  }

  questionEl.innerText = lastSelection;

  // If no session yet -> start a new one
  if (!hintSessionId) {
    await startNewSession(lastSelection, hintEl);
    return;
  }

  // Try to resume existing session
  try {
    const res = await fetch(`${API_BASE}/session/${hintSessionId}`);

    if (res.ok) {
      const json = await res.json();
      hintEl.innerText = json.lastHint || "—";
    } else if (res.status === 404) {
      // Session missing on server -> start a fresh one
      console.log("Session not found on server, starting new session");
      await setStorage({ hintSessionId: null });
      await startNewSession(lastSelection, hintEl);
    } else {
      hintEl.innerText = "Error resuming session";
    }
  } catch (e) {
    console.error(e);
    hintEl.innerText = "Cannot reach backend. Is server running?";
  }
}

async function startNewSession(lastSelection, hintEl) {
  try {
    const res = await fetch(`${API_BASE}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: lastSelection }),
    });

    if (res.ok) {
      const j = await res.json();
      if (j.sessionId) {
        await setStorage({ hintSessionId: j.sessionId });
        hintEl.innerText = j.hint || "—";
      } else {
        hintEl.innerText = "Error: no session id from server.";
      }
    } else {
      hintEl.innerText = "Error starting session";
    }
  } catch (e) {
    console.error(e);
    hintEl.innerText = "Cannot reach backend. Is server running?";
  }
}

// keep the rest of your code (nextHint + getSolution handlers) the same
init();
