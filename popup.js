// popup.js

document.addEventListener("DOMContentLoaded", () => {
  // Theme toggle
  document.getElementById("themeToggle").onclick = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  };

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }

  // Save name
  document.getElementById("saveName").onclick = () => {
    const name = document.getElementById("nameInput").value;
    localStorage.setItem("userName", name);
  };

  // To-Do List
  document.getElementById("addTask").onclick = () => {
    const task = document.getElementById("taskInput").value;
    if (task) {
      const li = document.createElement("li");
      li.textContent = task;
      document.getElementById("taskList").appendChild(li);
      document.getElementById("taskInput").value = "";
    }
  };

  // Pomodoro Timer
  let time = 1500;
  let timer = null;
  const display = document.getElementById("timer");

  function updateTimer() {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}m: ${seconds.toString().padStart(2, '0')}s`;
  }
  updateTimer();

  document.getElementById("startTimer").onclick = () => {
    if (timer) return;
    timer = setInterval(() => {
      time--;
      updateTimer();
      if (time <= 0) {
        clearInterval(timer);
        timer = null;
        alert("Pomodoro session complete!");
      }
    }, 1000);
  };

  document.getElementById("resetTimer").onclick = () => {
    clearInterval(timer);
    timer = null;
    time = 1500;
    updateTimer();
  };

  // Wikipedia Search
  document.getElementById("wikiSearch").onclick = () => {
    const query = document.getElementById("wikiInput").value;
    if (query) {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
      chrome.tabs.create({ url });
    }
  };

  // Load and display distraction count
  const distractionDisplay = document.getElementById("distractionCount");
  chrome.storage.local.get("distractionCount", (data) => {
    distractionDisplay.textContent = data.distractionCount || 0;
  });

  // Listen for real-time updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_DISTRACTION_COUNT") {
      distractionDisplay.textContent = msg.count;
    }
  });
});
