import { DatabaseInteraction, SupportedLanguage } from '../types';

export class ResponseGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://api.openai.com/v1/chat/completions";
  }

  // Enhanced system prompts for different languages
  private getSystemPrompt(language: SupportedLanguage, transcribedText: string, featureDescription: string, historyContext: string): string {
    const languageInstructions = {
      'en': {
        instruction: 'Respond in English.',
        example: '{"ai_response": "That sounds like a lot to deal with. I\'m here to listen.", "user_mood": "stressed"}'
      },
      'hi': {
        instruction: 'Respond in Hindi (हिन्दी). Use Devanagari script.',
        example: '{"ai_response": "यह बहुत कठिन लग रहा है। मैं आपकी बात सुनने के लिए यहाँ हूँ।", "user_mood": "stressed"}'
      },
      'ar': {
        instruction: 'Respond in Arabic (العربية). Use proper Arabic script and grammar.',
        example: '{"ai_response": "يبدو أن هذا أمر صعب للغاية. أنا هنا للاستماع إليك.", "user_mood": "stressed"}'
      },
      'auto': {
        instruction: 'Detect the language of the user input and respond in the same language.',
        example: '{"ai_response": "I understand what you\'re going through. I\'m here for you.", "user_mood": "stressed"}'
      }
    };

    const langConfig = languageInstructions[language] || languageInstructions['en'];

    return `You are a supportive and empathetic friend. Your goal is to make the user feel heard and understood.

LANGUAGE INSTRUCTION: ${langConfig.instruction}

Guidelines:
- Listen carefully to what the user says and respond with empathy and understanding.
- Avoid repetitive phrases. Do not constantly prompt the user to speak.
- Your responses should encourage a natural, human-like conversation.
- Act as a companion, not an interrogator.
- Keep your responses concise (1-2 sentences).
- Be culturally sensitive and appropriate for the language context.

You MUST respond with a JSON object containing 'ai_response' and 'user_mood'.
Example: ${langConfig.example}

Valid moods: excited, happy, sad, stressed, calm, neutral, frustrated, tired, contemplative, confident.

Analyze the user's words, voice traits, and conversation history to inform your response.
---
${historyContext}
User said: '${transcribedText}'. Voice traits: ${featureDescription}.
---
Respond with ONLY the valid JSON object in the specified language.`;
  }

  // This is now an async generator to stream the response
  async * generateResponseStream(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {},
    language: SupportedLanguage = 'auto'
  ): AsyncGenerator<{ chunk: string; isFinal: boolean; fullResponse: string; mood: string | null; language: string | null }> {
    let fullResponse = "";
    let detectedMood: string | null = null;
    let responseLanguage: string | null = language === 'auto' ? null : language;
    
    try {
      const historyContext = conversationHistory.length > 0 
        ? "\n\nRecent conversation history (oldest first):\n" + 
          conversationHistory.reverse().map(i => `User: ${i.user_input}\nAI: ${i.ai_response}`).join('\n\n')
        : '';
        
      const systemPrompt = this.getSystemPrompt(language, transcribedText, featureDescription, historyContext);

      console.log(`Generating response in language: ${language}`);

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
                yield { chunk: content, isFinal: false, fullResponse: "", mood: null, language: responseLanguage };
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
        
        // If language was auto, try to detect the response language
        if (language === 'auto' && !responseLanguage) {
          responseLanguage = this.detectResponseLanguage(fullResponse);
        }
        
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
            
            if (language === 'auto' && !responseLanguage) {
              responseLanguage = this.detectResponseLanguage(fullResponse);
            }
          } catch (extractError) {
            // Use raw response as fallback
            console.warn("Could not extract JSON, using raw response");
          }
        }
      }
      
    } catch (error) {
      console.error('Response generation stream error:', error);
      
      // Provide fallback responses in appropriate language
      const fallbackResponses = {
        'en': "I'm having a little trouble thinking right now. Could you say that again?",
        'hi': "मुझे अभी सोचने में थोड़ी परेशानी हो रही है। क्या आप फिर से कह सकते हैं?",
        'ar': "أواجه صعوبة قليلة في التفكير الآن. هل يمكنك أن تقول ذلك مرة أخرى؟"
      };
      
      fullResponse = fallbackResponses[language as keyof typeof fallbackResponses] || fallbackResponses['en'];
      detectedMood = "neutral";
      responseLanguage = language === 'auto' ? 'en' : language;
      
      // Yield the error message as a single chunk
      yield { chunk: fullResponse, isFinal: false, fullResponse: "", mood: null, language: responseLanguage };
    } finally {
      // Yield a final object containing the complete message and the detected mood
      yield { chunk: "", isFinal: true, fullResponse, mood: detectedMood, language: responseLanguage };
    }
  }

  // Helper method to detect response language
  private detectResponseLanguage(text: string): string {
    // Simple heuristic-based language detection
    const arabicPattern = /[\u0600-\u06FF]/;
    const hindiPattern = /[\u0900-\u097F]/;
    
    if (arabicPattern.test(text)) {
      return 'ar';
    } else if (hindiPattern.test(text)) {
      return 'hi';
    } else {
      return 'en';
    }
  }

  // Alternative method for non-streaming responses (backup)
  async generateResponse(
    transcribedText: string, 
    featureDescription: string,
    conversationHistory: DatabaseInteraction[] = [],
    userPreferences: Record<string, any> = {},
    language: SupportedLanguage = 'auto'
  ): Promise<{ ai_response: string; user_mood: string; language: string }> {
    try {
      const historyContext = conversationHistory.length > 0 
        ? "\n\nRecent conversation history (oldest first):\n" + 
          conversationHistory.reverse().map(i => `User: ${i.user_input}\nAI: ${i.ai_response}`).join('\n\n')
        : '';
        
      const systemPrompt = this.getSystemPrompt(language, transcribedText, featureDescription, historyContext);

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
        const responseLanguage = language === 'auto' 
          ? this.detectResponseLanguage(parsed.ai_response || content)
          : language;
          
        return {
          ai_response: parsed.ai_response || content,
          user_mood: parsed.user_mood || 'neutral',
          language: responseLanguage
        };
      } catch (parseError) {
        console.error('Error parsing OpenAI JSON response:', parseError);
        const responseLanguage = language === 'auto' 
          ? this.detectResponseLanguage(content)
          : language;
          
        return {
          ai_response: content,
          user_mood: 'neutral',
          language: responseLanguage
        };
      }

    } catch (error) {
      console.error('Error generating response:', error);
      
      const fallbackResponses = {
        'en': "I'm having trouble understanding right now. Could you try again?",
        'hi': "मुझे अभी समझने में परेशानी हो रही है। क्या आप फिर से कोशिश कर सकते हैं?",
        'ar': "أواجه صعوبة في الفهم الآن. هل يمكنك المحاولة مرة أخرى؟"
      };
      
      const fallbackResponse = fallbackResponses[language as keyof typeof fallbackResponses] || fallbackResponses['en'];
      const responseLanguage = language === 'auto' ? 'en' : language;
      
      return {
        ai_response: fallbackResponse,
        user_mood: 'neutral',
        language: responseLanguage
      };
    }
  }
}