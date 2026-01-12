
// COPY ALL OF THIS CODE INTO YOUR GOOGLE APPS SCRIPT EDITOR
// (Extensions > Apps Script)

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10 seconds for other processes to finish

  try {
    var data = JSON.parse(e.postData.contents);

    // ==========================================
    // ACTION 1: UPLOAD FILE TO GOOGLE DRIVE
    // ==========================================
    if (data.action === "upload_file") {
        var folderName = "WareFlow Reports";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;
        
        // Check if folder exists, otherwise create it
        if (folders.hasNext()) {
            folder = folders.next();
        } else {
            folder = DriveApp.createFolder(folderName);
        }

        // Decode the Excel file from Base64
        var decoded = Utilities.base64Decode(data.fileData);
        var blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
        
        // Create the file in the specific folder
        var file = folder.createFile(blob);
        
        // IMPORTANT: Make file accessible via link so the Web App can open it immediately
        // You can change 'ANYONE_WITH_LINK' to 'DOMAIN' if you use Google Workspace
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // Return the direct link to the file
        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            url: file.getUrl()
        })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // ACTION 2: LOG DATA TO GOOGLE SHEET
    // ==========================================
    var sheetName = "Main Issue Backup";
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(sheetName);
    
    // Create backup sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.appendRow([
        "ID", "Date", "Location", "Sector", "Division", "Machine", 
        "Maint. Plan", "Item ID", "Item Name", "Quantity", "Status", 
        "Notes", "Warehouse Email", "Site Email"
      ]);
      sheet.setFrozenRows(1);
    }
    
    // Append the issue record
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
    // Error Handling
    return ContentService.createTextOutput(JSON.stringify({
        status: "error", 
        message: e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
