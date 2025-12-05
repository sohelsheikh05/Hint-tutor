// Copy content from canvas: background.js
chrome.runtime.onInstalled.addListener(() => {
chrome.contextMenus.create({
id: "askHintTutor",
title: "Ask HintTutor",
contexts: ["selection"]
});
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
if (info.menuItemId === "askHintTutor" && info.selectionText) {
await chrome.storage.local.set({ lastSelection: info.selectionText });
chrome.tabs.sendMessage(tab.id, { type: "SHOW_HINT_UI", text: info.selectionText });
}
});