interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'centered' | 'compact';
}

export function EmptyState({ 
  icon = '📄', 
  title, 
  description, 
  action,
  variant = 'default' 
}: EmptyStateProps) {
  const sizeClasses = {
    default: 'p-8 sm:p-12',
    centered: 'p-12 sm:p-16 text-center',
    compact: 'p-6'
  };

  const iconSizes = {
    default: 'text-4xl sm:text-5xl',
    centered: 'text-6xl sm:text-7xl',
    compact: 'text-3xl'
  };

  return (
    <div className={`card ${sizeClasses[variant]} ${variant === 'centered' ? 'text-center' : ''}`}>
      <div className={`${iconSizes[variant]} mb-4 sm:mb-6`}>
        {icon}
      </div>
      <h3 className="text-lg sm:text-heading-sm text-text mb-3 sm:mb-4">
        {title}
      </h3>
      <p className="text-sm sm:text-body text-muted max-w-md mx-auto mb-6">
        {description}
      </p>
      {action && (
        <button 
          onClick={action.onClick}
          className="btn btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Specific empty state components for common scenarios
export function NoCardsEmptyState({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      icon="💳"
      title="カードデータがありません"
      description="クレジットカードの利用明細をインポートして、サブスクリプション分析を開始しましょう。"
      action={onImport ? {
        label: "明細をインポート",
        onClick: onImport
      } : undefined}
      variant="centered"
    />
  );
}

export function NoTransactionsEmptyState() {
  return (
    <EmptyState
      icon="🔍"
      title="取引データがありません"
      description="選択した期間には取引データが見つかりませんでした。別の期間を選択するか、新しいデータをインポートしてください。"
      variant="compact"
    />
  );
}

export function LoadingEmptyState() {
  return (
    <div className="card p-8 text-center">
      <div className="animate-pulse">
        <div className="text-4xl mb-4">⏳</div>
        <div className="h-6 bg-line rounded-lg w-48 mx-auto mb-3"></div>
        <div className="h-4 bg-line rounded-lg w-64 mx-auto"></div>
      </div>
    </div>
  );
}