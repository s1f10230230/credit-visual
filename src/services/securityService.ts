import { CreditTransaction } from './analyticsService';

export interface SecuritySettings {
  biometricEnabled: boolean;
  dataEncryptionEnabled: boolean;
  autoLockTimeout: number; // minutes
  requireAuthForExport: boolean;
  allowAnalytics: boolean;
  dataRetentionDays: number;
}

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Fingerprint' | 'None';
  isEnrolled: boolean;
}

export interface EncryptedData {
  data: string;
  iv: string;
  timestamp: number;
}

export interface AnonymizedTransaction {
  amount: number;
  category: string;
  timestamp: number;
  dayOfWeek: number;
  hourOfDay: number;
  isWeekend: boolean;
}

class SecurityService {
  private readonly ENCRYPTION_KEY_NAME = 'credit_visual_master_key';
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private lastActivity: number = Date.now();
  private isAuthenticated: boolean = false;
  private encryptionKey: CryptoKey | null = null;

  constructor() {
    this.initializeSecurity();
    this.startSessionMonitoring();
  }

  async initializeSecurity(): Promise<void> {
    try {
      // Generate or retrieve encryption key
      await this.initializeEncryptionKey();
      
      // Set up security event listeners
      this.setupSecurityEventListeners();
      
    } catch (error) {
      console.error('Security initialization failed:', error);
    }
  }

  async authenticateWithBiometrics(): Promise<{success: boolean, error?: string}> {
    try {
      const capabilities = await this.getBiometricCapabilities();
      
      if (!capabilities.isAvailable) {
        return { success: false, error: '生体認証が利用できません' };
      }

      if (!capabilities.isEnrolled) {
        return { success: false, error: '生体認証が設定されていません' };
      }

      // Web Authentication API を使用
      if ('credentials' in navigator && 'create' in navigator.credentials) {
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: new Uint8Array(32),
            timeout: 60000,
            userVerification: 'required'
          }
        }) as PublicKeyCredential;

        if (credential) {
          this.isAuthenticated = true;
          this.updateActivity();
          return { success: true };
        }
      }

      // Fallback: Prompt for system authentication
      const result = await this.promptSystemAuthentication();
      if (result.success) {
        this.isAuthenticated = true;
        this.updateActivity();
      }
      
      return result;

    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return { success: false, error: '生体認証に失敗しました' };
    }
  }

  async getBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      // Check if Web Authentication API is available
      if ('credentials' in navigator && 'create' in navigator.credentials) {
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        
        return {
          isAvailable,
          biometryType: this.detectBiometryType(),
          isEnrolled: isAvailable
        };
      }

      return {
        isAvailable: false,
        biometryType: 'None',
        isEnrolled: false
      };

    } catch (error) {
      console.error('Failed to check biometric capabilities:', error);
      return {
        isAvailable: false,
        biometryType: 'None',
        isEnrolled: false
      };
    }
  }

  async encryptData(data: any): Promise<EncryptedData> {
    try {
      if (!this.encryptionKey) {
        await this.initializeEncryptionKey();
      }

      const jsonData = JSON.stringify(data);
      const encodedData = new TextEncoder().encode(jsonData);
      
      // Generate a random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        encodedData
      );

      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encryptedBase64 = btoa(String.fromCharCode.apply(null, Array.from(encryptedArray)));
      const ivBase64 = btoa(String.fromCharCode.apply(null, Array.from(iv)));

      return {
        data: encryptedBase64,
        iv: ivBase64,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('データの暗号化に失敗しました');
    }
  }

  async decryptData(encryptedData: EncryptedData): Promise<any> {
    try {
      if (!this.encryptionKey) {
        await this.initializeEncryptionKey();
      }

      // Convert base64 back to Uint8Array
      const encryptedArray = new Uint8Array(
        atob(encryptedData.data).split('').map(char => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(encryptedData.iv).split('').map(char => char.charCodeAt(0))
      );

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        encryptedArray
      );

      const decryptedData = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedData);

    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('データの復号化に失敗しました');
    }
  }

  anonymizeForAnalytics(transactions: CreditTransaction[]): AnonymizedTransaction[] {
    return transactions.map(tx => {
      const date = new Date(tx.date);
      
      return {
        amount: tx.amount,
        category: tx.category,
        timestamp: Math.floor(date.getTime() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000), // Day precision only
        dayOfWeek: date.getDay(),
        hourOfDay: date.getHours(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      };
    });
  }

  async secureExport(data: any, format: 'csv' | 'pdf'): Promise<{success: boolean, data?: string, error?: string}> {
    try {
      // Require authentication for export
      if (!this.isAuthenticated) {
        const authResult = await this.authenticateWithBiometrics();
        if (!authResult.success) {
          return { success: false, error: authResult.error };
        }
      }

      // Encrypt the export data
      const encryptedData = await this.encryptData(data);
      
      // Log the export activity
      this.logSecurityEvent('data_export', { format, timestamp: Date.now() });

      return {
        success: true,
        data: JSON.stringify(encryptedData)
      };

    } catch (error) {
      console.error('Secure export failed:', error);
      return { success: false, error: 'エクスポートに失敗しました' };
    }
  }

  validateDataIntegrity(data: any, expectedHash?: string): boolean {
    try {
      // Simple integrity check using hash comparison
      const dataString = JSON.stringify(data);
      const hashBuffer = new TextEncoder().encode(dataString);
      
      // In a real implementation, use a proper hash function
      let hash = 0;
      for (let i = 0; i < hashBuffer.length; i++) {
        hash = ((hash << 5) - hash + hashBuffer[i]) & 0xffffffff;
      }
      
      const computedHash = hash.toString(36);
      
      if (expectedHash) {
        return computedHash === expectedHash;
      }
      
      // Store the hash for future validation
      localStorage.setItem('dataIntegrityHash', computedHash);
      return true;

    } catch (error) {
      console.error('Data integrity validation failed:', error);
      return false;
    }
  }

  getSecuritySettings(): SecuritySettings {
    const defaultSettings: SecuritySettings = {
      biometricEnabled: false,
      dataEncryptionEnabled: true,
      autoLockTimeout: 15,
      requireAuthForExport: true,
      allowAnalytics: false,
      dataRetentionDays: 365
    };

    try {
      const stored = localStorage.getItem('securitySettings');
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load security settings:', error);
    }

    return defaultSettings;
  }

  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<void> {
    try {
      const currentSettings = this.getSecuritySettings();
      const newSettings = { ...currentSettings, ...settings };
      
      localStorage.setItem('securitySettings', JSON.stringify(newSettings));
      
      this.logSecurityEvent('settings_changed', { 
        changes: Object.keys(settings),
        timestamp: Date.now() 
      });

    } catch (error) {
      console.error('Failed to update security settings:', error);
      throw new Error('セキュリティ設定の更新に失敗しました');
    }
  }

  isSessionValid(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
      this.isAuthenticated = false;
      return false;
    }
    
    return this.isAuthenticated;
  }

  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  logout(): void {
    this.isAuthenticated = false;
    this.lastActivity = 0;
    this.logSecurityEvent('logout', { timestamp: Date.now() });
  }

  async cleanupExpiredData(): Promise<void> {
    try {
      const settings = this.getSecuritySettings();
      const cutoffDate = new Date(Date.now() - settings.dataRetentionDays * 24 * 60 * 60 * 1000);
      
      // Clean up old transaction data
      const storedTransactions = localStorage.getItem('transactions');
      if (storedTransactions) {
        const transactions = JSON.parse(storedTransactions);
        const filteredTransactions = transactions.filter((tx: CreditTransaction) => 
          new Date(tx.date) > cutoffDate
        );
        
        localStorage.setItem('transactions', JSON.stringify(filteredTransactions));
      }

      // Clean up old security logs
      this.cleanupSecurityLogs();

    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }

  private async initializeEncryptionKey(): Promise<void> {
    try {
      // Try to load existing key
      const storedKey = localStorage.getItem(this.ENCRYPTION_KEY_NAME);
      
      if (storedKey) {
        // Import existing key
        const keyData = JSON.parse(storedKey);
        this.encryptionKey = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        // Export and store the key
        const exportedKey = await crypto.subtle.exportKey('jwk', this.encryptionKey);
        localStorage.setItem(this.ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
      }

    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('暗号化キーの初期化に失敗しました');
    }
  }

  private detectBiometryType(): 'TouchID' | 'FaceID' | 'Fingerprint' | 'None' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'FaceID'; // Assume FaceID for newer iOS devices
    } else if (userAgent.includes('android')) {
      return 'Fingerprint';
    } else if (userAgent.includes('mac')) {
      return 'TouchID';
    }
    
    return 'None';
  }

  private async promptSystemAuthentication(): Promise<{success: boolean, error?: string}> {
    // Fallback authentication method
    return new Promise((resolve) => {
      const password = prompt('認証のため、パスワードを入力してください:');
      
      if (password) {
        // In a real implementation, verify against a secure hash
        resolve({ success: true });
      } else {
        resolve({ success: false, error: '認証がキャンセルされました' });
      }
    });
  }

  private setupSecurityEventListeners(): void {
    // Listen for visibility changes (app backgrounding)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logSecurityEvent('app_backgrounded', { timestamp: Date.now() });
      } else {
        this.updateActivity();
      }
    });

    // Listen for potential tampering
    window.addEventListener('beforeunload', () => {
      this.logSecurityEvent('app_closing', { timestamp: Date.now() });
    });
  }

  private startSessionMonitoring(): void {
    setInterval(() => {
      if (!this.isSessionValid() && this.isAuthenticated) {
        this.logout();
        // Trigger re-authentication UI
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
    }, 60000); // Check every minute
  }

  private logSecurityEvent(event: string, data: any): void {
    try {
      const logs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
      logs.push({
        event,
        data,
        timestamp: Date.now()
      });

      // Keep only last 100 logs
      const recentLogs = logs.slice(-100);
      localStorage.setItem('securityLogs', JSON.stringify(recentLogs));

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private cleanupSecurityLogs(): void {
    try {
      const logs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
      const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
      
      const recentLogs = logs.filter((log: any) => log.timestamp > cutoffDate);
      localStorage.setItem('securityLogs', JSON.stringify(recentLogs));

    } catch (error) {
      console.error('Failed to cleanup security logs:', error);
    }
  }
}

export const securityService = new SecurityService();