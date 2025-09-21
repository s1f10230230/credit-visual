interface ErrorStateProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function ErrorState({ 
  title,
  message, 
  action,
  variant = 'error',
  dismissible = false,
  onDismiss
}: ErrorStateProps) {
  const variantStyles = {
    error: {
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
      textColor: 'text-destructive',
      icon: '🚨'
    },
    warning: {
      bgColor: 'bg-warn/10',
      borderColor: 'border-warn/20',
      textColor: 'text-warn',
      icon: '⚠️'
    },
    info: {
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
      textColor: 'text-primary',
      icon: 'ℹ️'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`card p-4 sm:p-6 ${styles.bgColor} ${styles.borderColor} relative`}>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-line hover:bg-muted/20 flex items-center justify-center transition-colors"
        >
          <span className="text-xs text-muted">✕</span>
        </button>
      )}
      
      <div className="flex items-start space-x-3">
        <div className="text-xl flex-shrink-0">
          {styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-body-lg font-semibold mb-2 ${styles.textColor}`}>
              {title}
            </h4>
          )}
          <p className={`text-sm sm:text-body mb-4 ${styles.textColor}`}>
            {message}
          </p>
          {action && (
            <button 
              onClick={action.onClick}
              className={`btn btn-outline ${
                variant === 'error' ? 'border-destructive text-destructive hover:bg-destructive hover:text-white' :
                variant === 'warning' ? 'border-warn text-warn hover:bg-warn hover:text-white' :
                'border-primary text-primary hover:bg-primary hover:text-white'
              }`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Specific error components for common scenarios
export function NetworkErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="接続エラー"
      message="サーバーに接続できませんでした。インターネット接続を確認して再試行してください。"
      action={{
        label: "再試行",
        onClick: onRetry
      }}
      variant="error"
    />
  );
}

export function AuthErrorState({ onLogin }: { onLogin: () => void }) {
  return (
    <ErrorState
      title="認証が必要です"
      message="この機能を利用するにはログインが必要です。"
      action={{
        label: "ログイン",
        onClick: onLogin
      }}
      variant="warning"
    />
  );
}

export function DataErrorState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <ErrorState
      title="データの読み込みに失敗しました"
      message="データの取得中にエラーが発生しました。しばらく待ってから再試行してください。"
      action={{
        label: "更新",
        onClick: onRefresh
      }}
      variant="error"
    />
  );
}

export function MaintenanceErrorState() {
  return (
    <ErrorState
      title="メンテナンス中"
      message="現在システムメンテナンス中です。しばらくお待ちください。"
      variant="info"
    />
  );
}