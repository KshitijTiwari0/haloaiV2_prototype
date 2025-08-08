import { DatabaseInteraction } from '../types';

export class ResponseGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://api.openai.com/v1/chat/completions";
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

      // Use Netlify function for secure API calls
      const response = await fetch('/.netlify/functions/chat-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: systemPrompt }],
          stream: true,
          max_tokens: 200,
          temperature: 0.7
        })
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
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                yield { chunk: content, isFinal: false, fullResponse: "", mood: null };
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue;
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
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = fullResponse.match(/\{[^}]+\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            detectedMood = extractedJson.user_mood || 'neutral';
            fullResponse = extractedJson.ai_response || fullResponse;
          } catch (extractError) {
            // Use raw response as fallback
            console.warn("Could not extract JSON, using raw response");
          }
        }
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

  // Alternative method for non-streaming responses (backup)
  async generateResponse(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {}
  ): Promise<{ ai_response: string; user_mood: string }> {
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

      const response = await fetch('/.netlify/functions/chat-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: systemPrompt }],
          stream: false,
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse the JSON response
      try {
        const parsed = JSON.parse(content);
        return {
          ai_response: parsed.ai_response || content,
          user_mood: parsed.user_mood || 'neutral'
        };
      } catch (parseError) {
        console.error('Error parsing OpenAI JSON response:', parseError);
        return {
          ai_response: content,
          user_mood: 'neutral'
        };
      }

    } catch (error) {
      console.error('Error generating response:', error);
      return {
        ai_response: "I'm having trouble understanding right now. Could you try again?",
        user_mood: 'neutral'
      };
    }
  }
}