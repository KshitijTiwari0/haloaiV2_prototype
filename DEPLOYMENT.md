# Deployment Guide for Halo.AI

## Environment Variables Setup

### Local Development

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`**:
   ```
   VITE_OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
   VITE_ELEVEN_LABS_API_KEY=sk_your-actual-key-here
   VITE_OPENAI_API_KEY=sk-your-actual-key-here
   VITE_ASSEMBLYAI_API_KEY=your-actual-key-here
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

### Netlify Deployment

#### Step 1: Configure Environment Variables in Netlify

1. **Go to your Netlify site dashboard**
2. **Navigate to Site settings**
3. **Click on "Build & deploy" in the sidebar**
4. **Select "Environment variables"**
5. **Add each variable**:

   | Key | Value | Required |
   |-----|-------|----------|
   | `VITE_OPENROUTER_API_KEY` | `sk-or-v1-your-actual-key-here` | ✅ Yes |
   | `VITE_ELEVEN_LABS_API_KEY` | `sk_your-actual-key-here` | ❌ Optional |
   | `VITE_OPENAI_API_KEY` | `sk-your-actual-key-here` | ❌ Optional |
   | `VITE_ASSEMBLYAI_API_KEY` | `your-actual-key-here` | ❌ Optional |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes |
   | `VITE_SUPABASE_ANON_KEY` | `your-supabase-anon-key` | ✅ Yes |

#### Step 2: Deploy

Once environment variables are configured, your next deployment will automatically use them.

## API Key Requirements

### Required for Basic Functionality:
- **OpenRouter API Key**: Get from [OpenRouter](https://openrouter.ai/)
  - Free tier available
  - Required for AI responses
- **Supabase Project**: Get from [Supabase](https://supabase.com/)
  - Free tier available
  - Required for user authentication

### Optional for Enhanced Features:
- **Eleven Labs API Key**: Get from [Eleven Labs](https://elevenlabs.io/)
  - Premium text-to-speech
  - Falls back to Web Speech API if not provided

- **OpenAI API Key**: Get from [OpenAI](https://platform.openai.com/)
  - Premium Whisper transcription
  - Falls back to free services if not provided

- **AssemblyAI API Key**: Get from [AssemblyAI](https://www.assemblyai.com/)
  - Alternative premium transcription
  - Free tier available

## Free vs Premium Features

### Works with Free Tier:
- ✅ Voice recording and processing
- ✅ User authentication (email + Google)
- ✅ Emotion analysis
- ✅ AI responses (OpenRouter free tier)
- ✅ Transcription (Hugging Face free API)
- ✅ Text-to-speech (Web Speech API)

### Premium Enhancements:
- 🚀 Higher quality transcription (OpenAI Whisper)
- 🚀 Premium voice synthesis (Eleven Labs)
- 🚀 Faster processing times
- 🚀 Higher rate limits

## Security Notes

- ✅ API keys are stored as environment variables
- ✅ Keys are not committed to version control
- ✅ Client-side keys are prefixed with `VITE_` for Vite
- ⚠️ Client-side environment variables are visible in the browser
- 💡 For production apps, consider using a backend proxy for sensitive APIs

## Troubleshooting

### Environment Variables Not Working:
1. Ensure variables are prefixed with `VITE_`
2. Restart the development server after adding variables
3. Check Netlify environment variables are saved correctly
4. Verify Supabase URL and anon key are correct

### Deployment Issues:
1. Verify all required environment variables are set in Netlify
2. Check the build logs for any missing dependencies
3. Ensure the build command is `npm run build`

### API Key Issues:
1. Verify API keys are valid and active
2. Check API usage limits and quotas
3. Test with a minimal example first

### Authentication Issues:
1. Check Supabase project settings
2. Verify email/Google auth is enabled in Supabase
3. Ensure redirect URLs are configured correctly
4. Check browser console for auth errors

## Build Configuration

The app is configured to work with Netlify's default build settings:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18.x (recommended)