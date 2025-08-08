# Deployment Guide for Halo.AI - Simplified Stack

## Environment Variables Setup

### Local Development

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`**:
   ```env
   # Required - OpenAI API for transcription and AI responses
   VITE_OPENAI_API_KEY=sk-your-actual-openai-key-here

   # Required - Eleven Labs API for premium text-to-speech
   VITE_ELEVEN_LABS_API_KEY=sk_your-actual-eleven-labs-key-here

   # Required - Supabase for authentication and database
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Server-side keys for Netlify Functions (optional but recommended for security)
   OPENAI_API_KEY=sk-your-actual-openai-key-here
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

   | Key | Value | Required | Usage |
   |-----|-------|----------|-------|
   | `VITE_OPENAI_API_KEY` | `sk-your-openai-key` | ✅ Yes | Client-side OpenAI calls |
   | `VITE_ELEVEN_LABS_API_KEY` | `sk_your-eleven-labs-key` | ✅ Yes | Client-side Eleven Labs TTS |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes | Supabase connection |
   | `VITE_SUPABASE_ANON_KEY` | `your-supabase-anon-key` | ✅ Yes | Supabase authentication |
   | `OPENAI_API_KEY` | `sk-your-openai-key` | 🔒 Recommended | Server-side API calls (more secure) |

#### Step 2: Deploy

Once environment variables are configured, your next deployment will automatically use them.

## API Key Requirements - Simplified Stack

### Required Services:

1. **OpenAI API** - Get from [OpenAI Platform](https://platform.openai.com/)
   - **Usage**: Whisper transcription + GPT responses
   - **Cost**: $0.006/minute for Whisper + token-based pricing for GPT
   - **Why**: Best-in-class transcription accuracy and AI responses

2. **Eleven Labs API** - Get from [Eleven Labs](https://elevenlabs.io/)
   - **Usage**: Premium text-to-speech
   - **Cost**: $0.30/1K characters (or subscription plans)
   - **Why**: High-quality, natural voice synthesis

3. **Supabase Project** - Get from [Supabase](https://supabase.com/)
   - **Usage**: User authentication + conversation storage
   - **Cost**: Free tier available
   - **Why**: Simple auth + database solution

### Removed Services (No Longer Needed):
- ❌ OpenRouter (replaced by direct OpenAI)
- ❌ AssemblyAI (replaced by OpenAI Whisper)
- ❌ Hugging Face transcription (replaced by OpenAI Whisper)

## Architecture Overview

```
User → Browser → Netlify Functions → OpenAI API
                      ↓
                 Eleven Labs API
                      ↓
                 Supabase Database
```

## Security Improvements

### Client-Side vs Server-Side API Calls

**Current Setup (Client-Side):**
- ✅ Faster response times
- ⚠️ API keys visible in browser
- ✅ Simpler implementation

**Recommended Setup (Server-Side via Netlify Functions):**
- 🔒 API keys hidden from browser
- ✅ Better security
- ✅ Rate limiting control
- ⚠️ Slightly higher latency

## Performance Optimizations

1. **Reduced Latency**:
   - Direct OpenAI calls (no OpenRouter proxy)
   - Optimized audio chunk processing
   - Simplified fallback logic

2. **Better Mobile Support**:
   - Whisper works consistently across devices
   - No browser speech API dependencies
   - Optimized audio recording

3. **Simplified Error Handling**:
   - Fewer services = fewer failure points
   - Better error messages
   - Automatic retry logic

## Cost Estimation

### Free Tier Capabilities:
- **Supabase**: 50K monthly active users
- **Netlify**: 100GB bandwidth, 125K function invocations

### Paid Usage (per 1000 interactions):
- **OpenAI Whisper**: ~$6 (1 minute average per interaction)
- **OpenAI GPT-4o-mini**: ~$0.50 (average response)
- **Eleven Labs**: ~$15 (50 words average response)
- **Total**: ~$21.50 per 1000 interactions

## Deployment Steps

1. **Set up Supabase project**:
   ```bash
   # Enable Email + Google authentication
   # Copy URL and anon key
   ```

2. **Configure Netlify**:
   ```bash
   # Connect GitHub repository
   # Set environment variables
   # Enable automatic deployments
   ```

3. **Test deployment**:
   ```bash
   # Verify all API keys work
   # Test microphone permissions
   # Test voice synthesis
   ```

## Troubleshooting

### Common Issues:

1. **"OpenAI API key not configured"**:
   - Check `VITE_OPENAI_API_KEY` in Netlify environment variables
   - Ensure the key starts with `sk-`
   - Verify the key has sufficient credits

2. **"Eleven Labs API key invalid"**:
   - Check `VITE_ELEVEN_LABS_API_KEY` format
   - Verify account has sufficient character credits
   - Test key at https://api.elevenlabs.io/v1/voices

3. **"Microphone access denied"**:
   - Ensure HTTPS deployment (required for microphone)
   - Check browser permissions
   - Test on different browsers/devices

4. **"Supabase connection failed"**:
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Check Supabase project is active
   - Ensure auth providers are enabled

### Build Issues:

1. **Functions timeout**:
   - Audio files too large (>10MB Netlify limit)
   - Increase timeout in `netlify.toml`
   - Implement client-side audio compression

2. **Environment variables not loading**:
   - Ensure variables are prefixed with `VITE_` for client-side
   - Restart Netlify build after adding variables
   - Check for typos in variable names

## Testing Checklist

- [ ] User can sign up/sign in with email
- [ ] Google OAuth works
- [ ] Microphone permission granted
- [ ] Audio recording starts/stops
- [ ] Transcription returns text
- [ ] AI generates appropriate responses
- [ ] Text-to-speech plays audio
- [ ] Conversation history saves
- [ ] User can sign out
- [ ] Mobile devices work properly

## Migration Notes

If migrating from the previous multi-service setup:

1. **Remove old environment variables**:
   - `VITE_OPENROUTER_API_KEY`
   - `VITE_ASSEMBLYAI_API_KEY`

2. **Update API endpoints**:
   - All transcription now goes through OpenAI Whisper
   - All chat completions use OpenAI directly

3. **Database schema unchanged**:
   - No migration needed for existing user data
   - Conversation history remains intact

## Support

For deployment issues:
- Check Netlify build logs
- Verify all environment variables
- Test API keys manually
- Review browser console for errors