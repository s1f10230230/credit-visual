import React, { useEffect, useState } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import { adService } from "../services/adService";
import { featureGateService } from "../services/featureGateService";

interface AdBannerProps {
  placementId?: string;
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({
  placementId = "main_banner",
  className,
}) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    initializeAd();
  }, []);

  const initializeAd = async () => {
    try {
      // プレミアムユーザーかチェック
      if (!featureGateService.shouldShowAds()) {
        setShowUpgradePrompt(true);
        return;
      }

      // 広告サービスを初期化
      await adService.initialize();

      // 広告を表示
      const success = await adService.showBannerAd(
        `ad-container-${placementId}`
      );

      if (success) {
        setAdLoaded(true);
      } else {
        setAdError("広告の読み込みに失敗しました");
      }
    } catch (error) {
      console.error("Ad initialization failed:", error);
      setAdError("広告の初期化に失敗しました");
    }
  };

  const handleUpgradeClick = () => {
    // プレミアムプランへの誘導
    window.dispatchEvent(new CustomEvent("show-premium-upgrade"));
  };

  if (showUpgradePrompt) {
    return (
      <Box
        className={className}
        sx={{
          bgcolor: "primary.main",
          color: "white",
          p: 2,
          textAlign: "center",
          borderRadius: 1,
        }}
      >
        <Typography variant="body2" sx={{ mb: 1 }}>
          広告なしで快適にご利用いただけます
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={handleUpgradeClick}
        >
          プレミアムにアップグレード
        </Button>
      </Box>
    );
  }

  if (adError) {
    return (
      <Box className={className} sx={{ p: 2, textAlign: "center" }}>
        <Alert severity="info" sx={{ mb: 1 }}>
          {adError}
        </Alert>
        <Button variant="outlined" size="small" onClick={initializeAd}>
          再試行
        </Button>
      </Box>
    );
  }

  return (
    <Box className={className}>
      {!adLoaded && (
        <Box
          sx={{
            height: 60,
            bgcolor: "grey.100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            広告を読み込み中...
          </Typography>
        </Box>
      )}
      <div id={`ad-container-${placementId}`} style={{ minHeight: "60px" }} />
    </Box>
  );
};

export default AdBanner;
