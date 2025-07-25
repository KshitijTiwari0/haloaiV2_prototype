# Halo.AI - Emotional AI Companion

A sophisticated TypeScript React application that provides an empathetic AI companion capable of understanding voice, emotions, and providing natural responses.

## Features

### Core Features:
- **Voice Recording with VAD**: Advanced voice activity detection for natural conversation flow
- **Real-time Emotion Analysis**: Comprehensive audio feature extraction including pitch, energy, spectral features
- **AI-Powered Responses**: Contextual, empathetic responses using OpenRouter LLM
- **Text-to-Speech**: High-quality voice synthesis using Eleven Labs API with Web Speech fallback
- **Multiple Transcription Options**: Free and premium transcription services
- **Persistent Configuration**: Settings management with localStorage
- **Beautiful UI**: Modern, responsive design with animated AI avatar
- **Real-time Processing**: Live audio analysis and response generation

### Transcription Services:
- **Hugging Face Inference API** (Free with rate limits)
- **AssemblyAI** (Free tier available)
- **OpenAI Whisper** (Premium, most accurate)
- **Automatic Fallback**: Tries free services first, falls back to premium if available

### Design Elements:
- **Dark Theme**: Professional dark color scheme with emerald, purple, and cyan accents
- **Animated AI Avatar**: Rotating gradient border with contextual expressions
- **Responsive Layout**: Mobile-first design that works on all devices
- **Smooth Animations**: Subtle hover effects and state transitions
- **Status Feedback**: Clear visual feedback for recording, processing, and error states

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
# Required - OpenRouter API for AI responses
VITE_OPENROUTER_API_KEY=your-openrouter-api-key-here

# Required - Supabase for authentication
VITE_SUPABASE_URL=your-supabase-url-here
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Optional - For enhanced features
VITE_ELEVEN_LABS_API_KEY=your-eleven-labs-api-key-here
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_ASSEMBLYAI_API_KEY=your-assemblyai-api-key-here
```

### 3. Start Development Server
```bash
npm run dev
```

The app will work with free transcription services out of the box! Only the OpenRouter API key and Supabase configuration are required.

## API Configuration

### Required:
- **OpenRouter API Key**: Get from [OpenRouter](https://openrouter.ai/)
  - Free tier available
  - Required for AI response generation

- **Supabase Project**: Get from [Supabase](https://supabase.com/)
  - Free tier available
  - Required for user authentication
  - Enable Email and Google authentication in your Supabase project

### Optional (for better quality):
- **Eleven Labs API Key**: Get from [Eleven Labs](https://elevenlabs.io/)
  - Premium text-to-speech
  - Falls back to Web Speech API if not provided

- **OpenAI API Key**: Get from [OpenAI](https://platform.openai.com/)
  - Premium Whisper transcription
  - Falls back to free services if not provided

- **AssemblyAI API Key**: Get from [AssemblyAI](https://www.assemblyai.com/)
  - Alternative premium transcription
  - Free tier available

## Deployment

### Netlify Deployment

1. **Connect your repository to Netlify**
2. **Set environment variables in Netlify**:
   - Go to Site settings → Build & deploy → Environment variables
   - Add your API keys with the same names as in `.env`
3. **Deploy**: Netlify will automatically build and deploy your app

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## How It Works

1. **Authentication**: Sign in with email/password or Google account
2. **Voice Input**: Click the microphone and speak naturally
3. **Transcription**: Audio is automatically transcribed using available services
4. **Emotion Analysis**: Voice features are extracted and analyzed
5. **AI Response**: OpenRouter generates an empathetic response
6. **Voice Output**: Response is spoken back using TTS

## Technical Architecture

### Authentication
- **Supabase Auth**: Secure user authentication
- **Email/Password**: Traditional sign-up and sign-in
- **Google OAuth**: One-click social authentication

### Audio Processing
- **Web Audio API**: Browser-native audio recording and analysis
- **Voice Activity Detection**: Intelligent silence detection
- **Feature Extraction**: Comprehensive audio analysis

### AI Integration
- **OpenRouter API**: For generating empathetic responses
- **Multiple Transcription APIs**: Automatic fallback system
- **Eleven Labs/Web Speech**: High-quality text-to-speech

### State Management
- **React Hooks**: Modern state management
- **TypeScript**: Full type safety
- **Error Handling**: Comprehensive error boundaries

## Browser Compatibility

- Modern browsers with Web Audio API support
- Microphone permissions required
- HTTPS recommended for production deployment

## File Structure

```
src/
├── components/          # React components
│   ├── LoginPage.tsx   # Authentication interface
│   ├── MainPage.tsx    # Main interaction interface
│   └── AIAvatar.tsx    # Animated AI avatar
├── utils/              # Core functionality
│   ├── ConfigManager.ts        # Settings management
│   ├── AudioProcessor.ts       # Audio recording and transcription
│   ├── EmotionDetector.ts      # Audio feature extraction
│   ├── ResponseGenerator.ts    # AI response generation
│   ├── TextToSpeechEngine.ts   # Voice synthesis
│   └── EmotionalAICompanion.ts # Main orchestrator
├── types/              # TypeScript definitions
│   └── index.ts
└── App.tsx            # Main application component
```

## Usage

1. **Sign Up/Sign In**: Create an account or sign in with email or Google
2. **Voice Interaction**: Click the microphone button and speak naturally
3. **AI Response**: The system will analyze your voice and provide an empathetic response
4. **Continuous Conversation**: Continue speaking for ongoing interaction
5. **Sign Out**: Use the sign out button in the top-right corner

The application maintains conversation history and provides real-time feedback throughout the interaction process.

## Cost Breakdown

### Free Tier:
- Supabase Auth: Free (up to 50,000 monthly active users)
- Hugging Face transcription: Free (with rate limits)
- OpenRouter: Free tier available
- Web Speech TTS: Free (browser-based)

### Premium Features:
- OpenAI Whisper: $0.006/minute
- Eleven Labs TTS: $0.30/1K characters
- AssemblyAI: $0.37/hour

## Security

- ✅ API keys stored as environment variables
- ✅ Secure user authentication with Supabase
- ✅ Session management and automatic token refresh
- ✅ Keys not committed to version control
- ✅ Secure deployment with Netlify
- ⚠️ Client-side environment variables are visible in browser

## Troubleshooting

### Common Issues:
1. **Authentication not working**: Check Supabase URL and anon key are correct
2. **Google sign-in failing**: Verify Google OAuth is enabled in Supabase
1. **Microphone not working**: Check browser permissions
2. **Transcription failing**: Try speaking more clearly or check API keys
3. **No AI response**: Verify OpenRouter API key is set correctly
4. **TTS not working**: Check Eleven Labs API key or use Web Speech fallback

### Environment Variables:
1. **Supabase not connecting**: Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
1. **Variables not loading**: Ensure they're prefixed with `VITE_`
2. **Development server**: Restart after adding new variables
3. **Deployment**: Check Netlify environment variables are set

### Rate Limits:
- Hugging Face: May have temporary rate limits during high usage
- OpenRouter: Check your usage limits in the dashboard
- Eleven Labs: Monitor character usage in your account

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details