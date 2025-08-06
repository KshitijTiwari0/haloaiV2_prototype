import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const ASSEMBLYAI_API_KEY = process.env.VITE_ASSEMBLYAI_API_KEY;

  if (!ASSEMBLYAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AssemblyAI API key is not configured." }),
    };
  }

  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: { 
        'authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 }) // Token expires in 1 hour
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI token request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("Error fetching AssemblyAI token:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch AssemblyAI token.' }),
    };
  }
};

export { handler };