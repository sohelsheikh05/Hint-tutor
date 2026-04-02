const API_BASE = "http://localhost:3000"; 
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


  await setStorage({ hintSessionId: null }); 
  await startNewSession(lastSelection, hintEl);
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


document.getElementById("nextHint")?.addEventListener("click", async () => {
  const { hintSessionId } = await getStorage(["hintSessionId"]);
  const answerEl = document.getElementById("answer");
  const hintEl = document.getElementById("hint");
  const btn = document.getElementById("nextHint");
  
  if (!hintSessionId) {
    hintEl.innerText = "No active session. Please select some text and run the extension again.";
    return;
  }
  
 
  const userAttempt = answerEl.value.trim();
  
  btn.classList.add("is-loading");
  hintEl.innerText = "Thinking...";
  
  try {
    const res = await fetch(`${API_BASE}/session/${hintSessionId}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAttempt }),
    });

    if (res.ok) {
      const json = await res.json();
      hintEl.innerText = json.hint || "—";
      
      answerEl.value = ""; 
      
      if (json.done) {
        hintEl.innerText += "\n\n(Tutor says you are all done!)";
      }
    } else {
      hintEl.innerText = "Error getting next hint from the server.";
    }
  } catch (e) {
    console.error(e);
    hintEl.innerText = "Cannot reach backend server.";
  } finally {
    btn.classList.remove("is-loading");
  }
});

document.getElementById("getSolution")?.addEventListener("click", async () => {
  const { hintSessionId } = await getStorage(["hintSessionId"]);
  const hintEl = document.getElementById("hint");
  const btn = document.getElementById("getSolution");
  
  if (!hintSessionId) {
    hintEl.innerText = "No active session.";
    return;
  }
  
  btn.classList.add("is-loading");
  hintEl.innerText = "Generating full detailed solution...";
  
  try {
    
    const res = await fetch(`${API_BASE}/session/${hintSessionId}/solution`);

    if (res.ok) {
      const json = await res.json();
      hintEl.innerText = json.solution || "—";
      
    } else {
      hintEl.innerText = "Error getting full solution from the server.";
    }
  } catch (e) {
    console.error(e);
    hintEl.innerText = "Cannot reach backend server.";
  } finally {
    btn.classList.remove("is-loading");
  }
});


init();
