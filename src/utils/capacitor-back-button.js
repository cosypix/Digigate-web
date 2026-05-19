// ============================================
// Capacitor Hardware Back Button Handler
// ============================================
// Intercepts the Android hardware back button and maps
// it to the browser history. Without this, pressing
// "Back" on Android exits the app instead of navigating
// to the previous page in the React SPA.
// ============================================

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Register the hardware back-button listener.
 * Safe to call on any platform — it no-ops on web.
 */
export function setupBackButton() {
    if (!Capacitor.isNativePlatform()) return;

    CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
            window.history.back();
        } else {
            CapApp.exitApp();
        }
    });
}
