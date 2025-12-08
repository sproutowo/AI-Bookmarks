// src/services/gemini.ts
import { AppSettings } from '../types';

// Helper to clean and parse JSON from LLM output
const cleanAndParseJson = (text: string) => {
    try {
        const clean = text.replace(/```json\n?|\n?```/g, '').trim();
        const firstBrace = clean.indexOf('{');
        const lastBrace = clean.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
        }
        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse Error on text:", text);
        return {};
    }
};

// Test AI Connection - 只支持自定义 API
export const testAiConnection = async (settings: AppSettings): Promise<{success: boolean, message: string}> => {
    const { customApiKey, aiProvider, aiBaseUrl, aiModel } = settings;
    
    try {
        if (aiProvider === 'gemini') {
            // 如果用户选择了 Gemini 但不想使用，返回提示
            return { 
                success: false, 
                message: "Gemini provider is not configured in this build. Please switch to Custom AI or install @google/genai package." 
            };
        } else {
            // 自定义 API 连接测试
            if (!customApiKey) return { success: false, message: "Custom API Key is missing" };
            
            const baseUrl = aiBaseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
            const model = aiModel || 'gpt-3.5-turbo';

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: "Say OK" }],
                    max_tokens: 5
                })
            });

            if (!response.ok) {
                const txt = await response.text();
                return { success: false, message: `Error ${response.status}: ${txt}` };
            }
            return { success: true, message: "Custom API Connection Successful!" };
        }
    } catch (e: any) {
        return { success: false, message: e.message || "Connection Failed" };
    }
};

export const analyzeBookmarkWithAi = async (
  title: string,
  url: string,
  settings: AppSettings
): Promise<{ tags: string[]; summary: string; category?: string }> => {
  
  const { customApiKey, aiProvider, aiBaseUrl, aiModel, language } = settings;

  const prompt = `
    Analyze the following webpage bookmark.
    Title: "${title}"
    URL: "${url}"
    
    Target Language for output: ${language}
    
    Please provide:
    1. A short summary (max 50 words).
    2. A list of 3-5 relevant tags (lowercase, single words mostly).
    3. A suggested general category folder name (e.g., Technology, Entertainment, Work, Reading).
    
    Return ONLY valid JSON in this format:
    {
      "summary": "string",
      "tags": ["string", "string"],
      "category": "string"
    }
  `;

  try {
    // 如果选择了 Gemini 但没有配置，直接返回空结果
    if (aiProvider === 'gemini') {
        console.warn("Gemini provider selected but not configured. Please use Custom AI.");
        return { tags: [], summary: "AI analysis not configured.", category: "Uncategorized" };
    }
    
    // 自定义 API
    if (!customApiKey) {
      throw new Error("Custom API Key is missing");
    }

    const baseUrl = aiBaseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const model = aiModel || 'gpt-3.5-turbo';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful bookmark assistant that outputs JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" } 
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    return parseAiResponse(text);
  } catch (error) {
    console.error("AI analysis failed:", error);
    return { tags: [], summary: "Analysis failed.", category: "Uncategorized" };
  }
};

export const searchBookmarksWithAi = async (
  query: string,
  bookmarks: any[],
  settings: AppSettings
): Promise<string[]> => {
    const { customApiKey, aiProvider, aiBaseUrl, aiModel } = settings;

    // Prepare a lightweight list to send to LLM
    const simplifiedList = bookmarks.map(b => ({
        id: b.id,
        t: b.title,
        s: b.summary || '',
        tag: b.tags || []
    }));

    const prompt = `
        I have a list of bookmarks. The user is searching for: "${query}".
        Find the bookmarks that are semantically relevant to this query.
        
        Bookmarks List (JSON):
        ${JSON.stringify(simplifiedList)}

        Return a JSON object with a single key "ids" containing an array of the matching bookmark IDs.
        Example: { "ids": ["123", "456"] }
        Return empty array if no relevance.
    `;

    try {
        // 如果选择了 Gemini 但没有配置，返回空数组
        if (aiProvider === 'gemini') {
            console.warn("Gemini provider selected but not configured for semantic search.");
            return [];
        }
        
        // 自定义 API
        if (!customApiKey) throw new Error("Custom API Key missing");

        const baseUrl = aiBaseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
        const model = aiModel || 'gpt-3.5-turbo';
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are a semantic search engine. Output JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" } 
            })
        });
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "{}";
        const json = cleanAndParseJson(text);
        return json.ids || [];
    } catch (e) {
        console.error("Semantic search failed", e);
        return [];
    }
};

const parseAiResponse = (text?: string) => {
    if (!text) return { tags: [], summary: "No analysis available.", category: "Uncategorized" };
    try {
      const json = cleanAndParseJson(text);
      return {
        tags: json.tags || [],
        summary: json.summary || "No summary.",
        category: json.category || "Uncategorized"
      };
    } catch (e) {
      console.warn("Failed to parse JSON from AI", text);
      return { tags: [], summary: "Format error.", category: "Error" };
    }
};