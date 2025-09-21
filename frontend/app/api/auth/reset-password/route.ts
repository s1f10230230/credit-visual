import { NextRequest, NextResponse } from "next/server";

interface ResetPasswordData {
  email: string;
}

// This would normally connect to your database
// For demo purposes, we'll simulate user storage
const users = [
  {
    id: "user_1",
    email: "demo@example.com",
    password: "password123",
    firstName: "デモ",
    lastName: "ユーザー",
    plan: "free"
  }
];

// In production, you'd store reset tokens in database with expiration
const resetTokens: Array<{
  email: string;
  token: string;
  expires: Date;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const body: ResetPasswordData = await request.json();
    const { email } = body;

    // Validation
    if (!email) {
      return NextResponse.json(
        { message: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "有効なメールアドレスを入力してください" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = users.find(u => u.email === email);
    if (!user) {
      // For security, don't reveal whether the email exists or not
      return NextResponse.json({
        message: "パスワードリセット用のリンクを送信しました（該当するアカウントがある場合）"
      });
    }

    // Generate reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

    // Store reset token (in production, save to database)
    resetTokens.push({
      email,
      token: resetToken,
      expires
    });

    // In production, send actual email here
    console.log(`Password reset link: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password/confirm?token=${resetToken}`);

    return NextResponse.json({
      message: "パスワードリセット用のリンクを送信しました"
    });

  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "パスワードリセット処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// Verify reset token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { message: "リセットトークンが必要です" },
        { status: 400 }
      );
    }

    // Find and validate token
    const resetData = resetTokens.find(rt => rt.token === token);
    if (!resetData) {
      return NextResponse.json(
        { message: "無効なリセットトークンです" },
        { status: 400 }
      );
    }

    if (new Date() > resetData.expires) {
      return NextResponse.json(
        { message: "リセットトークンの有効期限が切れています" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "有効なリセットトークンです",
      email: resetData.email
    });

  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { message: "トークン検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}