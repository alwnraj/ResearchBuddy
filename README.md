# Research Buddy

Research Buddy is an AI application for analyzing and discussing research papers. Upload a PDF and interact with an AI assistant powered by Google Gemini 2.5 Flash in a side-by-side layout.

## Features

* **Side-by-Side PDF Viewer and Chat**: Read the paper and chat with the AI in one view.
* **Resizable Layout**: Adjust panel sizes via drag-and-drop.
* **PDF Controls**:

  * **Pinch-to-Zoom** with cursor-centered zoom.
  * **Drag-to-Pan** when zoomed.
  * **Double-Click Reset** for zoom and position.
* **AI Chat**: Ask questions, request explanations, and discuss results using Gemini.

## Tech Stack

* **Frontend**: React, Vite, TypeScript
* **Styling**: Tailwind CSS
* **AI**: Google Gemini 2.5 Flash API
* **UI**: lucide-react, react-pdf, react-resizable-panels

## Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd research-buddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create a `.env` file in the project root and add your Gemini API key:

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## Run

```bash
npm run dev
```

Open `http://localhost:5173` (or the port shown in the terminal).
