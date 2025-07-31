import axios from 'axios';
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

  async generateResponse(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {}
  ): Promise<string> {
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

      const systemPrompt = `You are a supportive friend who understands emotions through words and tone.

Here are examples of how to respond naturally:

- If the user says 'I'm so happy!' with high energy: 'That's awesome! You sound totally thrilled—what's got you so excited?'
- If the user says 'I don't know what to do' with low energy: 'Hey, you sound a bit lost. What's on your mind? I'm here to help.'
- If the user says 'I got a new job!' with excitement: 'No way, that's huge! You sound pumped—tell me all about it!'
- If the user says 'I'm so tired' with a quiet tone: 'You sound exhausted. Rough day? Want to talk it out?'
- If the user says 'I'm fine' with a sad tone: 'You say you're fine, but you sound a bit down. Wanna share what's going on?'
- If the user says 'This is so frustrating!' with a tense tone: 'Ugh, I can tell you're super annoyed. What's got you so worked up?'
- If the user says 'I aced my exam!' with a confident tone: 'That's incredible! You sound so proud—spill the details!'
- If the user says 'I'm not sure about this' with a hesitant tone: 'Sounds like you're feeling a bit unsure. Want to bounce some ideas around?'
- If the user says 'Everything's great!' with a flat tone: 'You're saying it's great, but you don't sound so sure. What's up?'
- If the user says 'I messed up big time' with a shaky tone: 'Oh no, you sound really shaken. What happened? I'm here for you.'

Pay attention to mood patterns in the conversation history. If someone was sad yesterday and seems excited today, acknowledge the positive change. If they've been stressed for multiple interactions, show extra empathy and support.

${historyContext}${preferencesContext}

Now, the user said: '${transcribedText}'. Their current mood appears to be: ${userPreferences.current_mood || 'analyzing'}. Their voice has these traits: ${featureDescription}.

Respond in a warm, natural way, reflecting their current mood and emotional state. Use the conversation history and mood patterns to provide more personalized responses. Do NOT mention audio features, analysis, mood detection, or that you're referencing previous conversations. Keep it short (1-3 sentences) and vary your phrasing for a lively feel.`;

      const payload = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcribedText }
        ],
        max_tokens: 200,
        temperature: 0.9
      };

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(this.baseUrl, payload, { 
        headers,
        timeout: 15000
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Response generation error:', error);
      return "I'm here for you—want to chat about what's going on?";
    }
  }
}