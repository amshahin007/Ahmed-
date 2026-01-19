<?php
// backend/api.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function getJsonInput() {
    return json_decode(file_get_contents("php://input"), true);
}

try {
    switch ($action) {
        case 'get_all_data':
            $data = [];
            
            // Items
            $data['items'] = $pdo->query("
                SELECT id, name, category, unit, stock_quantity as stockQuantity, 
                part_number as partNumber, model_no as modelNo, full_name as fullName, 
                brand 
                FROM items
            ")->fetchAll();

            // Machines (Mapping 'machine_name' to 'category' as per frontend type definition)
            $data['machines'] = $pdo->query("
                SELECT id, machine_name as category, local_no as machineLocalNo, 
                status, brand, model_no as modelNo, chase_no as chaseNo, 
                location_id as locationId, sector_id as sectorId, division_id as divisionId
                FROM machines
            ")->fetchAll();

            // Locations
            $data['locations'] = $pdo->query("SELECT id, name, email FROM locations")->fetchAll();
            
            // Sectors
            $data['sectors'] = $pdo->query("SELECT id, name FROM sectors")->fetchAll();

            // Divisions
            $data['divisions'] = $pdo->query("SELECT id, name, sector_id as sectorId FROM divisions")->fetchAll();

            // Plans
            $data['plans'] = $pdo->query("SELECT id, name FROM maintenance_plans")->fetchAll();

            // Issues
            $data['issues'] = $pdo->query("
                SELECT id, timestamp, location_id as locationId, machine_id as machineId, 
                item_id as itemId, item_name as itemName, quantity, status, notes,
                maintenance_plan as maintenancePlan, sector_name as sectorName, 
                division_name as divisionName, machine_name as machineName,
                warehouse_email as warehouseEmail, requester_email as requesterEmail
                FROM issues 
                ORDER BY timestamp DESC LIMIT 1000
            ")->fetchAll();

            echo json_encode($data);
            break;

        case 'save_issue':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO issues (
                id, timestamp, location_id, machine_id, item_id, item_name, quantity, status, 
                warehouse_email, requester_email, machine_name, sector_name, division_name, maintenance_plan
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $stmt->execute([
                $input['id'], 
                $input['timestamp'], 
                $input['locationId'], 
                $input['machineId'], 
                $input['itemId'], 
                $input['itemName'], 
                $input['quantity'], 
                'Pending',
                $input['warehouseEmail'], 
                $input['requesterEmail'],
                $input['machineName'],
                $input['sectorName'],
                $input['divisionName'],
                $input['maintenancePlan']
            ]);

            // Deduct Stock
            $updateStock = $pdo->prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?");
            $updateStock->execute([$input['quantity'], $input['itemId']]);

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Issue saved to MySQL"]);
            break;

        case 'add_item':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            $stmt = $pdo->prepare("INSERT INTO items (id, name, stock_quantity, unit, category) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['id'], 
                $input['name'], 
                $input['stockQuantity'] ?? 0, 
                $input['unit'], 
                $input['category']
            ]);
            echo json_encode(["status" => "success"]);
            break;

        default:
            echo json_encode(["message" => "WareFlow PHP API Ready"]);
            break;
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>