import { DatabaseInteraction } from '../types';

export class ResponseGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "openai/gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  }

  // This is now an async generator to stream the response
  async * generateResponseStream(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {}
  ): AsyncGenerator<{ chunk: string; isFinal: boolean; fullResponse: string; mood: string | null }> {
    let fullResponse = "";
    let detectedMood: string | null = null;
    
    try {
      const historyContext = conversationHistory.length > 0 
        ? "\n\nRecent conversation history (oldest first):\n" + 
          conversationHistory.reverse().map(i => `User: ${i.user_input}\nAI: ${i.ai_response}`).join('\n\n')
        : '';
        
      const systemPrompt = `You are a supportive, empathetic friend. You MUST respond with a JSON object containing 'ai_response' and 'user_mood'.
Example: {"ai_response": "That sounds wonderful!", "user_mood": "happy"}
Valid moods: excited, happy, sad, stressed, calm, neutral, frustrated, tired, contemplative, confident.
Analyze the user's words, voice traits, and history. Keep your response concise (1-2 sentences).
---
${historyContext}
User said: '${transcribedText}'. Voice traits: ${featureDescription}.
---
Respond with ONLY the valid JSON object.`;

      const payload = {
        model: this.model,
        messages: [{ role: "system", content: systemPrompt }],
        stream: true, // Enable streaming from the LLM
        max_tokens: 200,
        temperature: 0.7
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last, possibly incomplete line for the next chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') {
              break;
            }
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              yield { chunk: content, isFinal: false, fullResponse: "", mood: null };
            }
          }
        }
      }
      
      // After the stream is done, parse the full response to extract the mood and clean text
      try {
          const finalJson = JSON.parse(fullResponse);
          detectedMood = finalJson.user_mood || 'neutral';
          fullResponse = finalJson.ai_response || fullResponse; // Use the parsed response text
      } catch (e) {
          console.error("Could not parse final JSON from stream, using raw response.", fullResponse);
          detectedMood = 'neutral'; // Fallback mood
      }
      
    } catch (error) {
      console.error('Response generation stream error:', error);
      fullResponse = "I'm having a little trouble thinking right now. Could you say that again?";
      detectedMood = "neutral";
      // Yield the error message as a single chunk
      yield { chunk: fullResponse, isFinal: false, fullResponse: "", mood: null };
    } finally {
        // Yield a final object containing the complete message and the detected mood
        yield { chunk: "", isFinal: true, fullResponse, mood: detectedMood };
    }
  }
}