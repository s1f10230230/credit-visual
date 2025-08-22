export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

export interface PWAUpdateAvailable {
  skipWaiting(): Promise<void>;
  postMessage(message: any): void;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: {
    action: string;
    title: string;
    icon?: string;
  }[];
}

class PWAService {
  private deferredPrompt: PWAInstallPrompt | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.initializePWA();
    this.setupEventListeners();
  }

  async initializePWA(): Promise<void> {
    try {
      // Register service worker
      await this.registerServiceWorker();
      
      // Setup install prompt
      this.setupInstallPrompt();
      
      // Setup push notifications
      await this.setupPushNotifications();
      
      // Setup background sync
      this.setupBackgroundSync();
      
      // Setup periodic sync
      this.setupPeriodicSync();
      
    } catch (error) {
      console.error('PWA initialization failed:', error);
    }
  }

  async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('Service Worker registered successfully');

        // Listen for updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available
                this.notifyUpdateAvailable();
              }
            });
          }
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as any;
      
      // Show custom install button
      this.showInstallButton();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredPrompt = null;
      this.hideInstallButton();
      
      // Track installation
      this.trackPWAEvent('install', { source: 'browser_prompt' });
    });
  }

  async promptInstall(): Promise<{outcome: 'accepted' | 'dismissed'}> {
    if (!this.deferredPrompt) {
      return { outcome: 'dismissed' };
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      this.deferredPrompt = null;
      this.hideInstallButton();
      
      this.trackPWAEvent('install_prompt_result', { outcome: choiceResult.outcome });
      
      return choiceResult;
    } catch (error) {
      console.error('Install prompt failed:', error);
      return { outcome: 'dismissed' };
    }
  }

  isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           (window as any).navigator.standalone === true;
  }

  async setupPushNotifications(): Promise<void> {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        await this.subscribeToPush();
      }
    } catch (error) {
      console.error('Failed to setup push notifications:', error);
    }
  }

  async subscribeToPush(): Promise<void> {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY || '')
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
    }
  }

  async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        tag: payload.tag,
        data: payload.data,
        actions: payload.actions
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }

  setupBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      // Register for background sync when offline actions are taken
      window.addEventListener('offline-action', (event: any) => {
        this.registerBackgroundSync(event.detail.tag);
      });
    }
  }

  async registerBackgroundSync(tag: string): Promise<void> {
    if (!this.swRegistration) return;

    try {
      await this.swRegistration.sync.register(tag);
      console.log(`Background sync registered for tag: ${tag}`);
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  setupPeriodicSync(): void {
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
      this.registerPeriodicSync();
    }
  }

  async registerPeriodicSync(): Promise<void> {
    if (!this.swRegistration) return;

    try {
      await (this.swRegistration as any).periodicSync.register('transaction-sync', {
        minInterval: 24 * 60 * 60 * 1000 // 24 hours
      });
      console.log('Periodic sync registered');
    } catch (error) {
      console.error('Periodic sync registration failed:', error);
    }
  }

  setupEventListeners(): void {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatusChange(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOnlineStatusChange(false);
    });

    // App state changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleAppForeground();
      } else {
        this.handleAppBackground();
      }
    });

    // Share target handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SHARE_TARGET') {
          this.handleShareTarget(event.data.payload);
        }
      });
    }
  }

  getOfflineCapabilities(): {
    isOnline: boolean;
    hasCache: boolean;
    lastSync: Date | null;
    pendingActions: number;
  } {
    return {
      isOnline: this.isOnline,
      hasCache: this.hasCachedData(),
      lastSync: this.getLastSyncTime(),
      pendingActions: this.getPendingActionsCount()
    };
  }

  async cacheTransaction(transaction: any): Promise<void> {
    if (!this.isOnline) {
      // Store transaction for background sync
      const pendingTransactions = JSON.parse(
        localStorage.getItem('pendingTransactions') || '[]'
      );
      
      pendingTransactions.push({
        ...transaction,
        timestamp: Date.now(),
        id: this.generateOfflineId()
      });
      
      localStorage.setItem('pendingTransactions', JSON.stringify(pendingTransactions));
      
      // Register for background sync
      await this.registerBackgroundSync('transaction-upload');
      
      // Show offline notification
      await this.sendLocalNotification({
        title: '取引を保存しました',
        body: 'オンライン復帰時に自動同期されます',
        tag: 'offline-save'
      });
    }
  }

  async installUpdate(): Promise<void> {
    if (!this.swRegistration) return;

    const waitingWorker = this.swRegistration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload after new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (!this.swRegistration) return false;

    try {
      await this.swRegistration.update();
      return this.swRegistration.waiting !== null;
    } catch (error) {
      console.error('Update check failed:', error);
      return false;
    }
  }

  // Helper methods
  private showInstallButton(): void {
    const event = new CustomEvent('pwa-installable');
    window.dispatchEvent(event);
  }

  private hideInstallButton(): void {
    const event = new CustomEvent('pwa-installed');
    window.dispatchEvent(event);
  }

  private notifyUpdateAvailable(): void {
    const event = new CustomEvent('pwa-update-available');
    window.dispatchEvent(event);
  }

  private handleOnlineStatusChange(isOnline: boolean): void {
    const event = new CustomEvent('connection-change', {
      detail: { isOnline }
    });
    window.dispatchEvent(event);

    if (isOnline) {
      // Trigger background sync
      this.registerBackgroundSync('transaction-upload');
    }
  }

  private handleAppForeground(): void {
    // Check for updates when app comes to foreground
    this.checkForUpdates();
    
    // Sync data if needed
    if (this.isOnline) {
      this.registerBackgroundSync('data-sync');
    }
  }

  private handleAppBackground(): void {
    // Save current state
    const event = new CustomEvent('app-background');
    window.dispatchEvent(event);
  }

  private async handleShareTarget(payload: any): Promise<void> {
    // Handle shared content (receipts, etc.)
    const event = new CustomEvent('share-target', {
      detail: payload
    });
    window.dispatchEvent(event);
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  private trackPWAEvent(event: string, data: any): void {
    // Track PWA usage for analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', event, {
        event_category: 'PWA',
        ...data
      });
    }
  }

  private hasCachedData(): boolean {
    return localStorage.getItem('cachedTransactions') !== null;
  }

  private getLastSyncTime(): Date | null {
    const lastSync = localStorage.getItem('lastSyncTime');
    return lastSync ? new Date(lastSync) : null;
  }

  private getPendingActionsCount(): number {
    const pending = localStorage.getItem('pendingTransactions');
    return pending ? JSON.parse(pending).length : 0;
  }

  private generateOfflineId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const pwaService = new PWAService();