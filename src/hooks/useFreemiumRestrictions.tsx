import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PremiumUpgradeModal from '../components/premium/PremiumUpgradeModal';

export interface FreemiumRestriction {
  isRestricted: boolean;
  showUpgradePrompt: () => void;
  UpgradeModal: React.FC;
}

interface UseFreemiumRestrictionsOptions {
  featureTitle?: string;
  featureDescription?: string;
}

export const useFreemiumRestrictions = (
  options: UseFreemiumRestrictionsOptions = {}
): FreemiumRestriction => {
  const { isPremium, userData } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const showUpgradePrompt = () => {
    if (!isPremium) {
      setShowModal(true);
    }
  };

  const handleUpgrade = async () => {
    if (!userData) return;

    try {
      // 開発環境ではモック版を使用
      const isDevelopment = import.meta.env.DEV;
      const { stripeService } = await import('../services/stripeService');
      
      const result = isDevelopment 
        ? await stripeService.subscribeToPremiumMock(userData)
        : await stripeService.subscribeToPremium(userData);

      if (!result.success) {
        console.error('Upgrade failed:', result.error);
        alert('アップグレードに失敗しました: ' + result.error);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('アップグレードに失敗しました。');
    }
    
    setShowModal(false);
  };

  const UpgradeModal: React.FC = () => (
    <PremiumUpgradeModal
      open={showModal}
      onClose={() => setShowModal(false)}
      onUpgrade={handleUpgrade}
      featureTitle={options.featureTitle}
      featureDescription={options.featureDescription}
    />
  );

  return {
    isRestricted: !isPremium,
    showUpgradePrompt,
    UpgradeModal
  };
};