import { monetizationService } from "./monetizationService";
import { featureGateService } from "./featureGateService";

export interface NotificationConfig {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationSchedule {
  id: string;
  config: NotificationConfig;
  trigger: "immediate" | "daily" | "weekly" | "monthly";
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
}

class NotificationService {
  private isSupported: boolean;
  private permission: NotificationPermission = "default";
  private scheduledNotifications: Map<string, NotificationSchedule> = new Map();
  private notificationCount = 0;

  constructor() {
    this.isSupported = "Notification" in window;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.isSupported) {
      console.warn("Notifications not supported in this browser");
      return;
    }

    // 権限を確認
    this.permission = Notification.permission;

    // 権限が未設定の場合は要求
    if (this.permission === "default") {
      await this.requestPermission();
    }

    // スケジュールされた通知を復元
    this.restoreScheduledNotifications();

    // 定期的な通知チェックを開始
    this.startPeriodicChecks();
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }

  async sendNotification(config: NotificationConfig): Promise<boolean> {
    if (!this.isSupported || this.permission !== "granted") {
      return false;
    }

    try {
      const notification = new Notification(config.title, {
        body: config.body,
        icon: config.icon || "/icon-192x192.png",
        badge: config.badge || "/badge-72x72.png",
        tag: config.tag,
        data: config.data,
        requireInteraction: config.requireInteraction,
        actions: config.actions,
      });

      // 通知のクリックイベントを処理
      notification.onclick = () => {
        this.handleNotificationClick(config);
        notification.close();
      };

      // アクションボタンのクリックイベントを処理
      if (config.actions) {
        notification.onactionclick = (event) => {
          this.handleNotificationAction(config, event.action);
        };
      }

      this.notificationCount++;
      this.trackNotificationSent(config.id);

      return true;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return false;
    }
  }

  async scheduleNotification(schedule: NotificationSchedule): Promise<boolean> {
    if (!this.isSupported || this.permission !== "granted") {
      return false;
    }

    try {
      this.scheduledNotifications.set(schedule.id, schedule);
      this.saveScheduledNotifications();

      // スケジュールに基づいて通知を設定
      this.setupNotificationSchedule(schedule);

      return true;
    } catch (error) {
      console.error("Failed to schedule notification:", error);
      return false;
    }
  }

  async cancelScheduledNotification(notificationId: string): Promise<boolean> {
    try {
      this.scheduledNotifications.delete(notificationId);
      this.saveScheduledNotifications();
      return true;
    } catch (error) {
      console.error("Failed to cancel scheduled notification:", error);
      return false;
    }
  }

  // 予算関連の通知
  async sendBudgetAlert(
    currentSpending: number,
    budget: number,
    percentage: number
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: "budget_alert",
      title: "予算アラート",
      body: `今月の予算の${percentage}%を使用しました。残り予算: ¥${(
        budget - currentSpending
      ).toLocaleString()}`,
      tag: "budget_alert",
      requireInteraction: true,
      actions: [
        { action: "view_details", title: "詳細を見る" },
        { action: "set_alert", title: "アラート設定" },
      ],
    };

    return await this.sendNotification(config);
  }

  // 週次レポート通知
  async sendWeeklyReport(
    transactions: number,
    totalSpending: number,
    savings: number
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: "weekly_report",
      title: "週次レポート",
      body: `今週は${transactions}件の取引で¥${totalSpending.toLocaleString()}を使用。節約額: ¥${savings.toLocaleString()}`,
      tag: "weekly_report",
      actions: [
        { action: "view_report", title: "レポートを見る" },
        { action: "share", title: "共有" },
      ],
    };

    return await this.sendNotification(config);
  }

  // 機能紹介通知
  async sendFeatureIntroduction(
    featureName: string,
    benefit: string
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: `feature_intro_${featureName}`,
      title: "新機能のご案内",
      body: `${featureName}: ${benefit}`,
      tag: "feature_introduction",
      actions: [
        { action: "try_feature", title: "試してみる" },
        { action: "learn_more", title: "詳しく見る" },
      ],
    };

    return await this.sendNotification(config);
  }

  // プレミアム機能のトライアル誘導
  async sendPremiumTrialOffer(
    featureName: string,
    trialDays: number
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: "premium_trial_offer",
      title: "プレミアム機能をお試し",
      body: `${featureName}を${trialDays}日間無料でお試しいただけます`,
      tag: "premium_trial",
      requireInteraction: true,
      actions: [
        { action: "start_trial", title: "トライアル開始" },
        { action: "dismiss", title: "後で" },
      ],
    };

    return await this.sendNotification(config);
  }

  // カード最適化提案
  async sendCardOptimizationSuggestion(
    cardName: string,
    potentialSavings: number
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: "card_optimization",
      title: "カード最適化の提案",
      body: `${cardName}の利用で年間約¥${potentialSavings.toLocaleString()}の節約が期待できます`,
      tag: "card_optimization",
      actions: [
        { action: "view_analysis", title: "分析を見る" },
        { action: "apply_card", title: "カードを適用" },
      ],
    };

    return await this.sendNotification(config);
  }

  // 異常支出の検知通知
  async sendAnomalyAlert(
    amount: number,
    merchant: string,
    category: string
  ): Promise<boolean> {
    const config: NotificationConfig = {
      id: "anomaly_alert",
      title: "異常支出の検知",
      body: `${merchant}で¥${amount.toLocaleString()}の${category}支出が検知されました`,
      tag: "anomaly_alert",
      requireInteraction: true,
      actions: [
        { action: "review", title: "確認する" },
        { action: "dismiss", title: "問題なし" },
      ],
    };

    return await this.sendNotification(config);
  }

  // 通知クリックの処理
  private handleNotificationClick(config: NotificationConfig): void {
    // 通知の種類に応じて適切なアクションを実行
    switch (config.tag) {
      case "budget_alert":
        this.navigateToBudgetPage();
        break;
      case "weekly_report":
        this.navigateToAnalyticsPage();
        break;
      case "feature_introduction":
        this.navigateToFeaturePage(config.data?.featureId);
        break;
      case "premium_trial":
        this.showPremiumUpgradeModal();
        break;
      case "card_optimization":
        this.navigateToCardOptimizationPage();
        break;
      case "anomaly_alert":
        this.navigateToTransactionPage(config.data?.transactionId);
        break;
    }
  }

  // 通知アクションの処理
  private handleNotificationAction(
    config: NotificationConfig,
    action: string
  ): void {
    switch (action) {
      case "view_details":
        this.navigateToBudgetPage();
        break;
      case "set_alert":
        this.showBudgetAlertSettings();
        break;
      case "view_report":
        this.navigateToAnalyticsPage();
        break;
      case "share":
        this.shareWeeklyReport();
        break;
      case "try_feature":
        this.startFeatureTrial(config.data?.featureId);
        break;
      case "learn_more":
        this.showFeatureDetails(config.data?.featureId);
        break;
      case "start_trial":
        this.startPremiumTrial();
        break;
      case "view_analysis":
        this.navigateToCardOptimizationPage();
        break;
      case "apply_card":
        this.applyCardOptimization(config.data?.cardId);
        break;
      case "review":
        this.navigateToTransactionPage(config.data?.transactionId);
        break;
    }
  }

  // スケジュール通知の設定
  private setupNotificationSchedule(schedule: NotificationSchedule): void {
    switch (schedule.trigger) {
      case "daily":
        this.scheduleDailyNotification(schedule);
        break;
      case "weekly":
        this.scheduleWeeklyNotification(schedule);
        break;
      case "monthly":
        this.scheduleMonthlyNotification(schedule);
        break;
    }
  }

  private scheduleDailyNotification(schedule: NotificationSchedule): void {
    if (!schedule.time) return;

    const [hours, minutes] = schedule.time.split(":").map(Number);
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes
    );

    // 今日の時間が過ぎている場合は明日に設定
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      this.sendNotification(schedule.config);
      // 翌日も同じ時間に通知
      this.scheduleDailyNotification(schedule);
    }, delay);
  }

  private scheduleWeeklyNotification(schedule: NotificationSchedule): void {
    if (schedule.dayOfWeek === undefined) return;

    const now = new Date();
    const targetDay = schedule.dayOfWeek;
    const currentDay = now.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }

    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysUntilTarget,
      9,
      0
    );
    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      this.sendNotification(schedule.config);
      // 翌週も同じ曜日に通知
      this.scheduleWeeklyNotification(schedule);
    }, delay);
  }

  private scheduleMonthlyNotification(schedule: NotificationSchedule): void {
    if (schedule.dayOfMonth === undefined) return;

    const now = new Date();
    const targetDay = schedule.dayOfMonth;
    const currentDay = now.getDate();

    let scheduledTime: Date;
    if (currentDay < targetDay) {
      scheduledTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        targetDay,
        9,
        0
      );
    } else {
      scheduledTime = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        targetDay,
        9,
        0
      );
    }

    const delay = scheduledTime.getTime() - now.getTime();

    setTimeout(() => {
      this.sendNotification(schedule.config);
      // 翌月も同じ日に通知
      this.scheduleMonthlyNotification(schedule);
    }, delay);
  }

  // 定期的なチェックを開始
  private startPeriodicChecks(): void {
    // 毎日午前9時に予算チェック
    setInterval(() => {
      this.checkBudgetStatus();
    }, 24 * 60 * 60 * 1000);

    // 毎週月曜日に週次レポート
    setInterval(() => {
      this.generateWeeklyReport();
    }, 7 * 24 * 60 * 60 * 1000);
  }

  private async checkBudgetStatus(): Promise<void> {
    // 予算状況をチェックして必要に応じて通知
    const budget = parseInt(localStorage.getItem("monthlyBudget") || "0");
    const currentSpending = this.getCurrentMonthSpending();

    if (budget > 0 && currentSpending > 0) {
      const percentage = Math.round((currentSpending / budget) * 100);

      if (percentage >= 80) {
        await this.sendBudgetAlert(currentSpending, budget, percentage);
      }
    }
  }

  private async generateWeeklyReport(): Promise<void> {
    // 週次レポートを生成して通知
    const weeklyData = this.getWeeklyData();

    if (weeklyData.transactions > 0) {
      await this.sendWeeklyReport(
        weeklyData.transactions,
        weeklyData.totalSpending,
        weeklyData.savings
      );
    }
  }

  // ヘルパーメソッド
  private getCurrentMonthSpending(): number {
    // 実際のアプリでは、データベースやストレージから取得
    return parseInt(localStorage.getItem("currentMonthSpending") || "0");
  }

  private getWeeklyData(): {
    transactions: number;
    totalSpending: number;
    savings: number;
  } {
    // 実際のアプリでは、データベースやストレージから取得
    return {
      transactions: parseInt(localStorage.getItem("weeklyTransactions") || "0"),
      totalSpending: parseInt(localStorage.getItem("weeklySpending") || "0"),
      savings: parseInt(localStorage.getItem("weeklySavings") || "0"),
    };
  }

  private saveScheduledNotifications(): void {
    const data = Array.from(this.scheduledNotifications.values());
    localStorage.setItem("scheduledNotifications", JSON.stringify(data));
  }

  private restoreScheduledNotifications(): void {
    try {
      const stored = localStorage.getItem("scheduledNotifications");
      if (stored) {
        const data: NotificationSchedule[] = JSON.parse(stored);
        data.forEach((schedule) => {
          this.scheduledNotifications.set(schedule.id, schedule);
          this.setupNotificationSchedule(schedule);
        });
      }
    } catch (error) {
      console.error("Failed to restore scheduled notifications:", error);
    }
  }

  private trackNotificationSent(notificationId: string): void {
    // 分析用のトラッキング
    if (typeof gtag !== "undefined") {
      gtag("event", "notification_sent", {
        notification_id: notificationId,
        timestamp: Date.now(),
      });
    }
  }

  // ナビゲーション関連のメソッド（実際のアプリでは適切なルーティングを使用）
  private navigateToBudgetPage(): void {
    window.dispatchEvent(
      new CustomEvent("navigate", { detail: { page: "budget" } })
    );
  }

  private navigateToAnalyticsPage(): void {
    window.dispatchEvent(
      new CustomEvent("navigate", { detail: { page: "analytics" } })
    );
  }

  private navigateToFeaturePage(featureId?: string): void {
    window.dispatchEvent(
      new CustomEvent("navigate", { detail: { page: "feature", featureId } })
    );
  }

  private navigateToCardOptimizationPage(): void {
    window.dispatchEvent(
      new CustomEvent("navigate", { detail: { page: "card-optimization" } })
    );
  }

  private navigateToTransactionPage(transactionId?: string): void {
    window.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { page: "transaction", transactionId },
      })
    );
  }

  private showPremiumUpgradeModal(): void {
    window.dispatchEvent(new CustomEvent("show-premium-upgrade"));
  }

  private showBudgetAlertSettings(): void {
    window.dispatchEvent(new CustomEvent("show-budget-alert-settings"));
  }

  private showFeatureDetails(featureId?: string): void {
    window.dispatchEvent(
      new CustomEvent("show-feature-details", { detail: { featureId } })
    );
  }

  private startFeatureTrial(featureId?: string): void {
    if (featureId) {
      featureGateService.startTrial(featureId);
    }
  }

  private startPremiumTrial(): void {
    window.dispatchEvent(new CustomEvent("start-premium-trial"));
  }

  private shareWeeklyReport(): void {
    // Web Share APIを使用してレポートを共有
    if (navigator.share) {
      navigator.share({
        title: "週次レポート",
        text: "今週の支出レポートをご確認ください",
        url: window.location.href,
      });
    }
  }

  private applyCardOptimization(cardId?: string): void {
    window.dispatchEvent(
      new CustomEvent("apply-card-optimization", { detail: { cardId } })
    );
  }

  // パブリックメソッド
  getNotificationCount(): number {
    return this.notificationCount;
  }

  getScheduledNotifications(): NotificationSchedule[] {
    return Array.from(this.scheduledNotifications.values());
  }

  isPermissionGranted(): boolean {
    return this.permission === "granted";
  }

  async testNotification(): Promise<boolean> {
    const config: NotificationConfig = {
      id: "test_notification",
      title: "テスト通知",
      body: "通知機能が正常に動作しています",
      tag: "test",
    };

    return await this.sendNotification(config);
  }
}

export const notificationService = new NotificationService();
