
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg.type === "SHOW_HINT_UI") {
showInlinePopup(msg.text);
}
});


function showInlinePopup(selectedText) {
const existing = document.getElementById("hinttutor-inline");
if (existing) existing.remove();

const div = document.createElement("div");
div.id = "hinttutor-inline";

div.style.position = "absolute";
div.style.zIndex = "2147483647";
div.style.background = "#1e293b"; 
div.style.color = "#f8fafc";
div.style.border = "1px solid #334155";
div.style.borderRadius = "8px";
div.style.padding = "10px 16px";
div.style.fontSize = "14px";
div.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
div.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)";
div.style.cursor = "pointer";
div.style.display = "flex";
div.style.alignItems = "center";
div.style.gap = "10px";
div.style.transition = "all 0.2s ease";
div.style.fontWeight = "500";


div.innerHTML = `
  <div style="
    width: 24px; height: 24px; 
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    border-radius: 6px; 
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; color: white;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">H</div>
  <span style="background: linear-gradient(135deg, #e0f2fe, #7dd3fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Question Sent! Click Extension.</span>
`;


div.onmouseenter = () => {
  div.style.transform = "translateY(-2px)";
  div.style.boxShadow = "0 12px 20px -3px rgba(59, 130, 246, 0.25)";
  div.style.borderColor = "#3b82f6";
};
div.onmouseleave = () => {
  div.style.transform = "translateY(0)";
  div.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)";
  div.style.borderColor = "#334155";
};

const selection = window.getSelection();
if (selection.rangeCount) {
  const range = selection.getRangeAt(0).getBoundingClientRect();

  div.style.left = `${window.scrollX + range.left + (range.width / 2) - 100}px`;
  div.style.top = `${window.scrollY + range.bottom + 12}px`;
} else {
  div.style.left = "20px";
  div.style.top = "20px";
}

div.onclick = (e) => {
  e.stopPropagation(); 
  div.innerHTML = '<span style="color:#60a5fa; font-weight: 600;">✓ Ready in Extension</span>';
  setTimeout(() => div.remove(), 1500);
};

document.body.appendChild(div);


setTimeout(() => {
  const el = document.getElementById("hinttutor-inline");
  if (el) el.remove();
}, 6000);
}