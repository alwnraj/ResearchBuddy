import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  MessageCircle,
  Sparkles,
  Send,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// Gemini API key is loaded from environment variables so you can keep it in a local .env file.
// Supported variable names (choose one depending on your bundler):
//   VITE_GEMINI_API_KEY   – Vite
//   REACT_APP_GEMINI_API_KEY – Create-React-App / Webpack
//   GEMINI_API_KEY        – Node scripts
const GEMINI_API_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (process as any).env?.REACT_APP_GEMINI_API_KEY ||
  (process as any).env?.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn(
    "Gemini API key not found. Please create a .env file and set VITE_GEMINI_API_KEY, REACT_APP_GEMINI_API_KEY, or GEMINI_API_KEY."
  );
}

const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

const parseJsonFromMarkdown = (markdown: string): any => {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = markdown.match(jsonRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      console.error("Failed to parse JSON from markdown:", error);
      throw new Error("Invalid JSON found in the markdown response.");
    }
  }
  // Fallback for cases where the API returns raw JSON without markdown
  try {
    return JSON.parse(markdown);
  } catch (error) {
    console.error("Failed to parse raw text as JSON:", error);
    throw new Error(
      "The response was not valid JSON or a JSON markdown block."
    );
  }
};

const ResearchBuddy = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset transform when a new PDF is loaded
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [pdfFile]);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setMessages([
        {
          role: "assistant",
          content: `I've received your PDF "${file.name}". I'm ready to help you analyze and discuss this research paper! You can highlight text and add it to our chat, or ask me questions about the content.`,
        },
      ]);

      // Extract text from PDF
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target && event.target.result) {
            const pdfData = new Uint8Array(event.target.result as ArrayBuffer);
            const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(" ");
              fullText += pageText + "\n";
            }
            setPdfText(fullText);
            setNumPages(pdf.numPages);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error extracting text from PDF:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I'm sorry, I had trouble reading the PDF content. Please try another file.",
          },
        ]);
      }
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  // Add highlighted text to chat
  const addToChat = () => {
    if (selectedText) {
      setCurrentMessage(`"${selectedText}"\n\nCan you explain this part?`);
      setSelectedText("");
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = { role: "user", content: currentMessage };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, userMessage];
      const prompt = `You are a research assistant helping analyze a research paper. Here's the full conversation history and the paper content:\n\nPAPER CONTENT:\n${pdfText}\n\nCONVERSATION HISTORY:\n${JSON.stringify(
        conversationHistory
      )}\n\nProvide a helpful response about the research paper, considering the full context. Be specific and reference the paper when relevant.\n\nRespond with a JSON object:\n{\n  "response": "Your detailed response here"\n}\n\nYour entire response must be valid JSON only.`;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text =
        (response as any).text ||
        (response as any).candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      console.log("Gemini API Response Text:", text);

      const aiResponse = parseJsonFromMarkdown(text);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiResponse.response,
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);

      let errorMessage =
        "I apologize, but I encountered an error. Please try again.";
      if (error instanceof Error) {
        errorMessage += `\n\n**Error details:**\n\`\`\`\n${error.name}: ${error.message}\n${error.stack}\n\`\`\``;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    }
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const { ctrlKey, deltaX, deltaY } = e;

    if (ctrlKey) {
      // Zooming
      const viewer = pdfViewerRef.current;
      if (!viewer) return;
      const rect = viewer.getBoundingClientRect();
      const newScale = Math.max(
        0.5,
        Math.min(3, transform.scale - deltaY * 0.005)
      );

      const mouseX = e.clientX - rect.left - transform.x;
      const mouseY = e.clientY - rect.top - transform.y;

      const newX =
        transform.x - (mouseX * (newScale / transform.scale) - mouseX);
      const newY =
        transform.y - (mouseY * (newScale / transform.scale) - mouseY);

      setTransform({ scale: newScale, x: newX, y: newY });
    } else {
      // Panning with touchpad
      setTransform((prev) => ({
        ...prev,
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left mouse button
      setIsPanning(true);
      setLastPanPosition({ x: e.clientX, y: e.clientY });
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPosition.x;
      const deltaY = e.clientY - lastPanPosition.y;
      setTransform((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setLastPanPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grab";
    }
  };

  const handleMouseLeave = () => {
    if (isPanning) {
      setIsPanning(false);
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grab";
    }
  };

  const handleDoubleClick = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  return (
    <div className="h-screen bg-neutral-900 flex">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          {/* PDF Viewer Side */}
          <div className="w-full h-full bg-neutral-800 m-4 rounded-2xl shadow-xl flex flex-col border border-neutral-700">
            <div className="p-6 border-b border-neutral-700">
              <h2 className="text-xl font-semibold text-neutral-100 mb-4">
                Research Paper
              </h2>

              {!pdfFile ? (
                <div
                  className="border-2 border-dashed border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500 transition-colors bg-neutral-800/50"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
                  <p className="text-neutral-300 mb-2">
                    Drop your PDF here or click to upload
                  </p>
                  <p className="text-sm text-neutral-500">
                    Supports PDF files only
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      e.target.files &&
                      e.target.files[0] &&
                      handleFileUpload(e.target.files[0])
                    }
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6 text-orange-400" />
                    <span className="font-medium text-neutral-200">
                      {pdfFile.name}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {selectedText && (
                      <button
                        onClick={addToChat}
                        className="px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                      >
                        Add to Chat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {pdfFile && (
              <div
                ref={pdfViewerRef}
                className="flex-1 p-6 overflow-auto"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
                style={{ cursor: "grab", overflow: "hidden" }}
              >
                <div
                  onMouseUp={handleTextSelection}
                  style={{
                    transform: `scale(${transform.scale})`,
                    transformOrigin: "top left",
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    left: `${transform.x}px`,
                    top: `${transform.y}px`,
                  }}
                >
                  <Document
                    file={pdfFile}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  >
                    {Array.from(new Array(numPages), (el, index) => (
                      <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        className="mb-4"
                      />
                    ))}
                  </Document>
                </div>
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-700 hover:bg-orange-500 transition-colors" />
        <Panel defaultSize={50} minSize={25}>
          {/* Chat Side */}
          <div className="w-full h-full bg-neutral-800 m-4 rounded-2xl shadow-xl flex flex-col border border-neutral-700">
            <div className="p-6 border-b border-neutral-700">
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-6 w-6 text-orange-400" />
                <h2 className="text-xl font-semibold text-neutral-100">
                  Research Assistant
                </h2>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-neutral-400 mt-20">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                  <p>Upload a PDF to start discussing your research paper!</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                        message.role === "user"
                          ? "bg-neutral-700 text-neutral-100 border border-neutral-600"
                          : "bg-neutral-750 text-neutral-200 border border-neutral-600"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-750 p-4 rounded-2xl border border-neutral-600">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-neutral-700">
              {selectedText && (
                <div className="mb-3 p-3 bg-neutral-700 rounded-lg border-l-4 border-orange-500">
                  <p className="text-sm text-neutral-300">
                    <strong>Selected:</strong> "{selectedText.slice(0, 100)}..."
                  </p>
                </div>
              )}
              <div className="flex space-x-3">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about the paper, request explanations, or discuss findings..."
                  className="flex-1 p-3 border border-neutral-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-neutral-700 text-neutral-200 placeholder-neutral-500"
                  rows={3}
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 self-end shadow-sm"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ResearchBuddy;
