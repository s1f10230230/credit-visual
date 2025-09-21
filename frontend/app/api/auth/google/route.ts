import { NextRequest, NextResponse } from "next/server";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

export async function GET(request: NextRequest) {
  try {
    // Generate Google OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID || 'demo_client_id',
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // For demo purposes, return the URL instead of redirecting
    return NextResponse.json({
      message: "Google認証は準備中です",
      authUrl,
      note: "本番環境では、この URL にリダイレクトしてGoogle認証を行います"
    });

  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { message: "Google認証の準備中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { message: "認証コードが必要です" },
        { status: 400 }
      );
    }

    // In production, exchange code for access token
    // const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     client_id: GOOGLE_CLIENT_ID,
    //     client_secret: GOOGLE_CLIENT_SECRET,
    //     code,
    //     grant_type: 'authorization_code',
    //     redirect_uri: GOOGLE_REDIRECT_URI,
    //   }),
    // });

    // For demo purposes, return mock response
    return NextResponse.json({
      message: "Google認証は準備中です",
      access_token: "demo_google_token",
      token_type: "Bearer",
      plan: "free",
      user: {
        id: "google_user_1",
        email: "user@gmail.com",
        firstName: "Google",
        lastName: "ユーザー"
      }
    });

  } catch (error) {
    console.error("Google auth callback error:", error);
    return NextResponse.json(
      { message: "Google認証処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}