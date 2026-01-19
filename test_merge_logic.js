// Simulate the server-side data structure
const allData = {
    "moe": {
        lastModified: 100,
        items: [
            { timestamp: 1, companyName: "Apple (moe)" }
        ]
    },
    "Moe": {
        lastModified: 200,
        items: [
            { timestamp: 2, companyName: "Micron (Moe)" }
        ]
    },
    "MOE": {
        lastModified: 50,
        items: [
            { timestamp: 3, companyName: "Tesla (MOE)" }
        ]
    },
    "milton": {
        lastModified: 300,
        items: [
            { timestamp: 4, companyName: "Should Not Appear" }
        ]
    }
};

const username = "moe"; // The user logging in

// --- LOGIC FROM api/user-data.js ---
// FIX: Case-Insensitive Merger (Restore "Moe" data to "moe")
// Find ALL keys that match the requested username (case-insensitive)
const matchingKeys = Object.keys(allData).filter(k => k.toLowerCase() === username.toLowerCase());

console.log('Matching Keys:', matchingKeys);

let mergedItems = [];
let maxLastModified = 0;

matchingKeys.forEach(key => {
    let data = allData[key];
    // Handle legacy array format
    if (Array.isArray(data)) {
        data = { lastModified: 0, items: data };
    }
    if (data.items && Array.isArray(data.items)) {
        mergedItems = mergedItems.concat(data.items);
    }
    if (data.lastModified > maxLastModified) {
        maxLastModified = data.lastModified;
    }
});

// Deduplicate by timestamp (critical for merge)
const uniqueMap = new Map();
mergedItems.forEach(item => {
    if (item.timestamp) uniqueMap.set(item.timestamp, item);
    else uniqueMap.set(JSON.stringify(item), item); // Fallback for really old legacy
});

const finalItems = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp); // Newest first

const userData = {
    lastModified: maxLastModified,
    items: finalItems
};

console.log('Final Merged Result:', JSON.stringify(userData, null, 2));

// ASSERTIONS
if (finalItems.length !== 3) console.error('FAIL: Expected 3 items');
if (!finalItems.find(i => i.companyName.includes("Apple"))) console.error('FAIL: Missing Apple');
if (!finalItems.find(i => i.companyName.includes("Micron"))) console.error('FAIL: Missing Micron');
if (!finalItems.find(i => i.companyName.includes("Tesla"))) console.error('FAIL: Missing Tesla');
if (finalItems.find(i => i.companyName.includes("Milton"))) console.error('FAIL: Leaked Milton');

if (finalItems.length === 3) console.log('SUCCESS: Merge Logic Verified');
