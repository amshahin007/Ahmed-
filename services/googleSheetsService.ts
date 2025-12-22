
import { Item, IssueRecord } from '../types';

// Updated Default ID based on user request (Published 2PACX ID)
export const DEFAULT_SHEET_ID = '2PACX-1vSMVlbr82tagYILVNamzhxIriPF3LAXrMaAHlRlp1-0F98Pfbu6orN0fTh6HDAh2vZP6WUH6LN2spNv';
export const DEFAULT_ITEMS_GID = '0'; // Default to first sheet for 2PACX/Published sheets

export const extractSheetIdFromUrl = (url: string): string => {
  // Handle "Published to web" URLs (e.g., .../d/e/2PACX-.../pubhtml)
  // Match content between /d/e/ and /pubhtml or /pub...
  const publishedMatch = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) return publishedMatch[1];

  // Handle standard URLs (e.g., .../d/1A2B.../edit)
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
};

export const fetchItemsFromSheet = async (sheetId: string, gid: string): Promise<Item[]> => {
  let url = '';
  
  // Determine URL format based on ID type
  if (sheetId.startsWith('2PACX')) {
      // Published Sheet
      // Use /pub?output=csv to get the CSV content
      url = `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?output=csv`;
      
      // If a specific GID is provided (and not default 0), we append it.
      // Note: This often requires the sheet to be published as "Entire Document".
      if (gid && gid !== '0') {
         url += `&gid=${gid}&single=true`;
      }
  } else {
      // Standard Sheet ID
      url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch. Status: ${response.status}. Ensure the sheet is "Published to the web".`);
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
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Find column indices
  const idIdx = headers.findIndex(h => h === 'item number' || h === 'item code' || h === 'id');
  const nameIdx = headers.findIndex(h => h === 'description' || h === 'item name' || h === 'name');
  
  // Specific Fields
  const id2Idx = headers.findIndex(h => h.includes('2nd item'));
  const id3Idx = headers.findIndex(h => h.includes('3rd item'));
  const desc2Idx = headers.findIndex(h => h.includes('description line 2'));
  const fullNameIdx = headers.findIndex(h => h.includes('full name'));
  const oemIdx = headers.findIndex(h => h === 'oem');
  const partNoIdx = headers.findIndex(h => h === 'part no' || h === 'part number');
  const umIdx = headers.findIndex(h => h === 'um' || h === 'unit' || h === 'uom');
  const catIdx = headers.findIndex(h => h.includes('category') || h.includes('family'));

  const items: Item[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV split (handling simple commas)
    // For production with robust CSV needs, consider a library like PapaParse
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    // Fallback: If no explicit "Item Number" header, use col 0
    // Fallback: If no explicit "Description" header, use col 1
    const idVal = idIdx > -1 ? values[idIdx] : values[0];
    const nameVal = nameIdx > -1 ? values[nameIdx] : (values[1] || 'Unknown Item');

    if (idVal) {
      items.push({
        id: idVal,
        name: nameVal,
        category: catIdx > -1 ? values[catIdx] : 'General',
        unit: umIdx > -1 ? values[umIdx] : 'pcs',
        
        // Extended Fields
        secondId: id2Idx > -1 ? values[id2Idx] : undefined,
        thirdId: id3Idx > -1 ? values[id3Idx] : undefined,
        description2: desc2Idx > -1 ? values[desc2Idx] : undefined,
        fullName: fullNameIdx > -1 ? values[fullNameIdx] : undefined,
        oem: oemIdx > -1 ? values[oemIdx] : undefined,
        partNumber: partNoIdx > -1 ? values[partNoIdx] : undefined,
      });
    }
  }
  return items;
};

export const sendIssueToSheet = async (scriptUrl: string, issue: IssueRecord) => {
  try {
    // We use no-cors because Google Apps Script Web Apps don't easily support CORS for simple POSTs
    // "no-cors" means we can send data but cannot read the response.
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
    // Don't throw, just log, so we don't break the UI flow
  }
};

export const APP_SCRIPT_TEMPLATE = `
// 1. Paste this code into Extensions > Apps Script in your Google Sheet
// 2. Save and Click "Deploy" > "New Deployment"
// 3. Select type: "Web App"
// 4. Description: "WareFlow Logger"
// 5. Execute as: "Me"
// 6. Who has access: "Anyone" (Important for the app to access it)
// 7. Click Deploy and copy the "Web App URL"

function doPost(e) {
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
}
`;
