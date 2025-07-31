import axios from 'axios';
import { DatabaseInteraction, LLMResponse } from '../types';

export class ResponseGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "openai/gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  }

  async generateResponse(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {}
  ): Promise<LLMResponse> {
    try {
      // Format conversation history for context
      const historyContext = conversationHistory.length > 0 
        ? "\n\nRecent conversation history:\n" + 
          conversationHistory
            .reverse() // Show oldest first for chronological order
            .map(interaction => 
              `User (${interaction.user_mood || 'unknown mood'}): ${interaction.user_input}\nAI: ${interaction.ai_response}`
            )
            .join('\n\n')
        : '';

      // Format user preferences for context
      const preferencesContext = Object.keys(userPreferences).length > 0
        ? "\n\nWhat I know about you:\n" + 
          Object.entries(userPreferences)
            .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
            .join('\n')
        : '';

      const systemPrompt = `You are a supportive friend who understands emotions through words and tone. You must respond with a JSON object containing both your empathetic response and the user's detected mood.

IMPORTANT: You must ALWAYS respond with valid JSON in this exact format:
{
  "ai_response": "Your empathetic response here",
  "user_mood": "detected_mood"
}

Valid mood categories: excited, happy, sad, stressed, anxious, calm, neutral, frustrated, tired, contemplative, confident, uncertain, angry, content, worried, enthusiastic, disappointed, relieved, overwhelmed, peaceful

Examples of JSON responses:
- If user says "I got the job!" with high energy: {"ai_response": "That's incredible! You sound absolutely thrilled—tell me all about it!", "user_mood": "excited"}
- If user says "I don't know what to do" with low energy: {"ai_response": "You sound really uncertain right now. What's weighing on your mind?", "user_mood": "uncertain"}
- If user says "Everything is fine" but sounds flat: {"ai_response": "You're saying it's fine, but something seems off. Want to talk about it?", "user_mood": "neutral"}
- If user says "This is so annoying!" with tension: {"ai_response": "I can tell you're really frustrated right now. What's got you so worked up?", "user_mood": "frustrated"}

Analyze the user's words, the conversation context, and their voice characteristics to determine their emotional state. Pay attention to mood patterns in the conversation history.

${historyContext}${preferencesContext}

Now, the user said: '${transcribedText}'. Their voice has these traits: ${featureDescription}.

Respond with valid JSON containing your empathetic response (1-3 sentences, warm and natural) and the detected mood. Do NOT mention audio features, analysis, or mood detection in your response.`;

      const payload = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcribedText }
        ],
        max_tokens: 200,
        temperature: 0.7
      };

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(this.baseUrl, payload, { 
        headers,
        timeout: 15000
      });

      const rawResponse = response.data.choices[0].message.content.trim();
      
      try {
        // Parse the JSON response from the LLM
        const parsedResponse: LLMResponse = JSON.parse(rawResponse);
        
        // Validate the response structure
        if (!parsedResponse.ai_response || !parsedResponse.user_mood) {
          throw new Error('Invalid response structure');
        }
        
        return parsedResponse;
      } catch (parseError) {
        console.error('Failed to parse LLM JSON response:', parseError);
        console.error('Raw response:', rawResponse);
        
        // Fallback response if JSON parsing fails
        return {
          ai_response: rawResponse || "I'm here for you—want to chat about what's going on?",
          user_mood: "neutral"
        };
      }
    } catch (error) {
      console.error('Response generation error:', error);
      return {
        ai_response: "I'm here for you—want to chat about what's going on?",
        user_mood: "neutral"
      };
    }
  }
}