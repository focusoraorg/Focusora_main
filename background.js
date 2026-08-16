c// 3. background.js
const blockedSites = ["youtube.com", "facebook.com", "instagram.com"];

function isBlocked(url) {
  return blockedSites.some(site => url.includes(site));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ distractionCount: 0 });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && isBlocked(tab.url)) {
    chrome.storage.local.get("distractionCount", data => {
      const newCount = (data.distractionCount || 0) + 1;
      chrome.storage.local.set({ distractionCount: newCount });
      chrome.notifications.create({
        type: "basic",
        iconUrl: "images/background.png",
        title: "🚫 Distraction Alert",
        message: `You've been distracted ${newCount} time(s) today.`
      });
    });
  }
});
chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Focusora installed.");
  chrome.storage.local.set({ distractionCount: 0 });
});

// Listen for rule matches
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  // Increment count in local storage
  chrome.storage.local.get(["distractionCount"], (result) => {
    const newCount = (result.distractionCount || 0) + 1;
    chrome.storage.local.set({ distractionCount: newCount }, () => {
      console.log("📈 Distraction count updated:", newCount);
    });
  });
});
