import { NextRequest, NextResponse } from "next/server";

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  plan: string;
}

// Simple in-memory storage for demo purposes
// In production, use a proper database
const users: Array<{
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  plan: string;
  createdAt: string;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const body: RegisterData = await request.json();
    const { email, password, firstName, lastName, plan } = body;

    // Validation
    if (!email || !password || !firstName) {
      return NextResponse.json(
        { message: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "パスワードは8文字以上で入力してください" },
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

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return NextResponse.json(
        { message: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      password, // In production, hash this password
      firstName,
      lastName,
      plan,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Return success response (exclude password)
    const { password: _, ...userWithoutPassword } = newUser;
    
    return NextResponse.json({
      message: "アカウントが正常に作成されました",
      access_token: `mock_token_${newUser.id}`,
      token_type: "Bearer",
      plan,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "アカウント作成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// Get user info endpoint (for password reset, etc.)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { message: "メールアドレスが必要です" },
        { status: 400 }
      );
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return NextResponse.json(
        { message: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // Return user info without password
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });

  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { message: "ユーザー情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}