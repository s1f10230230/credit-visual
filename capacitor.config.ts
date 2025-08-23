import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.creditvisual.app',
  appName: 'Credit Visual',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1976d2",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1976d2',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#1976d2",
      sound: "beep.wav",
    },
    Camera: {
      permissions: {
        camera: "カメラでレシートを撮影します",
        photos: "写真ライブラリからレシートを選択します"
      }
    },
    Geolocation: {
      permissions: {
        location: "お近くのお得情報をお届けするために位置情報を使用します"
      }
    },
    Device: {
      permissions: {
        device: "デバイス情報でセキュリティを向上します"
      }
    },
    App: {
      permissions: {
        background: "バックグラウンドで取引を同期します"
      }
    },
    Haptics: {},
    Share: {},
    Browser: {
      permissions: {
        browser: "外部リンクを開くために使用します"
      }
    },
    Network: {},
    Storage: {},
    Filesystem: {
      permissions: {
        publicStorage: "エクスポートファイルを保存します"
      }
    }
  },
  ios: {
    scheme: 'Credit Visual',
    contentInset: 'automatic',
    allowsLinkPreview: false,
    handleApplicationLifecycle: true,
    backgroundColor: '#1976d2'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK',
      signingType: 'apksigner'
    },
    permissions: [
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'ACCESS_WIFI_STATE',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'VIBRATE',
      'WAKE_LOCK',
      'RECEIVE_BOOT_COMPLETED',
      'FOREGROUND_SERVICE',
      'SYSTEM_ALERT_WINDOW'
    ],
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#1976d2',
    overrideUserAgent: 'Credit Visual Android App',
    appendUserAgent: 'CreditVisual/1.0',
    useLegacyBridge: false
  }
};

export default config;