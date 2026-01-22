import { IssueRecord, Item, Machine, Location } from '../types';

// CHANGE THIS to your actual local PHP server URL
const API_BASE_URL = 'http://localhost/wareflow/backend/api.php';

export const fetchAllData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=get_all_data`);
        if (!response.ok) throw new Error('PHP API Failed');
        return await response.json();
    } catch (error) {
        console.warn("PHP Backend unavailable (Offline Mode):", (error as Error).message);
        return null;
    }
};

export const upsertRecord = async (table: string, data: any) => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=upsert_record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, data })
        });
        const res = await response.json();
        if (res.error) throw new Error(res.error);
        return res;
    } catch (error) {
        console.error(`Failed to save to ${table}:`, error);
        return { status: "error", message: "Backend unavailable" };
    }
};

export const deleteRecord = async (table: string, id: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=delete_record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, id })
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to delete from ${table}:`, error);
        return { status: "error", message: "Backend unavailable" };
    }
};
