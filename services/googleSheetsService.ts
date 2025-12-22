
import { Item, IssueRecord } from '../types';

// Updated Default ID and GID based on user request
export const DEFAULT_SHEET_ID = '2PACX-1vSMVlbr82tagYILVNamzhxIriPF3LAXrMaAHlRlp1-0F98Pfbu6orN0fTh6HDAh2vZP6WUH6LN2spNv';
export const DEFAULT_ITEMS_GID = '229812258'; 

export const extractSheetIdFromUrl = (url: string): string => {
  // Handle "Published to web" URLs (e.g., .../d/e/2PACX-.../pubhtml)
  const publishedMatch = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) return publishedMatch[1];

  // Handle standard URLs (e.g., .../d/1A2B.../edit)
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
};

export const extractGidFromUrl = (url: string): string | null => {
  // Try to find gid parameter in URL
  const match = url.match(/[?&]gid=([0-9]+)/);
  return match ? match[1] : null;
};

export const fetchItemsFromSheet = async (sheetId: string, gid: string): Promise<Item[]> => {
  let url = '';
  
  // Determine URL format based on ID type
  if (sheetId.startsWith('2PACX')) {
      // Published Sheet
      // The user provided structure: .../pub?gid=...&single=true&output=csv
      url = `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?output=csv`;
      
      if (gid) {
         url += `&gid=${gid}&single=true`;
      }
  } else {
      // Standard Sheet ID
      url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  
  // Add timestamp to prevent caching
  url += `&_t=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch. Status: ${response.status}.`);
    }
    const text = await response.text();
    return parseItemsCSV(text);
  } catch (error) {
    console.error("Sheet Sync Error:", error);
    throw error;
  }
};

const parseItemsCSV = (csvText: string): Item[] => {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse headers safely (normalize to lowercase for matching)
  // Use a regex to split by comma but respect quotes if present
  const headers = lines[0].toLowerCase().match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[0].toLowerCase().split(',');
  const cleanHeaders = headers.map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Helper to find index fuzzy
  const findIdx = (keywords: string[]) => cleanHeaders.findIndex(h => keywords.some(k => h === k || h.includes(k)));

  // Strict mapping based on user headers
  const idIdx = cleanHeaders.findIndex(h => h === 'item number' || h === 'item no' || h === 'id');
  const nameIdx = cleanHeaders.findIndex(h => h === 'description' || h === 'desc' || h === 'item name');
  
  const id2Idx = findIdx(['2nd item number', '2nd item']);
  const id3Idx = findIdx(['3rd item number', '3rd item']);
  const desc2Idx = findIdx(['description line 2']);
  const fullNameIdx = findIdx(['full name']);
  const oemIdx = findIdx(['oem']);
  const partNoIdx = findIdx(['part no', 'part number']);
  const umIdx = findIdx(['um', 'unit']);
  const catIdx = findIdx(['category', 'family']); 

  const items: Item[] = [];

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    // Regex split to handle commas inside quotes correctly
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (!values || values.length < 2) continue;

    const cleanValues = values.map((v: string) => v ? v.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : '');

    // Fallbacks
    const idVal = idIdx > -1 ? cleanValues[idIdx] : cleanValues[0];
    
    // Name logic priority
    let nameVal = '';
    if (nameIdx > -1 && cleanValues[nameIdx]) nameVal = cleanValues[nameIdx];
    else if (fullNameIdx > -1 && cleanValues[fullNameIdx]) nameVal = cleanValues[fullNameIdx];
    else if (desc2Idx > -1 && cleanValues[desc2Idx]) nameVal = cleanValues[desc2Idx];
    else nameVal = cleanValues[1] || 'Unknown';

    if (idVal) {
      items.push({
        id: idVal,
        name: nameVal,
        category: catIdx > -1 ? cleanValues[catIdx] : 'General',
        unit: umIdx > -1 ? cleanValues[umIdx] : 'pcs',
        
        // Extended Fields
        secondId: id2Idx > -1 ? cleanValues[id2Idx] : undefined,
        thirdId: id3Idx > -1 ? cleanValues[id3Idx] : undefined,
        description2: desc2Idx > -1 ? cleanValues[desc2Idx] : undefined,
        fullName: fullNameIdx > -1 ? cleanValues[fullNameIdx] : undefined,
        oem: oemIdx > -1 ? cleanValues[oemIdx] : undefined,
        partNumber: partNoIdx > -1 ? cleanValues[partNoIdx] : undefined,
      });
    }
  }
  return items;
};

export const sendIssueToSheet = async (scriptUrl: string, issue: IssueRecord) => {
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issue),
    });
    console.log("Sent to Google Sheet");
  } catch (error) {
    console.error("Failed to send to Google Sheet", error);
  }
};

export const APP_SCRIPT_TEMPLATE = `
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for previous request to finish

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("IssuesLog");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("IssuesLog");
      sheet.appendRow(["ID", "Date", "Location", "Sector", "Division", "Machine", "Item ID", "Item Name", "Quantity", "Status", "Notes"]);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.id,
      data.timestamp,
      data.locationId,
      data.sectorName || "",
      data.divisionName || "",
      data.machineName,
      data.itemId,
      data.itemName,
      data.quantity,
      data.status,
      data.notes || ""
    ]);
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch(e) {
    return ContentService.createTextOutput("Error: " + e.toString()).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}
`;
