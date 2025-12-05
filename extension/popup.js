const API_BASE = "http://localhost:3000"; // change to your backend URL

// Helpers to use chrome.storage with async/await
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

// Initialize popup: show question + first hint (start or resume session)
async function init() {
  const { lastSelection, hintSessionId } = await getStorage([
    "lastSelection",
    "hintSessionId",
  ]);

  const questionEl = document.getElementById("question");
  const hintEl = document.getElementById("hint");

  if (!questionEl || !hintEl) {
    console.error("popup elements not found");
    return;
  }

  if (!lastSelection) {
    questionEl.innerText =
      "No selection yet. Highlight text and right-click → Ask HintTutor.";
    return;
  }

  questionEl.innerText = lastSelection;

  // If session already exists, resume
  if (hintSessionId) {
    try {
      const res = await fetch(`${API_BASE}/session/${hintSessionId}`);
      if (res.ok) {
        const json = await res.json();
        hintEl.innerText = json.lastHint || "—";
      } else {
        hintEl.innerText = "Error resuming session";
      }
    } catch (e) {
      console.error(e);
      hintEl.innerText = "Cannot reach backend. Is server running?";
    }
  } else {
    // Start new session for this question
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
}

// Next hint button handler
document.getElementById("nextHint").addEventListener("click", async () => {
  const { hintSessionId } = await getStorage(["hintSessionId"]);
  const answer = document.getElementById("answer").value.trim();
  const hintEl = document.getElementById("hint");

  if (!hintSessionId) {
    hintEl.innerText = "No active session. Highlight text and start first.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/session/${hintSessionId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAttempt: answer }),
    });

    if (res.ok) {
      const j = await res.json();
      hintEl.innerText = j.hint || "—";
      document.getElementById("answer").value = "";
      if (j.done) {
        hintEl.innerText +=
          "\n\n(You reached the end or asked for the full solution.)";
        await setStorage({ hintSessionId: null });
      }
    } else {
      hintEl.innerText = "Error getting next hint";
    }
  } catch (e) {
    console.error(e);
    hintEl.innerText = "Cannot reach backend. Is server running?";
  }
});

// Full solution button handler
document
  .getElementById("getSolution")
  .addEventListener("click", async () => {
    const { hintSessionId } = await getStorage(["hintSessionId"]);
    const hintEl = document.getElementById("hint");

    if (!hintSessionId) {
      hintEl.innerText = "No active session.";
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/session/${hintSessionId}/solution`,
        { method: "GET" }
      );
      if (res.ok) {
        const j = await res.json();
        hintEl.innerText = j.solution || "No solution available";
        await setStorage({ hintSessionId: null });
      } else {
        hintEl.innerText = "Error getting solution";
      }
    } catch (e) {
      console.error(e);
      hintEl.innerText = "Cannot reach backend. Is server running?";
    }
  });

// Run init when popup opens
init();
