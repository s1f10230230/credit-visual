import { NextRequest, NextResponse } from "next/server";

// Mock refresh token storage (in production, use a database)
const refreshTokens: Array<{
  token: string;
  userId: string;
  expiresAt: Date;
}> = [];

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

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from HttpOnly cookie
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "リフレッシュトークンが見つかりません" },
        { status: 401 }
      );
    }

    // Validate refresh token (in production, check database)
    const tokenData = refreshTokens.find(rt => rt.token === refreshToken);
    if (!tokenData) {
      // For demo purposes, extract user ID from token
      const userId = refreshToken.includes("user_1") ? "user_1" : null;
      if (!userId) {
        return NextResponse.json(
          { message: "無効なリフレッシュトークンです" },
          { status: 401 }
        );
      }
      
      // Create mock token data
      tokenData = {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };
    }

    // Check if token is expired
    if (new Date() > tokenData.expiresAt) {
      return NextResponse.json(
        { message: "リフレッシュトークンの有効期限が切れています" },
        { status: 401 }
      );
    }

    // Find user
    const user = users.find(u => u.id === tokenData.userId);
    if (!user) {
      return NextResponse.json(
        { message: "ユーザーが見つかりません" },
        { status: 401 }
      );
    }

    // Generate new access token
    const newAccessToken = `access_${user.id}_${Date.now()}`;

    // Return new access token
    const { password, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      access_token: newAccessToken,
      token_type: "Bearer",
      user: userWithoutPassword,
      plan: user.plan
    });

  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { message: "トークンの更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// Revoke refresh token (for logout)
export async function DELETE(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (refreshToken) {
      // Remove from storage (in production, remove from database)
      const index = refreshTokens.findIndex(rt => rt.token === refreshToken);
      if (index > -1) {
        refreshTokens.splice(index, 1);
      }
    }

    // Clear cookie
    const response = NextResponse.json({ message: "ログアウトしました" });
    response.cookies.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/"
    });

    return response;

  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "ログアウト中にエラーが発生しました" },
      { status: 500 }
    );
  }
}