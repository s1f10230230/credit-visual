// Event tracking for conversion optimization
// Supports Google Analytics and development logging

interface EventData {
  [key: string]: string | number | boolean;
}

interface ConversionEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  data?: EventData;
}

// Key conversion events for CVR optimization
export const CONVERSION_EVENTS = {
  // Import flow
  IMPORT_START: 'import_start',
  IMPORT_SUCCESS: 'import_success',
  IMPORT_ERROR: 'import_error',
  
  // Upgrade flow
  UNLOCK_CLICK: 'unlock_click',
  PLAN_VIEW: 'plan_view',
  PLAN_UPGRADE: 'plan_upgrade',
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_SUCCESS: 'checkout_success',
  
  // Engagement
  DASHBOARD_VIEW: 'dashboard_view',
  CARD_DETAIL_VIEW: 'card_detail_view',
  EXPORT_CLICK: 'export_click',
  
  // Auth
  LOGIN_START: 'login_start',
  LOGIN_SUCCESS: 'login_success',
  REGISTER_START: 'register_start',
} as const;

class AnalyticsService {
  private isDev: boolean;
  private isEnabled: boolean;

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
    this.isEnabled = true; // Can be configured via env vars
  }

  // Initialize GA4 (optional)
  init(measurementId?: string) {
    if (!this.isEnabled || typeof window === 'undefined') return;

    if (measurementId && !window.gtag) {
      // Load GA4 script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', measurementId);
    }
  }

  // Track conversion events
  track(eventName: string, data: Partial<ConversionEvent> = {}) {
    if (!this.isEnabled) return;

    const event: ConversionEvent = {
      event: eventName,
      category: data.category || 'conversion',
      action: data.action || eventName,
      label: data.label,
      value: data.value,
      data: data.data,
    };

    // Development logging
    if (this.isDev) {
      console.group(`🔔 Analytics Event: ${eventName}`);
      console.log('Event Data:', event);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }

    // Send to GA4 if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        custom_parameters: event.data,
      });
    }

    // Can also send to other analytics platforms here
    // e.g., Mixpanel, Amplitude, custom backend endpoint
  }

  // Convenience methods for key conversion events
  trackImportStart(source: 'manual' | 'gmail' = 'manual') {
    this.track(CONVERSION_EVENTS.IMPORT_START, {
      category: 'import',
      action: 'start',
      label: source,
      data: { import_source: source }
    });
  }

  trackImportSuccess(fileCount: number, transactionCount: number) {
    this.track(CONVERSION_EVENTS.IMPORT_SUCCESS, {
      category: 'import',
      action: 'success',
      value: transactionCount,
      data: { file_count: fileCount, transaction_count: transactionCount }
    });
  }

  trackUnlockClick(feature: string, currentPlan: string) {
    this.track(CONVERSION_EVENTS.UNLOCK_CLICK, {
      category: 'upgrade',
      action: 'unlock_click',
      label: feature,
      data: { feature, current_plan: currentPlan }
    });
  }

  trackPlanView(plan: string, source: 'billing' | 'modal' | 'gate') {
    this.track(CONVERSION_EVENTS.PLAN_VIEW, {
      category: 'upgrade',
      action: 'plan_view',
      label: plan,
      data: { plan, source }
    });
  }

  trackPlanUpgrade(fromPlan: string, toPlan: string, amount?: number) {
    this.track(CONVERSION_EVENTS.PLAN_UPGRADE, {
      category: 'upgrade',
      action: 'plan_upgrade',
      label: `${fromPlan}_to_${toPlan}`,
      value: amount,
      data: { from_plan: fromPlan, to_plan: toPlan, amount: amount || 0 }
    });
  }

  trackCheckoutStart(plan: string, amount: number) {
    this.track(CONVERSION_EVENTS.CHECKOUT_START, {
      category: 'purchase',
      action: 'checkout_start',
      label: plan,
      value: amount,
      data: { plan, amount }
    });
  }

  trackDashboardView(cardCount: number, totalAmount: number) {
    this.track(CONVERSION_EVENTS.DASHBOARD_VIEW, {
      category: 'engagement',
      action: 'dashboard_view',
      value: cardCount,
      data: { card_count: cardCount, total_amount_cents: totalAmount }
    });
  }

  trackCardDetailView(cardLabel: string, subsOnly: boolean) {
    this.track(CONVERSION_EVENTS.CARD_DETAIL_VIEW, {
      category: 'engagement',
      action: 'card_detail_view',
      label: cardLabel,
      data: { card_label: cardLabel, subs_only: subsOnly }
    });
  }

  trackExportClick(format: 'csv' | 'json', plan: string) {
    this.track(CONVERSION_EVENTS.EXPORT_CLICK, {
      category: 'engagement',
      action: 'export_click',
      label: format,
      data: { format, plan }
    });
  }

  trackLoginStart(plan: string) {
    this.track(CONVERSION_EVENTS.LOGIN_START, {
      category: 'auth',
      action: 'login_start',
      label: plan,
      data: { plan }
    });
  }

  trackLoginSuccess(plan: string) {
    this.track(CONVERSION_EVENTS.LOGIN_SUCCESS, {
      category: 'auth',
      action: 'login_success',
      label: plan,
      data: { plan }
    });
  }
}

// Global analytics instance
export const analytics = new AnalyticsService();

// Types for GA4
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}