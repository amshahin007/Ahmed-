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

// Map Frontend Table Names to DB Table Names
$tableMap = [
    'items' => 'items',
    'machines' => 'machines',
    'locations' => 'locations',
    'sectors' => 'sectors',
    'divisions' => 'divisions',
    'plans' => 'maintenance_plans',
    'users' => 'users',
    'history' => 'issues', // 'history' on frontend -> 'issues' in DB
    'breakdowns' => 'breakdowns',
    'bomRecords' => 'bom',
    'agriOrders' => 'agri_orders',
    'irrigationLogs' => 'irrigation_logs',
    'forecastPeriods' => 'forecast_periods',
    'forecastRecords' => 'forecast_records'
];

// Helper to map camelCase keys to snake_case columns
function toSnakeCase($input) {
    return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $input));
}

function toCamelCase($input) {
    return lcfirst(str_replace('_', '', ucwords($input, '_')));
}

try {
    switch ($action) {
        case 'get_all_data':
            $data = [];
            
            // Helper to fetch and convert keys to camelCase
            $fetchTable = function($tableName) use ($pdo) {
                $rows = $pdo->query("SELECT * FROM $tableName")->fetchAll(PDO::FETCH_ASSOC);
                $result = [];
                foreach($rows as $row) {
                    $newRow = [];
                    foreach($row as $key => $val) {
                        $newRow[toCamelCase($key)] = $val;
                    }
                    // Handle special JSON fields
                    if(isset($newRow['quantitiesByLocation']) && $newRow['quantitiesByLocation']) {
                        $newRow['quantitiesByLocation'] = json_decode($newRow['quantitiesByLocation'], true);
                    }
                    if(isset($newRow['allowedLocationIds'])) $newRow['allowedLocationIds'] = explode(',', $newRow['allowedLocationIds']);
                    if(isset($newRow['allowedSectorIds'])) $newRow['allowedSectorIds'] = explode(',', $newRow['allowedSectorIds']);
                    if(isset($newRow['allowedDivisionIds'])) $newRow['allowedDivisionIds'] = explode(',', $newRow['allowedDivisionIds']);
                    
                    $result[] = $newRow;
                }
                return $result;
            };

            $data['items'] = $fetchTable('items');
            $data['machines'] = $fetchTable('machines');
            $data['locations'] = $fetchTable('locations');
            $data['sectors'] = $fetchTable('sectors');
            $data['divisions'] = $fetchTable('divisions');
            $data['plans'] = $fetchTable('maintenance_plans');
            $data['users'] = $fetchTable('users');
            $data['history'] = $fetchTable('issues');
            $data['breakdowns'] = $fetchTable('breakdowns');
            $data['bomRecords'] = $fetchTable('bom');
            $data['agriOrders'] = $fetchTable('agri_orders');
            $data['irrigationLogs'] = $fetchTable('irrigation_logs');
            $data['forecastPeriods'] = $fetchTable('forecast_periods');
            $data['forecastRecords'] = $fetchTable('forecast_records');

            echo json_encode($data);
            break;

        case 'upsert_record':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            $frontendTable = $input['table'] ?? '';
            $recordData = $input['data'] ?? [];

            if (!isset($tableMap[$frontendTable])) throw new Exception("Unknown table: $frontendTable");
            if (empty($recordData)) throw new Exception("No data provided");

            $dbTable = $tableMap[$frontendTable];
            
            // Prepare Data for SQL
            $columns = [];
            $placeholders = [];
            $values = [];
            $update string = "";

            foreach ($recordData as $key => $value) {
                // Skip unknown fields or handle specific logic
                if ($key === 'table') continue;

                $colName = toSnakeCase($key);
                
                // Convert Arrays/Objects to strings for DB storage
                if (is_array($value) || is_object($value)) {
                    if ($key === 'allowedLocationIds' || $key === 'allowedSectorIds' || $key === 'allowedDivisionIds') {
                        $value = implode(',', (array)$value);
                    } else {
                        $value = json_encode($value);
                    }
                }

                $columns[] = $colName;
                $placeholders[] = "?";
                $values[] = $value;
            }

            $sql = "INSERT INTO $dbTable (" . implode(", ", $columns) . ") VALUES (" . implode(", ", $placeholders) . ") 
                    ON DUPLICATE KEY UPDATE ";
            
            $updateParts = [];
            foreach ($columns as $col) {
                if ($col !== 'id' && $col !== 'username') { // Don't update Primary Key
                    $updateParts[] = "$col = VALUES($col)";
                }
            }
            $sql .= implode(", ", $updateParts);

            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);

            echo json_encode(["status" => "success"]);
            break;

        case 'delete_record':
            if ($method !== 'POST') throw new Exception("Method not allowed");
            $input = getJsonInput();
            $frontendTable = $input['table'] ?? '';
            $id = $input['id'] ?? '';

            if (!isset($tableMap[$frontendTable])) throw new Exception("Unknown table: $frontendTable");
            if (!$id) throw new Exception("No ID provided");

            $dbTable = $tableMap[$frontendTable];
            $pk = ($dbTable === 'users') ? 'username' : 'id';

            $stmt = $pdo->prepare("DELETE FROM $dbTable WHERE $pk = ?");
            $stmt->execute([$id]);

            echo json_encode(["status" => "success"]);
            break;

        default:
            echo json_encode(["message" => "WareFlow API Ready"]);
            break;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>