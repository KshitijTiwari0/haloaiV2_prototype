import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ''
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

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          error: "OpenAI API key is not configured on the server" 
        })
      };
    }

    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "Invalid JSON in request body" })
      };
    }

    // Validate required fields
    if (!requestData.messages || !Array.isArray(requestData.messages)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ error: "Messages array is required" })
      };
    }

    // Prepare request to OpenAI
    const openaiRequest = {
      model: requestData.model || 'gpt-4o-mini',
      messages: requestData.messages,
      max_tokens: requestData.max_tokens || 200,
      temperature: requestData.temperature || 0.7,
      stream: requestData.stream || false
    };

    console.log('Forwarding request to OpenAI:', {
      model: openaiRequest.model,
      messageCount: openaiRequest.messages.length,
      stream: openaiRequest.stream
    });

    // Forward to OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openaiRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Chat API error:', response.status, errorText);
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          error: `OpenAI API error: ${response.status}`,
          details: errorText
        })
      };
    }

    // Handle streaming response
    if (openaiRequest.stream) {
      // For streaming responses, we need to return the stream directly
      // Note: Netlify Functions have limitations with streaming, so we'll handle this differently
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      let streamedContent = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          streamedContent += chunk;
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
          },
          body: streamedContent
        };
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle non-streaming response
      const result = await response.json();
      console.log('Chat completion successful:', result.choices?.[0]?.message?.content?.substring(0, 100) + '...');
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(result)
      };
    }

  } catch (error) {
    console.error('Error in chat-completion function:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };