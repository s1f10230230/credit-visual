import { featureGateService } from './featureGateService';

export interface AdConfig {
  provider: 'admob' | 'meta' | 'unity';
  adUnitId: string;
  testMode: boolean;
  frequency: {
    banner: 'always' | 'never';
    interstitial: number; // every N actions
    rewarded: 'on_demand';
  };
}

export interface AdPlacement {
  id: string;
  type: 'banner' | 'interstitial' | 'rewarded' | 'native';
  position: 'top' | 'bottom' | 'middle' | 'overlay';
  size: 'small' | 'medium' | 'large' | 'adaptive';
  trigger?: string; // action that triggers ad
}

export interface AdRevenue {
  impressions: number;
  clicks: number;
  revenue: number; // in JPY
  ecpm: number; // effective cost per mille
  fillRate: number; // percentage
}

class AdService {
  private isInitialized = false;
  private actionCount = 0;
  private adPlacements: Map<string, AdPlacement> = new Map();
  private revenueTracking: AdRevenue = {
    impressions: 0,
    clicks: 0,
    revenue: 0,
    ecpm: 0,
    fillRate: 0
  };

  private config: AdConfig = {
    provider: 'admob',
    adUnitId: process.env.REACT_APP_ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/6300978111', // test ID
    testMode: process.env.NODE_ENV === 'development',
    frequency: {
      banner: 'always',
      interstitial: 3, // every 3 actions
      rewarded: 'on_demand'
    }
  };

  constructor() {
    this.initializeAdPlacements();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize based on platform
      if (this.isCapacitorApp()) {
        await this.initializeNativeAds();
      } else {
        await this.initializeWebAds();
      }

      this.isInitialized = true;
      console.log('Ad service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ad service:', error);
    }
  }

  async showBannerAd(containerId: string): Promise<boolean> {
    // Check if user has premium subscription
    if (!featureGateService.shouldShowAds()) {
      return false;
    }

    try {
      if (this.isCapacitorApp()) {
        return await this.showNativeBanner();
      } else {
        return await this.showWebBanner(containerId);
      }
    } catch (error) {
      console.error('Failed to show banner ad:', error);
      return false;
    }
  }

  async showInterstitialAd(): Promise<boolean> {
    if (!featureGateService.shouldShowAds()) {
      return false;
    }

    this.actionCount++;
    
    // Show interstitial every N actions
    if (this.actionCount % this.config.frequency.interstitial !== 0) {
      return false;
    }

    try {
      if (this.isCapacitorApp()) {
        return await this.showNativeInterstitial();
      } else {
        return await this.showWebInterstitial();
      }
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      return false;
    }
  }

  async showRewardedAd(): Promise<{watched: boolean, reward?: any}> {
    try {
      if (this.isCapacitorApp()) {
        return await this.showNativeRewarded();
      } else {
        return await this.showWebRewarded();
      }
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      return { watched: false };
    }
  }

  // Web-based ads (Google AdSense/Meta Audience Network)
  private async initializeWebAds(): Promise<void> {
    // Load Google AdSense
    await this.loadGoogleAdsense();
    
    // Load Meta Audience Network (if configured)
    if (process.env.REACT_APP_META_PLACEMENT_ID) {
      await this.loadMetaAudienceNetwork();
    }
  }

  private async loadGoogleAdsense(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + 
                  (process.env.REACT_APP_ADSENSE_CLIENT_ID || 'ca-pub-0000000000000000');
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load AdSense'));
      
      document.head.appendChild(script);
    });
  }

  private async loadMetaAudienceNetwork(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/fbadnw.js';
      script.async = true;
      
      script.onload = () => {
        (window as any).fbAdnw = (window as any).fbAdnw || {};
        (window as any).fbAdnw.init(process.env.REACT_APP_META_PLACEMENT_ID);
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Meta Audience Network'));
      
      document.head.appendChild(script);
    });
  }

  private async showWebBanner(containerId: string): Promise<boolean> {
    const container = document.getElementById(containerId);
    if (!container) return false;

    // Create AdSense banner
    const adElement = document.createElement('ins');
    adElement.className = 'adsbygoogle';
    adElement.style.display = 'block';
    adElement.setAttribute('data-ad-client', process.env.REACT_APP_ADSENSE_CLIENT_ID || '');
    adElement.setAttribute('data-ad-slot', process.env.REACT_APP_ADSENSE_BANNER_SLOT || '');
    adElement.setAttribute('data-ad-format', 'auto');
    adElement.setAttribute('data-full-width-responsive', 'true');

    container.appendChild(adElement);

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      this.trackAdImpression('banner');
      return true;
    } catch (error) {
      console.error('AdSense error:', error);
      container.removeChild(adElement);
      return false;
    }
  }

  private async showWebInterstitial(): Promise<boolean> {
    // For web, show overlay interstitial
    const overlay = this.createInterstitialOverlay();
    document.body.appendChild(overlay);
    
    this.trackAdImpression('interstitial');
    return true;
  }

  private createInterstitialOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const adContainer = document.createElement('div');
    adContainer.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 10px;
      max-width: 90%;
      max-height: 90%;
      position: relative;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: none;
      font-size: 24px;
      cursor: pointer;
    `;

    closeButton.onclick = () => {
      document.body.removeChild(overlay);
    };

    // Add actual ad content here
    const adContent = document.createElement('div');
    adContent.innerHTML = `
      <h3>プレミアムプランのご案内</h3>
      <p>広告なしで快適にご利用いただけます</p>
      <button onclick="window.dispatchEvent(new CustomEvent('upgrade-to-premium'))" 
              style="background: #1976d2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
        今すぐアップグレード
      </button>
    `;

    adContainer.appendChild(closeButton);
    adContainer.appendChild(adContent);
    overlay.appendChild(adContainer);

    // Auto-close after 5 seconds
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 5000);

    return overlay;
  }

  private async showWebRewarded(): Promise<{watched: boolean, reward?: any}> {
    return new Promise((resolve) => {
      const overlay = this.createRewardedOverlay((watched, reward) => {
        resolve({ watched, reward });
      });
      document.body.appendChild(overlay);
    });
  }

  private createRewardedOverlay(callback: (watched: boolean, reward?: any) => void): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      max-width: 80%;
    `;

    container.innerHTML = `
      <h3>🎁 報酬を獲得</h3>
      <p>30秒の動画を視聴して、エクスポート制限を1回分解除</p>
      <div style="margin: 20px 0;">
        <button id="watch-ad" style="background: #4CAF50; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; margin-right: 10px;">
          動画を視聴
        </button>
        <button id="cancel-ad" style="background: #f44336; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer;">
          キャンセル
        </button>
      </div>
    `;

    const watchButton = container.querySelector('#watch-ad') as HTMLButtonElement;
    const cancelButton = container.querySelector('#cancel-ad') as HTMLButtonElement;

    watchButton.onclick = () => {
      // Simulate watching ad
      watchButton.textContent = '視聴中... 30秒';
      watchButton.disabled = true;
      
      let countdown = 30;
      const timer = setInterval(() => {
        countdown--;
        watchButton.textContent = `視聴中... ${countdown}秒`;
        
        if (countdown <= 0) {
          clearInterval(timer);
          document.body.removeChild(overlay);
          callback(true, { type: 'export_unlock', value: 1 });
        }
      }, 1000);
    };

    cancelButton.onclick = () => {
      document.body.removeChild(overlay);
      callback(false);
    };

    return overlay;
  }

  // Native app ads (via Capacitor)
  private async initializeNativeAds(): Promise<void> {
    try {
      // AdMob initialization
      const { AdMob } = await import('@capacitor-community/admob');
      
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        testingDevices: this.config.testMode ? ['YOUR_DEVICE_ID'] : [],
        initializeForTesting: this.config.testMode
      });

      console.log('Native AdMob initialized');
    } catch (error) {
      console.error('Failed to initialize native ads:', error);
    }
  }

  private async showNativeBanner(): Promise<boolean> {
    try {
      const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
      
      await AdMob.showBanner({
        adId: this.config.adUnitId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
      });

      this.trackAdImpression('banner');
      return true;
    } catch (error) {
      console.error('Failed to show native banner:', error);
      return false;
    }
  }

  private async showNativeInterstitial(): Promise<boolean> {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      
      await AdMob.prepareInterstitial({
        adId: process.env.REACT_APP_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-3940256099942544/1033173712'
      });

      await AdMob.showInterstitial();
      this.trackAdImpression('interstitial');
      return true;
    } catch (error) {
      console.error('Failed to show native interstitial:', error);
      return false;
    }
  }

  private async showNativeRewarded(): Promise<{watched: boolean, reward?: any}> {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      
      await AdMob.prepareRewardVideoAd({
        adId: process.env.REACT_APP_ADMOB_REWARDED_ID || 'ca-app-pub-3940256099942544/5224354917'
      });

      const result = await AdMob.showRewardVideoAd();
      
      if (result.rewarded) {
        this.trackAdImpression('rewarded');
        return { 
          watched: true, 
          reward: { type: 'export_unlock', value: 1 }
        };
      }
      
      return { watched: false };
    } catch (error) {
      console.error('Failed to show native rewarded ad:', error);
      return { watched: false };
    }
  }

  private isCapacitorApp(): boolean {
    return !!(window as any).Capacitor;
  }

  private trackAdImpression(type: string): void {
    this.revenueTracking.impressions++;
    
    // Track with analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'ad_impression', {
        ad_type: type,
        ad_provider: this.config.provider
      });
    }

    // Estimate revenue (these would be real values from ad networks)
    const estimatedRevenue = this.calculateEstimatedRevenue(type);
    this.revenueTracking.revenue += estimatedRevenue;
  }

  private calculateEstimatedRevenue(adType: string): number {
    // Estimated eCPM values for Japanese market
    const ecpmValues = {
      banner: 50, // ¥50 per 1000 impressions
      interstitial: 300, // ¥300 per 1000 impressions
      rewarded: 800 // ¥800 per 1000 impressions
    };

    return (ecpmValues[adType as keyof typeof ecpmValues] || 0) / 1000;
  }

  private initializeAdPlacements(): void {
    const placements: AdPlacement[] = [
      {
        id: 'main_banner',
        type: 'banner',
        position: 'bottom',
        size: 'adaptive',
      },
      {
        id: 'transaction_list_native',
        type: 'native',
        position: 'middle',
        size: 'medium',
      },
      {
        id: 'export_interstitial',
        type: 'interstitial',
        position: 'overlay',
        size: 'large',
        trigger: 'export_attempt'
      },
      {
        id: 'feature_unlock_rewarded',
        type: 'rewarded',
        position: 'overlay',
        size: 'large',
        trigger: 'premium_feature_blocked'
      }
    ];

    placements.forEach(placement => {
      this.adPlacements.set(placement.id, placement);
    });
  }

  // Public methods for revenue tracking
  getAdRevenue(): AdRevenue {
    return { ...this.revenueTracking };
  }

  getAdPlacements(): AdPlacement[] {
    return Array.from(this.adPlacements.values());
  }

  async trackAdClick(adType: string): Promise<void> {
    this.revenueTracking.clicks++;
    
    if (typeof gtag !== 'undefined') {
      gtag('event', 'ad_click', {
        ad_type: adType,
        ad_provider: this.config.provider
      });
    }
  }

  // A/B testing for ad frequency
  setAdFrequency(interstitialFrequency: number): void {
    this.config.frequency.interstitial = interstitialFrequency;
  }

  // Ad-free experience validation
  validateAdFreeUser(): boolean {
    return !featureGateService.shouldShowAds();
  }
}

export const adService = new AdService();