// utils/blocker.js
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic declarativeNetRequest rule management.
// Rules are added ONLY during an active focus session and removed afterward.
// This makes blocking intentional and session-scoped — never always-on.
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_PAGE_URL = chrome.runtime.getURL("blocked/blocked.html");

/**
 * Convert a domain string into a DNR redirect rule object.
 * @param {string} domain  e.g. "youtube.com"
 * @param {number} id      Rule ID (must be unique integer)
 * @returns {chrome.declarativeNetRequest.Rule}
 */
function domainToRule(domain, id) {
  // Normalize domain: strip protocol, www, trailing slash
  const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return {
    id,
    priority: 100,
    action: {
      type: "redirect",
      redirect: { url: BLOCKED_PAGE_URL }
    },
    condition: {
      urlFilter: `||${clean}`,
      resourceTypes: ["main_frame"]
    }
  };
}

/**
 * Activate blocking rules for the given domain list.
 * All existing dynamic rules are removed first to avoid ID conflicts.
 * @param {string[]} blockList - Array of domain strings
 * @returns {Promise<void>}
 */
export async function activateBlockRules(blockList) {
  // First, remove all existing dynamic rules
  await removeAllBlockRules();

  if (!blockList || blockList.length === 0) return;

  const rules = blockList
    .filter(d => d && d.trim().length > 0)
    .map((domain, index) => domainToRule(domain.trim(), index + 1));

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: []
  });

  console.log(`[Focusora Blocker] Activated ${rules.length} block rules.`);
}

/**
 * Remove all active dynamic block rules.
 * Called when a session ends, is paused, or user turns off focus mode.
 * @returns {Promise<void>}
 */
export async function removeAllBlockRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  if (existingRules.length === 0) return;

  const idsToRemove = existingRules.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: idsToRemove
  });

  console.log(`[Focusora Blocker] Removed ${idsToRemove.length} block rules.`);
}

/**
 * Get the current list of blocked domains from active dynamic rules.
 * @returns {Promise<string[]>}
 */
export async function getActiveDomains() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map(r => {
    const filter = r.condition.urlFilter || "";
    return filter.replace(/^\|\|/, ""); // strip || prefix
  });
}

/**
 * Check if blocking is currently active.
 * @returns {Promise<boolean>}
 */
export async function isBlockingActive() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.length > 0;
}
