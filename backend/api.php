<?php
// backend/api.php

// 1. Handle CORS (Allow React to talk to PHP)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db_connect.php';

// 2. Determine Action
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// 3. Helper to get POST data
function getJsonInput() {
    return json_decode(file_get_contents("php://input"), true);
}

try {
    switch ($action) {
        case 'get_all_data':
            // Fetch everything needed for initial load
            $data = [];
            $data['items'] = $pdo->query("SELECT * FROM items")->fetchAll();
            $data['machines'] = $pdo->query("SELECT * FROM machines")->fetchAll();
            $data['locations'] = $pdo->query("SELECT * FROM locations")->fetchAll();
            $data['issues'] = $pdo->query("SELECT * FROM issues ORDER BY timestamp DESC LIMIT 1000")->fetchAll();
            echo json_encode($data);
            break;

        case 'save_issue':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            
            // Transaction: Save Issue AND Deduct Stock
            $pdo->beginTransaction();

            // 1. Insert Issue
            $stmt = $pdo->prepare("INSERT INTO issues (id, timestamp, location_id, machine_id, item_id, item_name, quantity, status, warehouse_email, requester_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
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
                $input['requesterEmail']
            ]);

            // 2. Update Stock (Simple deduction)
            $updateStock = $pdo->prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?");
            $updateStock->execute([$input['quantity'], $input['itemId']]);

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Issue saved and stock updated"]);
            break;

        case 'add_item':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            $stmt = $pdo->prepare("INSERT INTO items (id, name, stock_quantity, unit, category) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$input['id'], $input['name'], $input['stockQuantity'], $input['unit'], $input['category']]);
            echo json_encode(["status" => "success"]);
            break;

        default:
            echo json_encode(["message" => "Welcome to WareFlow PHP API"]);
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