import type { Handler } from "@netlify/functions";

const handler: Handler = async (event, context) => {
  // CORRECTED: Access the variable without the VITE_ prefix.
  const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!ASSEMBLYAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AssemblyAI API key is not configured on the server." }),
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
      const errorBody = await response.text();
      console.error("AssemblyAI API Error:", errorBody);
      throw new Error(`AssemblyAI token request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("Error in get-assemblyai-token function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch AssemblyAI token.' }),
    };
  }
};

export { handler };