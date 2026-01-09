/**
 * API Service
 * Backend ile iletişim
 */

const API_BASE = 'http://localhost:3001/api';

export async function fetchWithdrawals(filters = {}) {
    const response = await fetch(`${API_BASE}/withdrawals`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
    });

    if (!response.ok) {
        throw new Error('Failed to fetch withdrawals');
    }

    return response.json();
}

export async function fetchNewWithdrawals() {
    const response = await fetch(`${API_BASE}/withdrawals/new`);
    if (!response.ok) {
        throw new Error('Failed to fetch new withdrawals');
    }
    return response.json();
}

export async function fetchClientTurnover(clientId, multiplier = 1) {
    const response = await fetch(`${API_BASE}/client/${clientId}/turnover?multiplier=${multiplier}`);
    if (!response.ok) {
        throw new Error('Failed to fetch turnover');
    }
    return response.json();
}

export async function fetchClientBonuses(clientId, count = 5) {
    const response = await fetch(`${API_BASE}/client/${clientId}/bonuses?count=${count}`);
    if (!response.ok) {
        throw new Error('Failed to fetch bonuses');
    }
    return response.json();
}

export async function fetchClientSports(clientId) {
    const response = await fetch(`${API_BASE}/client/${clientId}/sports`);
    if (!response.ok) {
        throw new Error('Failed to fetch sports');
    }
    return response.json();
}

export async function checkTokenStatus() {
    const response = await fetch(`${API_BASE}/token/status`);
    return response.json();
}

export async function checkHealth() {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
}

export async function fetchDecisionsBatch(withdrawals) {
    const response = await fetch(`${API_BASE}/decisions/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ withdrawals })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch decisions');
    }

    return response.json();
}
