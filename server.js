const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア
app.use(cors());
app.use(express.json());

// 店舗分類APIエンドポイント
app.post('/api/classify-merchant', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt || !systemPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Anthropic APIキーを環境変数から取得
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Anthropic APIを呼び出し
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    res.json({
      response: data.content[0].text,
      model: 'claude-3-haiku-20240307',
      usage: data.usage
    });

  } catch (error) {
    console.error('Classification API error:', error);
    res.status(500).json({ 
      error: 'Classification failed', 
      details: error.message 
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
