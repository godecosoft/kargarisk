/**
 * API Service
 * Backend ile iletişim
 */

// Use relative URL in production, localhost in development
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

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

export async function fetchReportsStats(startDate, endDate) {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await fetch(`${API_BASE}/reports/stats?${params}`);

    if (!response.ok) {
        throw new Error('Failed to fetch reports');
    }

    return response.json();
}

export async function fetchRules() {
    const response = await fetch(`${API_BASE}/rules`);
    if (!response.ok) throw new Error('Failed to fetch rules');
    return response.json();
}

export async function saveRule(key, value, description) {
    const response = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, description })
    });
    if (!response.ok) throw new Error('Failed to save rule');
    return response.json();
}

export async function fetchIPAnalysis(clientId, days = 7) {
    const response = await fetch(`${API_BASE}/client/${clientId}/ip-analysis?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch IP analysis');
    return response.json();
}

export async function fetchBonusTransactions(clientId) {
    const response = await fetch(`${API_BASE}/client/${clientId}/bonus-transactions`);
    if (!response.ok) throw new Error('Failed to fetch bonus transactions');
    return response.json();
}

export async function fetchWithdrawalSnapshot(withdrawalId) {
    const response = await fetch(`${API_BASE}/withdrawal/${withdrawalId}/snapshot`);
    if (!response.ok) throw new Error('Failed to fetch snapshot');
    return response.json();
}

export async function fetchClientKpi(clientId) {
    const response = await fetch(`${API_BASE}/client/${clientId}/kpi`);
    if (!response.ok) throw new Error('Failed to fetch client KPI');
    return response.json();
}

// ============================================
// AUTO-APPROVAL API
// ============================================

export async function fetchAutoApprovalRules() {
    const response = await fetch(`${API_BASE}/auto-approval/rules`);
    if (!response.ok) throw new Error('Failed to fetch auto-approval rules');
    return response.json();
}

export async function updateAutoApprovalRule(ruleKey, value, enabled) {
    const response = await fetch(`${API_BASE}/auto-approval/rules/${ruleKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, enabled })
    });
    if (!response.ok) throw new Error('Failed to update rule');
    return response.json();
}

export async function triggerAutoApproval(withdrawalId, withdrawal) {
    const response = await fetch(`${API_BASE}/withdrawal/${withdrawalId}/auto-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawal)
    });
    if (!response.ok) throw new Error('Auto-approval failed');
    return response.json();
}

export async function fetchAutoApprovalHistory(limit = 50) {
    const response = await fetch(`${API_BASE}/auto-approval/history?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch approval history');
    return response.json();
}
