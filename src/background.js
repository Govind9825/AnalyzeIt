import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth/web-extension";
import {
  getFirestore,
  collection,
  getDocs,
  increment,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_apiKey,
  authDomain: process.env.VITE_authDomain,
  projectId: process.env.VITE_projectId,
  storageBucket: process.env.VITE_storageBucket,
  messagingSenderId: process.env.VITE_messagingSenderId,
  appId: process.env.VITE_appId,
  measurementId: process.env.VITE_measurementId
};

const DEFAULT_MAPPINGS = {
  "github.com": "Productive",
  "stackoverflow.com": "Productive",
  "docs.google.com": "Productive",
  "notion.so": "Productive",
  "vercel.com": "Productive",
  "linkedin.com": "Productive",
  "chatgpt.com": "Productive",
  "gemini.google.com": "Productive",
  "claude.ai": "Productive",
  "figma.com": "Productive",
  "slack.com": "Productive",
  "linear.app": "Productive",
  "medium.com": "Productive",
  "coursera.org": "Productive",
  "udemy.com": "Productive",
  "trello.com": "Productive",
  "asana.com": "Productive",
  "jira.atlassian.com": "Productive",
  "bitbucket.org": "Productive",
  "gitlab.com": "Productive",
  "replit.com": "Productive",
  "codepen.io": "Productive",
  "leetcode.com": "Productive",
  "codechef.com": "Productive",
  "hackerrank.com": "Productive",
  "overleaf.com": "Productive",
  "canva.com": "Productive",
  "lucidchart.com": "Productive",
  "notion.site": "Productive",
  "twitter.com": "Social Media",
  "x.com": "Social Media",
  "reddit.com": "Social Media",
  "instagram.com": "Social Media",
  "facebook.com": "Social Media",
  "tiktok.com": "Social Media",
  "threads.net": "Social Media",
  "pinterest.com": "Social Media",
  "discord.com": "Social Media",
  "web.whatsapp.com": "Social Media",
  "telegram.org": "Social Media",
  "tumblr.com": "Social Media",
  "snapchat.com": "Social Media",
  "quora.com": "Social Media",
  "youtube.com": "Streaming",
  "netflix.com": "Streaming",
  "twitch.tv": "Streaming",
  "primevideo.com": "Streaming",
  "disneyplus.com": "Streaming",
  "hulu.com": "Streaming",
  "soundcloud.com": "Streaming",
  "hotstar.com": "Streaming",
  "vimeo.com": "Streaming",
  "dailymotion.com": "Streaming",
  "chess.com": "Streaming",
  "google.com": "Utilities",
  "bing.com": "Utilities",
  "duckduckgo.com": "Utilities",
  "yahoo.com": "Utilities",
  "wikipedia.org": "Utilities",
  "amazon.com": "Utilities",
  "flipkart.com": "Utilities",
  "ebay.com": "Utilities",
  "mail.google.com": "Utilities",
  "outlook.live.com": "Utilities",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


let startTime = Date.now();
let lastTabTitle = "";
let lastTabUrl = "";
let userPreferences = {};


async function signInWithGoogle() {
  try {
    await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, resolve);
        } else {
          resolve();
        }
      });
    });

    const accessToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });

    const credential = GoogleAuthProvider.credential(null, accessToken);
    const res = await signInWithCredential(auth, credential);

    const cleanUser = {
      uid: res.user.uid,
      email: res.user.email,
      name: res.user.displayName,
      photo: res.user.photoURL,
    };

    await chrome.storage.local.set({ user: cleanUser });

    await setDoc(
      doc(db, "users", cleanUser.uid),
      { ...cleanUser, lastActive: serverTimestamp() },
      { merge: true }
    );

    const batch = writeBatch(db); 
    for (const [domain, category] of Object.entries(DEFAULT_MAPPINGS)) {
      const siteRef = doc(
        db,
        "users",
        cleanUser.uid,
        "site_preferences",
        domain.replace(/\./g, "_")
      );
      batch.set(siteRef, { category, domain, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();

    await loadUserPreferences();
    console.log("AnalyzeIt: Successfully signed in.");

  } catch (error) {
    console.error("AnalyzeIt Auth Error:", error);
  }
}

async function loadUserPreferences() {
  const storage = await chrome.storage.local.get("user");
  if (!storage.user?.uid) return;
  try {
    const snap = await getDocs(
      collection(db, "users", storage.user.uid, "site_preferences"),
    );
    const newPrefs = {};
    snap.forEach((d) => {
      if (d.data().domain) newPrefs[d.data().domain] = d.data().category;
    });
    userPreferences = newPrefs;
  } catch (e) {
    console.error(e);
  }
}

function getDynamicBrandName(domain) {
  if (domain.includes("localhost")) return "Localhost";
  const parts = domain.split(".");
  let brand =
    parts.length >= 3
      ? ["google", "amazon", "microsoft", "vercel", "github"].includes(
          parts[parts.length - 2],
        )
        ? parts[parts.length - 3]
        : parts[parts.length - 2]
      : parts[0];
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

let isUpdating = false;
const updateQueue = [];

async function updateStats(domain, rawTitle, time, date) {
  if (isUpdating) {
    return new Promise((resolve) => {
      updateQueue.push(() => updateStats(domain, rawTitle, time, date).then(resolve));
    });
  }

  isUpdating = true;

  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;
    const hourStr = date.getHours().toString().padStart(2, "0");
    
    const key = `stats_${localDateStr}_${hourStr}`;
    const storage = await chrome.storage.local.get(key);
    const hourstats = storage[key] || {};
    
    const category = userPreferences[domain] || DEFAULT_MAPPINGS[domain] || "Utilities";

    if (!hourstats[category]) {
      hourstats[category] = { total_category_time: 0, sites: {} };
    }

    hourstats[category].total_category_time += time;

    const siteKey = domain.replace(/\./g, "_");
    if (!hourstats[category].sites[siteKey]) {
      hourstats[category].sites[siteKey] = {
        seconds: 0,
        title: getDynamicBrandName(domain),
        domain: domain,
      };
    }
    hourstats[category].sites[siteKey].seconds += time;

    await chrome.storage.local.set({ [key]: hourstats });
    
    console.log(`📊 [Stored] ${domain}: +${time}s | Day: ${localDateStr}`);

  } catch (e) {
    console.error("Error in updateStats:", e);
  } finally {
    isUpdating = false;
    if (updateQueue.length > 0) {
      const nextUpdate = updateQueue.shift();
      nextUpdate();
    }
  }
}

async function updateTime() {
  const now = Date.now();
  const duration = Math.floor((now - startTime) / 1000);
  startTime = now;

  if (duration < 1) return;

  try {
    if (lastTabUrl && lastTabUrl.startsWith("http")) {
      const lastDomain = new URL(lastTabUrl).hostname.replace("www.", "");
      await updateStats(lastDomain, lastTabTitle, duration, new Date(now - duration * 1000));
    }

    const focusedWin = await chrome.windows.getLastFocused({ populate: true });
    
    const isAudible = focusedWin?.tabs?.some(t => t.audible) || false;

    const idleState = await new Promise(resolve => chrome.idle.queryState(300, resolve));

    if (focusedWin?.focused && (idleState === "active" || isAudible)) {
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: focusedWin.id
      });
      if (tab?.url?.startsWith("http")) {
        lastTabUrl = tab.url;
        lastTabTitle = tab.title || "";
      } else {
        lastTabUrl = "";
      }
    } else {
      lastTabUrl = "";
      lastTabTitle = "";
    }
  } catch (e) {
    console.error("Update Error:", e);
  }
}

async function syncDataToFirestore() {
  const allData = await chrome.storage.local.get(null);
  const storage = await chrome.storage.local.get("user");

  if (!storage.user?.uid) {
    console.warn("🔄 [Sync] Skipped: No user UID found.");
    return;
  }

  const statKeys = Object.keys(allData).filter((k) => k.startsWith("stats_"));
  const userUid = storage.user.uid;

  if (statKeys.length === 0) {
    // console.log("Empty sync: No local stats found to push.");
    return;
  }

  // console.log(`🚀 [Sync] Starting sync for ${statKeys.length} hourly buckets.`);

  for (const key of statKeys) {
    const keyParts = key.split("_");
    if (keyParts.length < 3) continue;

    const [, dateStr, hour] = keyParts;
    const hourData = allData[key];

    const firestoreUpdate = {
      lastSynced: serverTimestamp(),
    };

    // console.log(`📅 [Sync] Processing ${dateStr} at ${hour}:00...`);

    for (const cat in hourData) {
      const categoryTotal = hourData[cat].total_category_time || 0;
      if (categoryTotal <= 0) continue;

      let dailyField = "";
      if (cat === "Social Media") dailyField = "socialSeconds";
      else if (cat === "Utilities") dailyField = "utilitySeconds";
      else dailyField = `${cat.toLowerCase()}Seconds`;

      firestoreUpdate[dailyField] = increment(categoryTotal);
      firestoreUpdate.totalSeconds = increment(categoryTotal);

      
      const hourlyFieldBase = `hourly_activity.${hour}`;
      const catKey = cat === "Social Media" ? "socialMedia" : cat.toLowerCase();

      firestoreUpdate[`${hourlyFieldBase}.total`] = increment(categoryTotal);
      firestoreUpdate[`${hourlyFieldBase}.${catKey}`] = increment(categoryTotal);

     
      for (const sKey in hourData[cat].sites) {
        const s = hourData[cat].sites[sKey];
        const sitePath = `sites_map.${sKey}`;
        
        // console.log(`   🔗 [${cat}] ${s.domain}: ${s.seconds}s`);

        firestoreUpdate[`${sitePath}.seconds`] = increment(s.seconds);
        firestoreUpdate[`${sitePath}.domain`] = s.domain;
        firestoreUpdate[`${sitePath}.title`] = s.title;
        firestoreUpdate[`${sitePath}.category`] = cat;
      }
    }

    
    if (Object.keys(firestoreUpdate).length > 1) {
      try {
        const dayRef = doc(db, "users", userUid, "daily", dateStr);
        
        
        await setDoc(dayRef, firestoreUpdate, { merge: true });

        
        await chrome.storage.local.remove(key);
        // console.log(`✅ [Sync] Successfully pushed hour ${hour} to Firestore and cleared local cache.`);
      } catch (e) {
        console.error(`❌ [Sync] Critical error for ${key}:`, e);
      }
    }
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "UPDATE_SINGLE_MAPPING") {
    if (req.category === null) delete userPreferences[req.domain];
    else userPreferences[req.domain] = req.category;
    sendResponse({ success: true });
    (async () => {
      const storage = await chrome.storage.local.get("user");
      if (!storage.user?.uid) return;
      const ref = doc(
        db,
        "users",
        storage.user.uid,
        "site_preferences",
        req.domain.replace(/\./g, "_"),
      );
      if (req.category === null) await deleteDoc(ref);
      else
        await setDoc(
          ref,
          {
            domain: req.domain,
            category: req.category,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
    })();
    return false;
  }

  if (req.action === "SIGN_OUT") {
    (async () => {
      try {
        await updateTime();
        await syncDataToFirestore();
        await chrome.storage.local.clear();
        const tabs = await chrome.tabs.query({
          url: chrome.runtime.getURL("dashboard/index.html*"),
        });
        if (tabs.length > 0) {
          chrome.tabs.reload(tabs[0].id);
          tabs.slice(1).forEach((tab) => chrome.tabs.remove(tab.id));
        } else {
          chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard/index.html"),
          });
        }
      } catch (error) {
        console.error("Error during graceful sign-out:", error);
        await chrome.storage.local.clear();
      }
    })();
    return false;
  }

  if (req.action === "LOGIN_REQUEST") {
    signInWithGoogle();
    return false;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "syncFirestore") {
    await updateTime();
    await syncDataToFirestore();
  }
});

chrome.tabs.onActivated.addListener(async () => {
  await updateTime();
});

let isBrowserFocused = true;

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await updateTime();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isBrowserFocused = false;
    lastTabUrl = ""; 
  } else {
    isBrowserFocused = true;
  }
});

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("dashboard/index.html");
  const tabs = await chrome.tabs.query({ url: url + "*" });

  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: url });
  }
});

chrome.idle.onStateChanged.addListener(async (state) => {
  await updateTime();
  if (state === "idle" || state === "locked") {
    isBrowserFocused = false;
    lastTabUrl = "";
  } else {
    isBrowserFocused = true;
    startTime = Date.now();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(300);
  chrome.alarms.create("syncFirestore", { periodInMinutes: 2 });
});
loadUserPreferences();
