import { IssueRecord, Item, Machine, Location } from '../types';

// CHANGE THIS to your actual local PHP server URL
const API_BASE_URL = 'http://localhost/wareflow/backend/api.php';

export const fetchAllData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=get_all_data`);
        if (!response.ok) throw new Error('PHP API Failed');
        return await response.json();
    } catch (error) {
        // Suppress errors for pure frontend usage
        console.warn("PHP Backend unavailable (Offline Mode):", (error as Error).message);
        return null;
    }
};

export const saveIssueToPhp = async (issue: IssueRecord) => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=save_issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(issue)
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to save to PHP:", error);
        // Do not throw to avoid crashing the UI save flow, just log it.
        return { status: "error", message: "PHP Backend unavailable" };
    }
};

export const addItemToPhp = async (item: Item) => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=add_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to add item to PHP:", error);
        return { status: "error", message: "PHP Backend unavailable" };
    }
};