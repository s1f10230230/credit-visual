import { gmailService } from './gmailService';
import { smartRecommendationService } from './smartRecommendationService';
import { subscriptionService } from './subscriptionService';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  component: string;
  required: boolean;
  estimatedTime: number; // minutes
  completed: boolean;
  skippable: boolean;
  prerequisites?: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  cards: string[];
  monthlyBudget: number;
  primaryCategories: string[];
  goals: string[];
  notificationPreferences: {
    budgetAlerts: boolean;
    cardRecommendations: boolean;
    dealAlerts: boolean;
    weeklyReports: boolean;
  };
}

export interface OnboardingAnalytics {
  stepStartTime: Map<string, number>;
  stepCompletionTime: Map<string, number>;
  dropOffPoints: string[];
  completionRate: number;
  averageTimeToComplete: number;
}

class OnboardingService {
  private currentStep = 0;
  private steps: OnboardingStep[] = [];
  private userProfile: Partial<UserProfile> = {};
  private analytics: OnboardingAnalytics = {
    stepStartTime: new Map(),
    stepCompletionTime: new Map(),
    dropOffPoints: [],
    completionRate: 0,
    averageTimeToComplete: 0
  };

  constructor() {
    this.initializeSteps();
  }

  private initializeSteps(): void {
    this.steps = [
      {
        id: 'welcome',
        title: 'ようこそ！',
        description: 'クレジットカード支出を自動で分析・最適化するアプリです',
        icon: '👋',
        component: 'WelcomeStep',
        required: true,
        estimatedTime: 1,
        completed: false,
        skippable: false
      },
      {
        id: 'profile_setup',
        title: 'プロフィール設定',
        description: 'お名前と基本情報を入力してください',
        icon: '👤',
        component: 'ProfileSetupStep',
        required: true,
        estimatedTime: 2,
        completed: false,
        skippable: false
      },
      {
        id: 'gmail_connection',
        title: 'Gmail連携',
        description: 'カード明細メールを自動取得します',
        icon: '📧',
        component: 'GmailConnectionStep',
        required: true,
        estimatedTime: 3,
        completed: false,
        skippable: false
      },
      {
        id: 'card_selection',
        title: 'カード選択',
        description: 'お持ちのクレジットカードを選択してください',
        icon: '💳',
        component: 'CardSelectionStep',
        required: true,
        estimatedTime: 2,
        completed: false,
        skippable: false,
        prerequisites: ['gmail_connection']
      },
      {
        id: 'budget_setup',
        title: '予算設定',
        description: '月間予算とカテゴリ別目標を設定',
        icon: '💰',
        component: 'BudgetSetupStep',
        required: false,
        estimatedTime: 3,
        completed: false,
        skippable: true
      },
      {
        id: 'notification_preferences',
        title: '通知設定',
        description: 'お得情報やアラートの受信設定',
        icon: '🔔',
        component: 'NotificationPreferencesStep',
        required: false,
        estimatedTime: 2,
        completed: false,
        skippable: true
      },
      {
        id: 'trial_offer',
        title: 'プレミアム体験',
        description: '7日間無料でプレミアム機能をお試し',
        icon: '✨',
        component: 'TrialOfferStep',
        required: false,
        estimatedTime: 1,
        completed: false,
        skippable: true
      },
      {
        id: 'completion',
        title: '設定完了',
        description: 'すべて準備が整いました！',
        icon: '🎉',
        component: 'CompletionStep',
        required: true,
        estimatedTime: 1,
        completed: false,
        skippable: false
      }
    ];
  }

  async startOnboarding(): Promise<void> {
    this.currentStep = 0;
    this.recordStepStart(this.steps[0].id);
    
    // Track onboarding start
    this.trackEvent('onboarding_started', {
      timestamp: Date.now(),
      user_agent: navigator.userAgent
    });
  }

  getCurrentStep(): OnboardingStep {
    return this.steps[this.currentStep];
  }

  getAllSteps(): OnboardingStep[] {
    return this.steps;
  }

  getProgress(): {
    currentStep: number;
    totalSteps: number;
    percentage: number;
    estimatedTimeRemaining: number;
  } {
    const completedSteps = this.steps.filter(step => step.completed).length;
    const remainingSteps = this.steps.slice(this.currentStep);
    const estimatedTimeRemaining = remainingSteps.reduce((total, step) => total + step.estimatedTime, 0);

    return {
      currentStep: this.currentStep + 1,
      totalSteps: this.steps.length,
      percentage: (completedSteps / this.steps.length) * 100,
      estimatedTimeRemaining
    };
  }

  async nextStep(): Promise<{success: boolean, nextStep?: OnboardingStep, error?: string}> {
    const currentStep = this.steps[this.currentStep];
    
    // Validate current step completion
    const validation = await this.validateStepCompletion(currentStep);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Mark current step as completed
    this.recordStepCompletion(currentStep.id);
    currentStep.completed = true;

    // Move to next step
    this.currentStep++;
    
    if (this.currentStep >= this.steps.length) {
      return await this.completeOnboarding();
    }

    const nextStep = this.steps[this.currentStep];
    
    // Check prerequisites
    if (nextStep.prerequisites) {
      const prerequisitesMet = this.checkPrerequisites(nextStep.prerequisites);
      if (!prerequisitesMet) {
        return {
          success: false,
          error: '前のステップを完了してください'
        };
      }
    }

    this.recordStepStart(nextStep.id);
    
    return {
      success: true,
      nextStep
    };
  }

  async skipStep(): Promise<{success: boolean, nextStep?: OnboardingStep, error?: string}> {
    const currentStep = this.steps[this.currentStep];
    
    if (!currentStep.skippable) {
      return {
        success: false,
        error: 'このステップはスキップできません'
      };
    }

    // Track skip event
    this.trackEvent('step_skipped', {
      step_id: currentStep.id,
      step_title: currentStep.title
    });

    // Move to next step without validation
    this.currentStep++;
    
    if (this.currentStep >= this.steps.length) {
      return await this.completeOnboarding();
    }

    const nextStep = this.steps[this.currentStep];
    this.recordStepStart(nextStep.id);

    return {
      success: true,
      nextStep
    };
  }

  async previousStep(): Promise<{success: boolean, previousStep?: OnboardingStep}> {
    if (this.currentStep <= 0) {
      return { success: false };
    }

    this.currentStep--;
    const previousStep = this.steps[this.currentStep];
    
    return {
      success: true,
      previousStep
    };
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
    this.userProfile = { ...this.userProfile, ...updates };
    
    // Save to local storage
    localStorage.setItem('onboarding_profile', JSON.stringify(this.userProfile));
  }

  getUserProfile(): Partial<UserProfile> {
    return this.userProfile;
  }

  async validateStepCompletion(step: OnboardingStep): Promise<{valid: boolean, error?: string}> {
    switch (step.id) {
      case 'profile_setup':
        if (!this.userProfile.name || !this.userProfile.email) {
          return { valid: false, error: '名前とメールアドレスを入力してください' };
        }
        break;

      case 'gmail_connection':
        try {
          const isConnected = await gmailService.isAuthenticated();
          if (!isConnected) {
            return { valid: false, error: 'Gmailアカウントを連携してください' };
          }
        } catch (error) {
          return { valid: false, error: 'Gmail連携に失敗しました' };
        }
        break;

      case 'card_selection':
        if (!this.userProfile.cards || this.userProfile.cards.length === 0) {
          return { valid: false, error: '少なくとも1枚のカードを選択してください' };
        }
        break;

      case 'budget_setup':
        if (step.required && !this.userProfile.monthlyBudget) {
          return { valid: false, error: '月間予算を設定してください' };
        }
        break;

      default:
        break;
    }

    return { valid: true };
  }

  private checkPrerequisites(prerequisites: string[]): boolean {
    return prerequisites.every(prereqId => {
      const prereqStep = this.steps.find(step => step.id === prereqId);
      return prereqStep?.completed === true;
    });
  }

  private async completeOnboarding(): Promise<{success: boolean, error?: string}> {
    try {
      // Initialize services with user data
      if (this.userProfile.cards) {
        smartRecommendationService.setUserCards(this.userProfile.cards);
      }

      // Setup notification preferences
      if (this.userProfile.notificationPreferences) {
        await this.setupNotifications();
      }

      // Track completion
      this.trackEvent('onboarding_completed', {
        completion_time: Date.now(),
        steps_completed: this.steps.filter(s => s.completed).length,
        steps_skipped: this.steps.filter(s => !s.completed && s.skippable).length
      });

      // Mark onboarding as completed
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('onboarding_completion_date', new Date().toISOString());

      // Initialize app services
      await this.initializeAppServices();

      return { success: true };

    } catch (error) {
      console.error('Onboarding completion failed:', error);
      return { 
        success: false, 
        error: 'セットアップの完了中にエラーが発生しました' 
      };
    }
  }

  private async setupNotifications(): Promise<void> {
    const prefs = this.userProfile.notificationPreferences;
    if (!prefs) return;

    // Request notification permission
    if ('Notification' in window && prefs.budgetAlerts) {
      await Notification.requestPermission();
    }

    // Setup push notifications if available
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.pushManager) {
          // Setup push subscription
          await this.setupPushNotifications(registration);
        }
      } catch (error) {
        console.error('Push notification setup failed:', error);
      }
    }
  }

  private async setupPushNotifications(registration: ServiceWorkerRegistration): Promise<void> {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
      });

      // Send subscription to server
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          preferences: this.userProfile.notificationPreferences
        })
      });
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }

  private async initializeAppServices(): Promise<void> {
    // Start background services
    await smartRecommendationService.setupRealTimeAlerts();
    
    // Initial data fetch
    if (await gmailService.isAuthenticated()) {
      // Trigger initial email fetch in background
      setTimeout(() => {
        gmailService.fetchCreditCardEmails()
          .then(() => console.log('Initial email fetch completed'))
          .catch(err => console.error('Initial email fetch failed:', err));
      }, 2000);
    }
  }

  private recordStepStart(stepId: string): void {
    this.analytics.stepStartTime.set(stepId, Date.now());
  }

  private recordStepCompletion(stepId: string): void {
    const startTime = this.analytics.stepStartTime.get(stepId);
    if (startTime) {
      this.analytics.stepCompletionTime.set(stepId, Date.now() - startTime);
    }
  }

  private trackEvent(eventName: string, data: any): void {
    // Analytics tracking
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, {
        event_category: 'onboarding',
        ...data
      });
    }

    // Internal analytics
    console.log(`Onboarding Event: ${eventName}`, data);
  }

  // Public methods for specific steps

  async connectGmail(): Promise<{success: boolean, error?: string}> {
    try {
      const result = await gmailService.authenticate();
      if (result.success) {
        await this.updateUserProfile({ email: result.email });
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: 'Gmail連携に失敗しました' };
    }
  }

  async selectCards(cards: string[]): Promise<void> {
    await this.updateUserProfile({ cards });
    smartRecommendationService.setUserCards(cards);
  }

  async setBudget(monthlyBudget: number, categoryBudgets?: {[category: string]: number}): Promise<void> {
    await this.updateUserProfile({ 
      monthlyBudget,
      // Could also store category budgets
    });
  }

  async setNotificationPreferences(preferences: UserProfile['notificationPreferences']): Promise<void> {
    await this.updateUserProfile({ notificationPreferences: preferences });
  }

  async offerTrial(): Promise<{accepted: boolean, error?: string}> {
    try {
      const result = await subscriptionService.startTrial('default-user');
      if (result.success) {
        this.trackEvent('trial_accepted', {
          trial_type: 'onboarding_offer'
        });
        return { accepted: true };
      }
      return { accepted: false, error: result.message };
    } catch (error) {
      return { accepted: false, error: 'トライアルの開始に失敗しました' };
    }
  }

  // Utility methods
  isOnboardingCompleted(): boolean {
    return localStorage.getItem('onboarding_completed') === 'true';
  }

  getOnboardingCompletionDate(): Date | null {
    const dateStr = localStorage.getItem('onboarding_completion_date');
    return dateStr ? new Date(dateStr) : null;
  }

  resetOnboarding(): void {
    localStorage.removeItem('onboarding_completed');
    localStorage.removeItem('onboarding_completion_date');
    localStorage.removeItem('onboarding_profile');
    this.currentStep = 0;
    this.userProfile = {};
    this.steps.forEach(step => step.completed = false);
  }

  getAnalytics(): OnboardingAnalytics {
    return { ...this.analytics };
  }

  // A/B testing for onboarding flow
  getOnboardingVariant(): 'default' | 'premium_first' | 'minimal' {
    // Simple A/B test based on user ID hash
    const userId = this.userProfile.email || 'anonymous';
    const hash = this.simpleHash(userId);
    
    if (hash % 3 === 0) return 'premium_first';
    if (hash % 3 === 1) return 'minimal';
    return 'default';
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const onboardingService = new OnboardingService();