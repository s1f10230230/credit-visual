import { Capacitor } from '@capacitor/core';
import { App, AppState } from '@capacitor/app';
import { Device, DeviceInfo } from '@capacitor/device';
import { Network, NetworkStatus } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Keyboard } from '@capacitor/keyboard';

export interface NativeCapabilities {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  hasCamera: boolean;
  hasLocation: boolean;
  hasPushNotifications: boolean;
  hasBiometrics: boolean;
  hasHaptics: boolean;
  hasFileSystem: boolean;
}

export interface AppInfo {
  version: string;
  build: string;
  id: string;
  name: string;
  platform: string;
  isNative: boolean;
}

export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  dialogTitle?: string;
  files?: string[];
}

class NativeService {
  private capabilities: NativeCapabilities | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private networkStatus: NetworkStatus | null = null;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.initializeNativeFeatures();
    }
  }

  async initializeNativeFeatures(): Promise<void> {
    try {
      // Initialize device info
      this.deviceInfo = await Device.getInfo();
      
      // Initialize network status
      this.networkStatus = await Network.getStatus();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize capabilities
      this.capabilities = await this.detectCapabilities();
      
      // Configure status bar
      await this.configureStatusBar();
      
      // Hide splash screen
      await SplashScreen.hide();
      
      // Setup haptics
      if (this.capabilities.hasHaptics) {
        await this.setupHaptics();
      }

      console.log('Native features initialized successfully');
    } catch (error) {
      console.error('Failed to initialize native features:', error);
    }
  }

  private setupEventListeners(): void {
    // App state changes
    App.addListener('appStateChange', (state: AppState) => {
      console.log('App state changed', state);
      
      if (state.isActive) {
        this.handleAppForeground();
      } else {
        this.handleAppBackground();
      }
    });

    // App URL open (deep links)
    App.addListener('appUrlOpen', (event) => {
      console.log('App opened with URL:', event.url);
      this.handleDeepLink(event.url);
    });

    // Network status
    Network.addListener('networkStatusChange', (status) => {
      this.networkStatus = status;
      this.handleNetworkChange(status);
    });

    // Keyboard events
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.handleKeyboardShow(info.keyboardHeight);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        this.handleKeyboardHide();
      });
    }
  }

  private async detectCapabilities(): Promise<NativeCapabilities> {
    const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
    const isNative = Capacitor.isNativePlatform();

    let hasCamera = false;
    let hasLocation = false;
    let hasPushNotifications = false;
    let hasBiometrics = false;
    let hasHaptics = false;
    let hasFileSystem = false;

    if (isNative) {
      try {
        // Check camera
        hasCamera = true; // Available on all mobile platforms

        // Check location
        const locationPermission = await Geolocation.checkPermissions();
        hasLocation = locationPermission.location !== 'denied';

        // Check push notifications
        const notificationPermission = await LocalNotifications.checkPermissions();
        hasPushNotifications = notificationPermission.display !== 'denied';

        // Check haptics (iOS and modern Android)
        hasHaptics = platform === 'ios' || (platform === 'android' && this.deviceInfo?.androidSDKVersion && parseInt(this.deviceInfo.androidSDKVersion) >= 26);

        // Check file system
        hasFileSystem = true; // Available on all platforms

        // Check biometrics (would need additional plugin)
        hasBiometrics = platform === 'ios' || platform === 'android';

      } catch (error) {
        console.error('Error detecting capabilities:', error);
      }
    }

    return {
      isNative,
      platform,
      hasCamera,
      hasLocation,
      hasPushNotifications,
      hasBiometrics,
      hasHaptics,
      hasFileSystem
    };
  }

  // Camera functionality
  async takePhoto(): Promise<{success: boolean, image?: string, error?: string}> {
    if (!this.capabilities?.hasCamera) {
      return { success: false, error: 'カメラが利用できません' };
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      return { success: true, image: image.dataUrl };
    } catch (error) {
      console.error('Camera error:', error);
      return { success: false, error: '写真の撮影に失敗しました' };
    }
  }

  async pickPhoto(): Promise<{success: boolean, image?: string, error?: string}> {
    if (!this.capabilities?.hasCamera) {
      return { success: false, error: 'フォトライブラリが利用できません' };
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      return { success: true, image: image.dataUrl };
    } catch (error) {
      console.error('Photo picker error:', error);
      return { success: false, error: '写真の選択に失敗しました' };
    }
  }

  // Location functionality
  async getCurrentLocation(): Promise<{success: boolean, position?: Position, error?: string}> {
    if (!this.capabilities?.hasLocation) {
      return { success: false, error: '位置情報が利用できません' };
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      return { success: true, position };
    } catch (error) {
      console.error('Location error:', error);
      return { success: false, error: '位置情報の取得に失敗しました' };
    }
  }

  async requestLocationPermission(): Promise<boolean> {
    try {
      const permission = await Geolocation.requestPermissions();
      return permission.location === 'granted';
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  // File system functionality
  async saveFile(filename: string, data: string, mimeType: string = 'text/plain'): Promise<{success: boolean, path?: string, error?: string}> {
    if (!this.capabilities?.hasFileSystem) {
      return { success: false, error: 'ファイル保存が利用できません' };
    }

    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return { success: true, path: result.uri };
    } catch (error) {
      console.error('File save error:', error);
      return { success: false, error: 'ファイルの保存に失敗しました' };
    }
  }

  async readFile(path: string): Promise<{success: boolean, data?: string, error?: string}> {
    try {
      const result = await Filesystem.readFile({
        path: path,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return { success: true, data: result.data as string };
    } catch (error) {
      console.error('File read error:', error);
      return { success: false, error: 'ファイルの読み込みに失敗しました' };
    }
  }

  // Share functionality
  async shareContent(options: ShareOptions): Promise<{success: boolean, error?: string}> {
    try {
      await Share.share(options);
      return { success: true };
    } catch (error) {
      console.error('Share error:', error);
      return { success: false, error: '共有に失敗しました' };
    }
  }

  // Haptics
  async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    if (!this.capabilities?.hasHaptics) return;

    try {
      const impactStyle = style === 'light' ? ImpactStyle.Light :
                         style === 'heavy' ? ImpactStyle.Heavy :
                         ImpactStyle.Medium;

      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.error('Haptics error:', error);
    }
  }

  async hapticSuccess(): Promise<void> {
    if (!this.capabilities?.hasHaptics) return;

    try {
      await Haptics.notification({ type: 'SUCCESS' });
    } catch (error) {
      console.error('Haptics error:', error);
    }
  }

  async hapticWarning(): Promise<void> {
    if (!this.capabilities?.hasHaptics) return;

    try {
      await Haptics.notification({ type: 'WARNING' });
    } catch (error) {
      console.error('Haptics error:', error);
    }
  }

  async hapticError(): Promise<void> {
    if (!this.capabilities?.hasHaptics) return;

    try {
      await Haptics.notification({ type: 'ERROR' });
    } catch (error) {
      console.error('Haptics error:', error);
    }
  }

  // Browser functionality
  async openUrl(url: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  }

  async openInAppBrowser(url: string): Promise<void> {
    await Browser.open({
      url,
      windowName: '_blank',
      toolbarColor: '#1976d2',
      presentationStyle: 'popover'
    });
  }

  // Local notifications
  async scheduleLocalNotification(options: {
    title: string;
    body: string;
    id: number;
    schedule?: Date;
    extra?: any;
  }): Promise<{success: boolean, error?: string}> {
    if (!this.capabilities?.hasPushNotifications) {
      return { success: false, error: '通知が利用できません' };
    }

    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: options.title,
          body: options.body,
          id: options.id,
          schedule: options.schedule ? { at: options.schedule } : undefined,
          extra: options.extra,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#1976d2'
        }]
      });

      return { success: true };
    } catch (error) {
      console.error('Local notification error:', error);
      return { success: false, error: '通知のスケジュールに失敗しました' };
    }
  }

  // App info
  getAppInfo(): AppInfo {
    return {
      version: this.deviceInfo?.appVersion || '1.0.0',
      build: this.deviceInfo?.appBuild || '1',
      id: this.deviceInfo?.appId || 'com.creditvisual.app',
      name: this.deviceInfo?.appName || 'Credit Visual',
      platform: this.deviceInfo?.platform || 'web',
      isNative: Capacitor.isNativePlatform()
    };
  }

  // Network status
  getNetworkStatus(): NetworkStatus | null {
    return this.networkStatus;
  }

  isOnline(): boolean {
    return this.networkStatus?.connected || navigator.onLine;
  }

  // Device info
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  getCapabilities(): NativeCapabilities | null {
    return this.capabilities;
  }

  // Private methods
  private async configureStatusBar(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#1976d2' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (error) {
        console.error('Status bar configuration error:', error);
      }
    }
  }

  private async setupHaptics(): Promise<void> {
    try {
      // Test haptics availability
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.error('Haptics setup error:', error);
      if (this.capabilities) {
        this.capabilities.hasHaptics = false;
      }
    }
  }

  private handleAppForeground(): void {
    console.log('App came to foreground');
    
    // Trigger app foreground event
    window.dispatchEvent(new CustomEvent('app-foreground'));
    
    // Update network status
    Network.getStatus().then(status => {
      this.networkStatus = status;
    });
  }

  private handleAppBackground(): void {
    console.log('App went to background');
    
    // Trigger app background event
    window.dispatchEvent(new CustomEvent('app-background'));
  }

  private handleDeepLink(url: string): void {
    console.log('Handling deep link:', url);
    
    // Parse deep link and navigate
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Trigger deep link event
    window.dispatchEvent(new CustomEvent('deep-link', {
      detail: { url, path, params: urlObj.searchParams }
    }));
  }

  private handleNetworkChange(status: NetworkStatus): void {
    console.log('Network status changed:', status);
    
    // Trigger network change event
    window.dispatchEvent(new CustomEvent('network-change', {
      detail: status
    }));
  }

  private handleKeyboardShow(height: number): void {
    // Adjust UI for keyboard
    document.body.style.paddingBottom = `${height}px`;
    
    window.dispatchEvent(new CustomEvent('keyboard-show', {
      detail: { height }
    }));
  }

  private handleKeyboardHide(): void {
    // Reset UI
    document.body.style.paddingBottom = '0px';
    
    window.dispatchEvent(new CustomEvent('keyboard-hide'));
  }

  // Cleanup
  destroy(): void {
    // Remove listeners if needed
    if (this.capabilities?.isNative) {
      // Cleanup would go here
    }
  }
}

export const nativeService = new NativeService();