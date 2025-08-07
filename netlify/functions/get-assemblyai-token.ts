import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Function called, checking environment variables...');
  
  // Check for API key in environment
  const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
  
  console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('ASSEMBLYAI')));
  console.log('ASSEMBLYAI_API_KEY exists:', !!ASSEMBLYAI_API_KEY);

  if (event.httpMethod !== 'POST') {
    console.log('Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!ASSEMBLYAI_API_KEY) {
    console.error('AssemblyAI API key not found in environment variables');
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ 
        error: "AssemblyAI API key is not configured on the server.",
        debug: "Check Netlify environment variables"
      }),
    };
  }

  try {
    console.log('Making request to AssemblyAI...');
    
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: { 
        'authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 })
    });

    console.log('AssemblyAI response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("AssemblyAI API Error:", response.status, errorBody);
      
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        body: JSON.stringify({ 
          error: `AssemblyAI token request failed with status ${response.status}`,
          details: errorBody
        }),
      };
    }

    const data = await response.json();
    console.log('Token generated successfully');

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("Error in get-assemblyai-token function:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch AssemblyAI token.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

export { handler };