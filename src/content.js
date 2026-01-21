/**
 * Strategy 1: URL Cleaning Logic
 * Extracts 'Mail' from 'mail.google.com' or 'Leetcode' from 'www.leetcode.com'
 */
function cleanUrlHostname(urlStr) {
    try {
        const url = new URL(urlStr);
        let hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        const parts = hostname.split('.');

        // Special case: if the hostname is just "google.com" or "google.in"
        // we want "Google" not "Com" or "In"
        let mainName = parts[0];
        const tlds = ['com', 'in', 'net', 'org', 'edu', 'gov'];
        if (tlds.includes(mainName) && parts.length > 1) {
            mainName = parts[1];
        }

        return mainName.charAt(0).toUpperCase() + mainName.slice(1);
    } catch (e) {
        return null;
    }
}

/**
 * Strategy 2: Metadata Extraction
 * Pulls the 'Official' name from the site's HTML tags
 */
function getMetadataName() {
    // Check for <meta name="application-name" content="Gmail">
    const appName = document.querySelector('meta[name="application-name"]')?.content;
    if (appName) return appName;

    // Check for <meta property="og:site_name" content="LeetCode">
    const ogName = document.querySelector('meta[property="og:site_name"]')?.content;
    if (ogName) return ogName;

    return null;
}

/**
 * FINAL LOGIC: Hybrid Approach
 */
function getFinalSiteName() {
    // 1. Priority: Check Metadata (Works great for LeetCode/YouTube)
    const metaName = getMetadataName();
    if (metaName) return metaName;

    // 2. Fallback: Use our Regex/Split logic (Works great for Mail/Drive)
    return cleanUrlHostname(window.location.href);
}

// Get the name and send it to the background script
const finalName = getFinalSiteName();

if (finalName) {
    chrome.runtime.sendMessage({ 
        action: "trackTime", 
        site: finalName 
    });
}