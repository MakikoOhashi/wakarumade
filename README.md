<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WAKARUMADE (わかるまで) - AI-Powered Math Learning Assistant

**WAKARUMADE** is an intelligent math learning application designed to help elementary school students understand math problems through AI-powered guidance. The app combines OCR technology, conversational AI, voice input, and local data persistence to create an engaging learning experience.

[![Demo](https://img.shields.io/badge/Demo-View_in_AI_Studio-blue)](https://ai.studio/apps/drive/1sQ1giErLE85ZK0dJuV59MDy2pFeVNS8j)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.0.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.3-green)](https://supabase.com/)

## 🎯 Features

### 📸 **Photo-Based Problem Recognition**
- Upload photos of math worksheets or textbook problems
- AI-powered OCR extracts problem text using Google Gemini 2.5 Flash
- Supports multiple formats including HEIC (iPhone photos)
- Automatic problem number detection

### 🤖 **AI Math Teacher**
- Conversational guidance tailored for elementary students
- Step-by-step explanations in Japanese
- Contextual hints when students are stuck
- Visual highlighting of key problem elements
- Encouraging and supportive teaching approach

### 🎤 **Voice Input Support**
- Voice-to-text functionality with speech recognition
- Automatic speech correction for math terminology
- Japanese language optimization for educational content
- Real-time transcription feedback

### 🔄 **Adaptive Learning**
- Similar problem generation based on solved problems
- Personalized learning paths
- Progress tracking through conversation history
- Smart hint system that responds to student needs

### 💾 **Cloud Data Persistence**
- Supabase PostgreSQL database for storing chat sessions
- Guest user support with UUID-based identification
- Persistent conversation history across browser sessions
- Real-time data synchronization

### 🎨 **Modern UI/UX**
- Clean, child-friendly interface design
- Mobile-responsive layout
- Intuitive problem selection interface
- Real-time chat experience

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v20.11.0 or later recommended)
- **Gemini API Key** (From [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
    ```bash
    git clone <repository-url>
    cd wakarumade
    ```

2. **Install dependencies**
    ```bash
    npm install
    ```

3. **Configure environment variables**
    Create a `.env.local` file in the root directory:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. **Start development server**
    ```bash
    npm run dev
    ```

5. **Open your browser**
    Navigate to `http://localhost:3000`

## 🏗️ Project Structure

```
├── app/
│   ├── api/                # Next.js API routes
│   │   ├── chat/           # Chat API with Supabase data persistence
│   │   ├── correct/        # Answer correction API
│   │   ├── hint/           # Hint generation API
│   │   ├── ocr/            # OCR processing API
│   │   └── similar/        # Similar problem generation API
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Main page component
├── public/                 # Static assets
├── prompts.ts              # AI teacher prompts and configurations
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── next.config.js          # Next.js configuration
├── .env.local              # Environment variables (Supabase, Gemini API)
└── README.md               # Project documentation
```

## 🔧 Technologies Used

- **Framework**: Next.js 14.0.0 + React 18.0.0 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Google Gemini 2.5 Flash
- **Styling**: TailwindCSS
- **Voice Recognition**: Web Speech API
- **OCR**: Google Generative AI Vision

## 📱 How to Use

1. **Upload a Problem Photo**
   - Click "写真をとる" (Take Photo) button
   - Upload or take a photo of a math worksheet
   - The AI will automatically extract problem text

2. **Select a Problem**
   - Browse detected problems
   - Click on any problem to start learning

3. **Interact with AI Teacher**
   - Ask questions in natural language
   - Use voice input for spoken questions
   - Receive step-by-step guidance and hints

4. **Generate Similar Problems**
   - When you solve a problem correctly
   - Click "似た問題にチャレンジ！" to get practice problems

## 🤝 Contributing

We welcome contributions to improve WAKARUMADE! Please feel free to:
- Report bugs or issues
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Demo

View the live demo: [AI Studio App](https://ai.studio/apps/drive/1sQ1giErLE85ZK0dJuV59MDy2pFeVNS8j)

## 📞 Support

For support or questions, please open an issue in this repository.

---

**WAKARUMADE** - Making math learning accessible and enjoyable for every student! 🎓
