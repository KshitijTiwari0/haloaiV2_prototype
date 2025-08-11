import type { Handler, HandlerEvent } from "@netlify/functions";
import Busboy from 'busboy';
import fetch from 'node-fetch';

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "OpenAI API key is not configured" })
    };
  }

  try {
    const fields = await new Promise<{ 
      file: Buffer, 
      filename: string, 
      mimeType: string, 
      model: string, 
      language: string 
    }>((resolve, reject) => {
      const busboy = Busboy({ headers: event.headers });
      const result = {
        file: Buffer.alloc(0),
        filename: '',
        mimeType: '',
        model: 'whisper-1', // default model
        language: 'auto' // default to auto-detect
      };

      busboy.on('file', (fieldname, file, { filename, mimeType }) => {
        if (fieldname === 'file') {
          result.filename = filename;
          result.mimeType = mimeType;
          const chunks: Buffer[] = [];
          file.on('data', (chunk) => chunks.push(chunk));
          file.on('end', () => {
            result.file = Buffer.concat(chunks);
          });
        }
      });
      
      busboy.on('field', (fieldname, val) => {
        if (fieldname === 'model') result.model = val;
        if (fieldname === 'language') result.language = val;
      });
      
      busboy.on('finish', () => resolve(result));
      busboy.on('error', (err) => reject(err));
      
      busboy.end(event.isBase64Encoded ? Buffer.from(event.body!, 'base64') : event.body);
    });

    if (!fields.file || fields.file.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: 'No file data received.' }),
      };
    }
    
    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', new Blob([fields.file]), fields.filename);
    formData.append('model', fields.model);
    
    // Handle language parameter
    if (fields.language && fields.language !== 'auto') {
      // Map our language codes to Whisper supported codes
      const languageMap: Record<string, string> = {
        'en': 'en',
        'hi': 'hi', 
        'ar': 'ar'
      };
      
      const whisperLanguage = languageMap[fields.language];
      if (whisperLanguage) {
        formData.append('language', whisperLanguage);
      }
    }
    // If 'auto' or invalid language, let Whisper auto-detect by not sending language parameter

    console.log(`Transcribing with language: ${fields.language}`);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('OpenAI Whisper API Error:', responseData);
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          error: 'Failed to transcribe audio.', 
          details: responseData 
        }),
      };
    }

    // Detect language from the transcribed text if not specified
    let detectedLanguage = fields.language;
    if (fields.language === 'auto' && responseData.text) {
      detectedLanguage = await detectLanguageFromText(responseData.text, OPENAI_API_KEY);
    }

    // Return transcription with detected language
    const result = {
      text: responseData.text,
      language: detectedLanguage
    };

    console.log(`Transcription completed. Language: ${detectedLanguage}, Text: ${responseData.text?.substring(0, 100)}...`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

// Helper function to detect language from text using OpenAI
async function detectLanguageFromText(text: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Detect the language of the following text. Respond with only the language code: "en" for English, "hi" for Hindi, "ar" for Arabic. If uncertain, respond with "en".'
        }, {
          role: 'user',
          content: text
        }],
        max_tokens: 10,
        temperature: 0
      })
    });

    if (response.ok) {
      const result = await response.json();
      const detectedLang = result.choices[0]?.message?.content?.trim().toLowerCase();
      
      // Validate detected language
      if (['en', 'hi', 'ar'].includes(detectedLang)) {
        return detectedLang;
      }
    }
  } catch (error) {
    console.error('Language detection error:', error);
  }
  
  // Default fallback
  return 'en';
}

export { handler };