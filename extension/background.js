// Grocery Buddy background service worker
// Listens for external/internal messages to set the pending cart

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === 'SET_CART') {
    chrome.storage.local.set({ pendingCart: message.products }, () => {
      if (message.siteUrl) {
        chrome.tabs.create({ url: message.siteUrl });
      }
      sendResponse({ success: true });
    });
    return true; // keep the message channel open for async response
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === 'SET_CART') {
    chrome.storage.local.set({ pendingCart: message.products }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
