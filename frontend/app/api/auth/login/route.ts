import { NextRequest, NextResponse } from "next/server";

interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// This would normally connect to your database
// For demo purposes, we'll simulate user storage
const users = [
  {
    id: "user_1",
    email: "demo@example.com",
    password: "password123", // In production, this would be hashed
    firstName: "デモ",
    lastName: "ユーザー",
    plan: "free"
  }
];

export async function POST(request: NextRequest) {
  try {
    const body: LoginData = await request.json();
    const { email, password, rememberMe = false } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { message: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return NextResponse.json(
        { message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // Verify password (in production, use bcrypt.compare)
    if (user.password !== password) {
      return NextResponse.json(
        { message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // Generate tokens
    const accessToken = `access_${user.id}_${Date.now()}`;
    const refreshToken = rememberMe ? `refresh_${user.id}_${Date.now()}` : null;

    // Return success response (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    
    const response = NextResponse.json({
      message: "ログインに成功しました",
      access_token: accessToken,
      token_type: "Bearer",
      plan: user.plan,
      user: userWithoutPassword
    });

    // Set refresh token as HttpOnly cookie if remember me is enabled
    if (refreshToken && rememberMe) {
      const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
      response.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge,
        path: "/"
      });
    }

    return response;

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "ログイン中にエラーが発生しました" },
      { status: 500 }
    );
  }
}