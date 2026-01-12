
// COPY ALL OF THIS CODE INTO YOUR GOOGLE APPS SCRIPT EDITOR
// (Extensions > Apps Script)

// Configuration
var FOLDER_NAME = "WareFlow Reports";
var DB_FILE_NAME = "WareFlow Database";
var SHEET_TAB_NAME = "Main Issue Backup";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);

    // --- ACTION: LOCATE OR SETUP DATA (Returns URLs) ---
    if (data.action === "locate_data") {
        var folder = getOrCreateFolder(FOLDER_NAME);
        var ss = getOrCreateSpreadsheet(folder);
        
        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            folderUrl: folder.getUrl(),
            sheetUrl: ss.getUrl()
        })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACTION: UPLOAD FILE (Excel) ---
    if (data.action === "upload_file") {
        var folder = getOrCreateFolder(FOLDER_NAME);

        var decoded = Utilities.base64Decode(data.fileData);
        var blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
        var file = folder.createFile(blob);
        
        // Ensure link is accessible
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            url: file.getUrl()
        })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACTION: LOG ISSUE (Row) ---
    // 1. Get or Create the Spreadsheet
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_TAB_NAME);
    
    // 2. Setup Headers if new
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_TAB_NAME);
      sheet.appendRow([
        "ID", "Date", "Location", "Sector", "Division", "Machine", 
        "Maint. Plan", "Item ID", "Item Name", "Quantity", "Status", 
        "Notes", "Warehouse Email", "Site Email"
      ]);
      sheet.setFrozenRows(1);
    }
    
    // 3. Append Row
    sheet.appendRow([
      data.id, 
      data.timestamp, 
      data.locationId, 
      data.sectorName || "", 
      data.divisionName || "", 
      data.machineName, 
      data.maintenancePlan || "", 
      data.itemId, 
      data.itemName, 
      data.quantity, 
      data.status, 
      data.notes || "", 
      data.warehouseEmail || "", 
      data.requesterEmail || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({
        status: "error", 
        message: e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- HELPER FUNCTIONS ---

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(name);
  }
}

function getOrCreateSpreadsheet(parentFolder) {
  // 1. Try to use the active sheet if script is bound
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch(e) {}

  // 2. Search for the file by name
  var files = DriveApp.getFilesByName(DB_FILE_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }

  // 3. Create new spreadsheet if not found
  var newSS = SpreadsheetApp.create(DB_FILE_NAME);
  
  // Optional: Move it to the WareFlow folder to keep things tidy
  if (parentFolder) {
     var file = DriveApp.getFileById(newSS.getId());
     file.moveTo(parentFolder);
  }
  
  return newSS;
}
