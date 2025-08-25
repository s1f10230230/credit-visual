#!/usr/bin/env node

/**
 * Firebase セットアップ支援スクリプト
 * 環境変数の検証と設定確認を行います
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Setup Assistant\n');

// .env ファイルの存在確認
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env ファイルが見つかりません');
  console.log('📝 以下の内容で .env ファイルを作成してください：\n');
  console.log(`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
VITE_GMAIL_REDIRECT_URI=http://localhost:5173
VITE_GMAIL_SCOPE=https://www.googleapis.com/auth/gmail.readonly
`);
  process.exit(1);
}

// 環境変数を読み込み
require('dotenv').config({ path: envPath });

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN', 
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_GOOGLE_CLIENT_ID',
];

console.log('📋 環境変数チェック:\n');

let allSet = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  const status = value && value !== 'your_api_key' && value !== 'your_project_id' ? '✅' : '❌';
  console.log(`${status} ${varName}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '未設定'}`);
  
  if (!value || value.startsWith('your_')) {
    allSet = false;
  }
}

if (!allSet) {
  console.log('\n❌ 一部の環境変数が未設定です');
  console.log('📖 詳細な手順は FIREBASE_SETUP.md を参照してください\n');
  
  console.log('🔗 必要なリンク:');
  console.log('- Firebase Console: https://console.firebase.google.com/');
  console.log('- Google Cloud Console: https://console.cloud.google.com/');
  console.log('');
  
  process.exit(1);
}

console.log('\n✅ すべての環境変数が設定されています！');

// Firestore セキュリティルールの生成
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
const securityRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /subscriptions/{subscriptionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /userLabels/{labelId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /monthlyAggregates/{aggregateId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /syncStatus/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // マスターデータは読み取りのみ
    match /merchantDictionary/{docId} {
      allow read: if true;
      allow write: if false; // 管理者のみ
    }
  }
}`;

fs.writeFileSync(rulesPath, securityRules);
console.log(`📄 Firestore セキュリティルール を生成しました: ${rulesPath}`);

console.log('\n🎯 次のステップ:');
console.log('1. npm run dev でアプリを起動');  
console.log('2. http://localhost:5173 にアクセス');
console.log('3. Googleログインをテスト');
console.log('4. Firebase Console でデータ作成を確認');
console.log('\n🚀 準備完了！');