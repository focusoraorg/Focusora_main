/**
 * Focusora Extension Integration
 * This script handles the integration between the Focusora website and Chrome extension
 */

// Check if the extension is installed
function checkExtensionInstalled() {
  return new Promise((resolve) => {
    // Try to communicate with the extension
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage(
          'focusora-extension-id', // Replace with actual extension ID after publishing
          { action: 'checkInstalled' },
          (response) => {
            if (response && response.installed) {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
        
        // If no response within 500ms, assume extension is not installed
        setTimeout(() => resolve(false), 500);
      } catch (error) {
        console.log('Extension communication error:', error);
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}

// Get extension data for the dashboard
async function getExtensionData() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage(
          'focusora-extension-id', // Replace with actual extension ID after publishing
          { action: 'getDashboardData' },
          (response) => {
            if (response && response.data) {
              resolve(response.data);
            } else {
              resolve(null);
            }
          }
        );
        
        // If no response within 1000ms, resolve with null
        setTimeout(() => resolve(null), 1000);
      } catch (error) {
        console.log('Extension data retrieval error:', error);
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
}

// Update dashboard with extension data
async function updateDashboardWithExtensionData() {
  const extensionInstalled = await checkExtensionInstalled();
  
  // Get extension installation section
  const extensionSection = document.getElementById('extension-section');
  if (!extensionSection) return;
  
  if (extensionInstalled) {
    // Extension is installed, get data and update dashboard
    const extensionData = await getExtensionData();
    
    // Update extension section to show it's installed
    extensionSection.innerHTML = `
      <div class="extension-installed">
        <div class="extension-status">
          <i class="fas fa-check-circle"></i>
          <span>Chrome Extension Installed</span>
        </div>
        <button id="open-extension-btn" class="btn-primary">
          <i class="fas fa-external-link-alt"></i> Open Extension
        </button>
      </div>
    `;
    
    // Add event listener to open extension
    document.getElementById('open-extension-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage(
        'focusora-extension-id',
        { action: 'openPopup' }
      );
    });
    
    // If we have extension data, update the dashboard stats
    if (extensionData) {
      updateDashboardStats(extensionData);
    }
  } else {
    // Extension is not installed, show installation prompt
    extensionSection.innerHTML = `
      <div class="extension-not-installed">
        <div class="extension-info">
          <h3>Enhance Your Focus with Our Chrome Extension</h3>
          <p>Track your focus sessions directly in your browser, block distracting websites, and sync your progress with your Focusora account.</p>
          <ul class="extension-features">
            <li><i class="fas fa-clock"></i> Pomodoro Timer</li>
            <li><i class="fas fa-ban"></i> Website Blocker</li>
            <li><i class="fas fa-sync-alt"></i> Sync with Dashboard</li>
            <li><i class="fas fa-bell"></i> Focus Reminders</li>
          </ul>
        </div>
        <div class="extension-cta">
          <a href="https://chrome.google.com/webstore/detail/focusora-extension-id" target="_blank" class="btn-primary">
            <i class="fab fa-chrome"></i> Add to Chrome
          </a>
          <span class="extension-note">Free • Takes 30 seconds</span>
        </div>
      </div>
    `;
  }
}

// Update dashboard stats with extension data
function updateDashboardStats(extensionData) {
  // Update focus time stats
  const focusTimeElement = document.getElementById('focus-time-stat');
  if (focusTimeElement && extensionData.totalFocusTime) {
    const hours = Math.floor(extensionData.totalFocusTime / 3600);
    const minutes = Math.floor((extensionData.totalFocusTime % 3600) / 60);
    focusTimeElement.textContent = `${hours}h ${minutes}m`;
  }
  
  // Update sessions completed
  const sessionsElement = document.getElementById('sessions-completed-stat');
  if (sessionsElement && extensionData.sessionsCompleted) {
    sessionsElement.textContent = extensionData.sessionsCompleted;
  }
  
  // Update XP earned
  const xpElement = document.getElementById('xp-earned-stat');
  if (xpElement && extensionData.xp) {
    xpElement.textContent = `${extensionData.xp} XP`;
  }
  
  // Update level
  const levelElement = document.getElementById('user-level');
  if (levelElement && extensionData.level) {
    levelElement.textContent = `Level ${extensionData.level}`;
  }
  
  // Update blocked sites list if it exists
  const blockedSitesElement = document.getElementById('blocked-sites-list');
  if (blockedSitesElement && extensionData.blockedSites && extensionData.blockedSites.length > 0) {
    blockedSitesElement.innerHTML = '';
    extensionData.blockedSites.forEach(site => {
      const li = document.createElement('li');
      li.textContent = site;
      blockedSitesElement.appendChild(li);
    });
  }
}

// Listen for extension data updates
function listenForExtensionUpdates() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'dashboardDataUpdated' && message.data) {
        updateDashboardStats(message.data);
        sendResponse({ received: true });
      }
    });
  }
}

// Initialize extension integration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only run on dashboard page
  if (window.location.pathname.includes('dashboard')) {
    updateDashboardWithExtensionData();
    listenForExtensionUpdates();
  }
  
  // Add extension installation section to dashboard if it doesn't exist
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent && !document.getElementById('extension-section')) {
    const extensionSection = document.createElement('div');
    extensionSection.id = 'extension-section';
    extensionSection.className = 'dashboard-card';
    
    // Add loading state initially
    extensionSection.innerHTML = `
      <div class="extension-loading">
        <div class="spinner"></div>
        <span>Checking extension status...</span>
      </div>
    `;
    
    // Insert after the first dashboard card
    const firstCard = dashboardContent.querySelector('.dashboard-card');
    if (firstCard) {
      firstCard.parentNode.insertBefore(extensionSection, firstCard.nextSibling);
    } else {
      dashboardContent.prepend(extensionSection);
    }
    
    // Update with actual extension data
    updateDashboardWithExtensionData();
  }
});

// Export functions for use in other scripts
window.focusoraExtension = {
  checkExtensionInstalled,
  getExtensionData,
  updateDashboardWithExtensionData
};