
import { IssueRecord, Item, Machine, Location } from '../types';

// CHANGE THIS to your actual local PHP server URL
const API_BASE_URL = 'http://localhost/wareflow/backend/api.php';

export const fetchAllData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}?action=get_all_data`);
        if (!response.ok) throw new Error('PHP API Failed');
        return await response.json();
    } catch (error) {
        console.error("PHP Sync Error:", error);
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
        throw error;
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
        throw error;
    }
};
