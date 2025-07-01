# Research Buddy 🤖📄

Research Buddy is an AI-powered application designed to help you analyze and discuss research papers efficiently. Upload a PDF and interact with a powerful AI assistant (powered by Google's Gemini 2.5 Flash) in a seamless, side-by-side view.

## Features

- **Side-by-Side PDF Viewer & Chat**: Read your research paper and chat with the AI assistant without switching windows.
- **Resizable Layout**: Easily adjust the size of the PDF viewer and chat panels with a simple drag-and-drop slider.
- **Interactive PDF Controls**:
  - **Pinch-to-Zoom**: Use your touchpad to zoom in and out of the document. The zoom is centered on your cursor for a natural feel.
  - **Drag-to-Pan**: When zoomed in, click and drag to move around the PDF.
  - **Double-Click to Reset**: Instantly reset the zoom and position with a quick double-click.
- **AI-Powered Chat**: Ask questions, get explanations, and discuss findings with the Gemini-powered chatbot.

## Tech Stack

- **Frontend**: React, Vite, TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini 2.5 Flash API
- **UI Components**: `lucide-react` for icons, `react-pdf` for rendering, `react-resizable-panels` for the layout.

## Setup & Installation

Follow these steps to get Research Buddy running on your local machine.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd research-buddy
```

### 2. Install dependencies

This project uses `npm` for package management.

```bash
npm install
```

### 3. Set up environment variables

You'll need a Google Gemini API key to use the AI features.

- Create a `.env` file in the root of the project.
- Add your API key to the `.env` file. Vite uses the `VITE_` prefix for environment variables.

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## Running the Application

Once you've completed the setup, you can run the development server.

```bash
npm run dev
```

This will start the application, and you can access it in your browser at `http://localhost:5173` (or the port specified in your terminal). 