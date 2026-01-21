async function getTodaysData() {
  const todayStr = new Date().toISOString().split("T")[0];
  const allData = await chrome.storage.local.get(null);
  
  const dailyStats = {};

  Object.keys(allData).forEach(key => {
    // Only process keys like stats_2026-01-19_09
    if (key.startsWith(`stats_${todayStr}`)) {
      const hourData = allData[key];

      for (const category in hourData) {
        const sites = hourData[category].sites;
        for (const sKey in sites) {
          const siteEntry = sites[sKey];
          
          // Initialize if this is the first time we see this site today
          if (!dailyStats[sKey]) {
            dailyStats[sKey] = {
              title: siteEntry.title || "Unknown",
              seconds: 0,
              domain: sKey.replace(/_/g, '.') // Convert leetcode_com back to leetcode.com
            };
          }
          
          // Add up the seconds from this hour
          // Handle both old (number) and new (object) data formats
          const secondsToAdd = typeof siteEntry === 'object' ? siteEntry.seconds : siteEntry;
          dailyStats[sKey].seconds += secondsToAdd;
        }
      }
    }
  });

  return dailyStats;
}

async function renderAnalytics() {
  const stats = await getTodaysData();
  const listContainer = document.getElementById('tab-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  // Sort by seconds descending
  const sortedSites = Object.values(stats).sort((a, b) => b.seconds - a.seconds);

  sortedSites.forEach((site) => {
    const s = site.seconds;
    const displayTime = s > 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;

    const card = document.createElement('div');
    card.className = 'tab-card';
    card.innerHTML = `
      <div class="url-info">
        <strong style="display:block; color:#2c3e50;">${site.title}</strong>
        <span class="url-text">${site.domain}</span>
      </div>
      <span class="time-badge">${displayTime}</span>
    `;
    listContainer.appendChild(card);
  });
}