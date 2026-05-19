// ============================================
// Centralized API Fetch Utility
// ============================================
// Automatically injects the X-Tenant-Domain header
// into every API request. The domain is extracted from
// the subdomain (production) or localStorage (local dev).
// Capacitor-aware: in native apps, always uses localStorage.
// ============================================

import { Capacitor } from '@capacitor/core';

const BACKEND_URL = import.meta.env.VITE_Backend_URL;

/**
 * Extract the tenant domain from the current hostname.
 * Production: iiitdmj.digigate.com → 'iiitdmj'
 * Native app: always reads from localStorage('tenantDomain')
 * Local dev fallback: reads from localStorage('tenantDomain')
 *
 * @returns {string|null}
 */
export function getTenantDomain() {
    // In a Capacitor native app, there is no meaningful hostname —
    // the WebView runs on localhost or a capacitor:// scheme.
    // Always use localStorage in native context.
    if (Capacitor.isNativePlatform()) {
        return localStorage.getItem('tenantDomain') || null;
    }

    const hostname = window.location.hostname;

    // Production: extract subdomain from *.digigate.com
    // e.g., 'iiitdmj.digigate.com' → 'iiitdmj'
    if (hostname.includes('.') && !hostname.startsWith('localhost') && !hostname.startsWith('127.')) {
        const parts = hostname.split('.');
        if (parts.length >= 3) {
            return parts[0]; // subdomain
        }
    }

    // Local development fallback: use localStorage
    return localStorage.getItem('tenantDomain') || null;
}

/**
 * Centralized fetch wrapper that injects tenant headers automatically.
 * Drop-in replacement for fetch() — same API, same return type.
 *
 * @param {string} path - API path (e.g., '/api/login')
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
    const domain = getTenantDomain();

    const headers = {
        ...options.headers,
        ...(domain ? { 'X-Tenant-Domain': domain } : {}),
    };

    return fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });
}

