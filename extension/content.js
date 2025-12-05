// Copy content from canvas: content.js
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
div.style.zIndex = 2147483647;
div.style.background = "#fff";
div.style.border = "1px solid #ccc";
div.style.padding = "6px";
div.style.borderRadius = "6px";
div.style.fontSize = "12px";
div.innerText = "Open HintTutor popup";


const selection = window.getSelection();
if (selection.rangeCount) {
const range = selection.getRangeAt(0).getBoundingClientRect();
div.style.left = `${window.scrollX + range.left}px`;
div.style.top = `${window.scrollY + range.bottom + 6}px`;
} else {
div.style.left = "10px";
div.style.top = "10px";
}


div.onclick = () => {
chrome.storage.local.set({ lastSelection: selectedText });
// User should click extension icon to open popup.
};


document.body.appendChild(div);
setTimeout(() => {
const el = document.getElementById("hinttutor-inline");
if (el) el.remove();
}, 8000);
}