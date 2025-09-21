import { NextRequest, NextResponse } from "next/server";

interface UpgradeData {
  email: string;
  currentPlan: string;
  newPlan: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpgradeData = await request.json();
    const { email, currentPlan, newPlan } = body;

    // Validation
    if (!email || !currentPlan || !newPlan) {
      return NextResponse.json(
        { message: "必要な情報が不足しています" },
        { status: 400 }
      );
    }

    const validPlans = ["free", "lite", "pro"];
    if (!validPlans.includes(currentPlan) || !validPlans.includes(newPlan)) {
      return NextResponse.json(
        { message: "無効なプランです" },
        { status: 400 }
      );
    }

    // Check if it's actually an upgrade
    const planHierarchy = { free: 0, lite: 1, pro: 2 };
    const currentLevel = planHierarchy[currentPlan as keyof typeof planHierarchy];
    const newLevel = planHierarchy[newPlan as keyof typeof planHierarchy];

    if (newLevel <= currentLevel) {
      return NextResponse.json(
        { message: "ダウングレードまたは同一プランへの変更は対応していません" },
        { status: 400 }
      );
    }

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In production, this would:
    // 1. Process payment with Stripe
    // 2. Update user's plan in database
    // 3. Send confirmation email
    // 4. Update subscription status

    const response = NextResponse.json({
      message: "アップグレードが完了しました",
      success: true,
      newPlan,
      redirectUrl: `/dashboard?tour=1&from-plan=${currentPlan}`,
      features: getNewFeatures(currentPlan, newPlan)
    });

    // Set plan cookie for immediate UI update
    response.cookies.set("user-plan", newPlan, {
      httpOnly: false, // Allow client-side access for immediate UI update
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/"
    });

    return response;

  } catch (error) {
    console.error("Upgrade error:", error);
    return NextResponse.json(
      { message: "アップグレード処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

function getNewFeatures(fromPlan: string, toPlan: string): string[] {
  const features = {
    "free-to-lite": [
      "無制限解析",
      "詳細レポート",
      "CSV/JSONエクスポート", 
      "12ヶ月履歴"
    ],
    "free-to-pro": [
      "Gmail自動連携",
      "リアルタイム通知",
      "高度フィルタリング",
      "優先サポート",
      "すべてのLite機能"
    ],
    "lite-to-pro": [
      "Gmail自動連携",
      "リアルタイム通知", 
      "高度フィルタリング",
      "優先サポート"
    ]
  };

  const key = `${fromPlan}-to-${toPlan}` as keyof typeof features;
  return features[key] || [];
}