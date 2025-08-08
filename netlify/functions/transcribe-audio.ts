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
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OpenAI API key is not configured" })
    };
  }

  try {
    const fields = await new Promise<{ file: Buffer, filename: string, mimeType: string, model: string, language: string }>((resolve, reject) => {
      const busboy = Busboy({ headers: event.headers });
      const result = {
        file: Buffer.alloc(0),
        filename: '',
        mimeType: '',
        model: 'whisper-1', // default model
        language: 'en' // default language
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
        body: JSON.stringify({ error: 'No file data received.' }),
      };
    }
    
    const formData = new FormData();
    formData.append('file', new Blob([fields.file]), fields.filename);
    formData.append('model', fields.model);
    formData.append('language', fields.language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('OpenAI API Error:', responseData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to transcribe audio.', details: responseData }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};

export { handler };