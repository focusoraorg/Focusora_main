// content.js — Focusora content script
// Injected into all pages. Shows a non-intrusive floating "focus mode active"
// badge when a focus session is running. Removed cleanly when session ends.

(function () {
  "use strict";

  const BADGE_ID = "focusora-focus-badge";
  let checkInterval = null;
  let sessionEndsAt = null;
  let tickInterval = null;

  function formatCountdown(endsAt) {
    const ms = Math.max(0, endsAt - Date.now());
    const totalSec = Math.round(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function createBadge(endsAt) {
    if (document.getElementById(BADGE_ID)) return;

    sessionEndsAt = endsAt;

    const badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.setAttribute("data-focusora", "true");
    badge.innerHTML = `
      <span style="font-size:13px;line-height:1" aria-hidden="true">🎯</span>
      <span style="font-size:12px;font-weight:600;font-family:Manrope,Inter,sans-serif;letter-spacing:0.02em" id="focusora-badge-label">Focusing</span>
      <span style="font-size:11px;font-weight:700;font-family:monospace;opacity:0.85;min-width:38px;text-align:right" id="focusora-badge-timer"></span>
      <button id="focusora-badge-close" style="
        background:none;border:none;color:inherit;cursor:pointer;
        font-size:13px;padding:0;line-height:1;margin-left:2px;opacity:0.55;
        transition:opacity 0.15s
      " title="Hide badge" aria-label="Hide Focusora badge">×</button>
    `;

    Object.assign(badge.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      gap: "7px",
      padding: "8px 14px 8px 12px",
      background: "linear-gradient(135deg, #2B6E64, #1F534B)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "999px",
      color: "#ffffff",
      boxShadow: "0 8px 28px rgba(43,110,100,0.45), 0 2px 8px rgba(0,0,0,0.15)",
      fontSize: "13px",
      fontFamily: "Manrope, -apple-system, sans-serif",
      userSelect: "none",
      cursor: "default",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      opacity: "0",
      transform: "translateY(8px)"
    });

    document.body.appendChild(badge);

    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        badge.style.opacity = "1";
        badge.style.transform = "translateY(0)";
      });
    });

    // Start countdown tick
    if (endsAt) {
      updateBadgeTimer();
      tickInterval = setInterval(updateBadgeTimer, 1000);
    }

    // Close button
    const closeBtn = document.getElementById("focusora-badge-close");
    if (closeBtn) {
      closeBtn.addEventListener("mouseenter", () => { closeBtn.style.opacity = "1"; });
      closeBtn.addEventListener("mouseleave", () => { closeBtn.style.opacity = "0.55"; });
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeBadge();
        // Don't re-show for this page load
        if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
      });
    }
  }

  function updateBadgeTimer() {
    const timerEl = document.getElementById("focusora-badge-timer");
    if (!timerEl || !sessionEndsAt) return;
    timerEl.textContent = formatCountdown(sessionEndsAt);
    if (Date.now() >= sessionEndsAt) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function removeBadge() {
    const badge = document.getElementById(BADGE_ID);
    if (badge) {
      badge.style.opacity = "0";
      badge.style.transform = "translateY(8px)";
      setTimeout(() => badge.remove(), 320);
    }
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    sessionEndsAt = null;
  }

  function checkSessionState() {
    try {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
        if (chrome.runtime.lastError) {
          // Extension context invalidated — clean up
          removeBadge();
          if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
          return;
        }
        const state = res?.state;
        const isFocusing = state?.timer?.status === "focus";
        const badgeExists = !!document.getElementById(BADGE_ID);

        if (isFocusing && !badgeExists) {
          createBadge(state.timer.endsAt);
        } else if (isFocusing && badgeExists && state.timer.endsAt) {
          // Update endsAt in case it changed
          sessionEndsAt = state.timer.endsAt;
        } else if (!isFocusing && badgeExists) {
          removeBadge();
        }
      });
    } catch (e) {
      removeBadge();
      if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
    }
  }

  // Only run if the page is not an extension page itself
  if (!window.location.href.startsWith("chrome-extension://")) {
    checkSessionState();
    checkInterval = setInterval(checkSessionState, 5000);
  }

  // Listen for state broadcast from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATE") {
      checkSessionState();
    }
  });
})();
