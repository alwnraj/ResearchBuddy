/**
 * ResearchBuddy - AI-Powered PDF Research Assistant (Native PDF Viewer)
 *
 * This version uses the native browser PDF viewer for optimal performance and resolution.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileText,
  MessageCircle,
  Sparkles,
  Send,
  Loader2,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import * as pdfjsLib from "pdfjs-dist";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Converts markdown text to clean, readable plain text
 */
const markdownToText = (markdown: string): string => {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    let text = markdown;

    // Remove markdown code blocks but keep the content
    text = text.replace(/```[\s\S]*?\n([\s\S]*?)```/g, "$1");
    text = text.replace(/`([^`]+)`/g, "$1");

    // Convert headers to plain text
    text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1");

    // Convert bold and italic to plain text
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1"); // Bold italic
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
    text = text.replace(/\*([^*]+)\*/g, "$1"); // Italic
    text = text.replace(/__([^_]+)__/g, "$1"); // Bold alt
    text = text.replace(/_([^_]+)_/g, "$1"); // Italic alt

    // Convert lists to simple text with dashes
    text = text.replace(/^\s*[\*\-\+]\s+(.+)$/gm, "- $1");
    text = text.replace(/^\s*\d+\.\s+(.+)$/gm, "- $1");

    // Convert links to just the text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Handle brackets and citations
    text = text.replace(/\[([^\]]+)\]/g, "$1");

    // Convert blockquotes
    text = text.replace(/^>\s+(.+)$/gm, '"$1"');

    // Clean up spacing
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/[ \t]+$/gm, "");
    text = text.replace(/^[ \t]+/gm, "");

    return text.trim();
  } catch (error) {
    console.error("❌ Error converting markdown to text:", error);
    return markdown;
  }
};

/**
 * Gemini API Configuration
 */
const GEMINI_API_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (process as any).env?.REACT_APP_GEMINI_API_KEY ||
  (process as any).env?.GEMINI_API_KEY;

// Initialize Gemini AI client
let gemini: GoogleGenAI;
try {
  gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log("🤖 Gemini AI client initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Gemini AI client:", error);
}

/**
 * Message interface for chat functionality
 */
interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Detect if device is mobile
 */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};

/**
 * Main ResearchBuddy Component with Native PDF Viewer (Mobile Optimized)
 */
const ResearchBuddyNative = () => {
  console.log("🚀 ResearchBuddy Native component initializing...");

  // Mobile detection
  const isMobile = useIsMobile();

  // PDF and Document State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [selectedText, setSelectedText] = useState<string>("");

  // Chat and Messaging State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // UI Interaction State
  const [isChatCollapsed, setIsChatCollapsed] = useState(isMobile); // Start collapsed on mobile

  // Layout State
  const [panelSizes, setPanelSizes] = useState<number[]>([50, 50]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfViewerRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Update panel sizes when chat is collapsed or mobile state changes
  useEffect(() => {
    if (isChatCollapsed || isMobile) {
      setPanelSizes([100, 0]);
    } else {
      setPanelSizes([50, 50]);
    }
  }, [isChatCollapsed, isMobile]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /**
   * Extract text from PDF using PDF.js
   */
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      console.log("📄 Starting PDF text extraction...");

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      console.log(`📚 PDF loaded successfully. Pages: ${pdf.numPages}`);

      // Extract text from all pages
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n\n";

        console.log(`📝 Extracted text from page ${i}/${pdf.numPages}`);
      }

      console.log(
        `✅ PDF text extraction complete. Extracted ${fullText.length} characters`
      );
      return fullText;
    } catch (error) {
      console.error("❌ Error extracting text from PDF:", error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback(async (file: File) => {
    console.log("📁 File upload initiated...");

    if (!file) {
      console.warn("⚠️ No file provided");
      return;
    }

    if (file.type !== "application/pdf") {
      console.error("❌ Invalid file type:", file.type);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please upload a PDF file only.",
        },
      ]);
      return;
    }

    try {
      setPdfFile(file);

      // Create URL for the PDF
      const url = URL.createObjectURL(file);
      setPdfUrl(url);

      // Extract text from PDF
      const text = await extractTextFromPDF(file);
      setPdfText(text);

      console.log("✅ PDF loaded successfully");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `PDF "${file.name}" loaded successfully! You can now ask questions about the document.`,
        },
      ]);
    } catch (error) {
      console.error("❌ Error processing PDF:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, there was an error processing your PDF. Please try again.",
        },
      ]);
    }
  }, []);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle text selection in PDF
   */
  const handleTextSelection = useCallback(() => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const selectedTextContent = selection.toString().trim();
      if (selectedTextContent) {
        setSelectedText(selectedTextContent);
        console.log(
          `✅ Text selected: ${selectedTextContent.length} characters`
        );
      }
    } catch (error) {
      console.error("❌ Error handling text selection:", error);
    }
  }, []);

  /**
   * Add selected text to chat
   */
  const addToChat = useCallback(() => {
    if (!selectedText) return;

    const formattedMessage = `"${selectedText}"\n\nCan you explain this part?`;
    setCurrentMessage(formattedMessage);
    setSelectedText("");
  }, [selectedText]);

  /**
   * Send message to AI
   */
  const sendMessage = async () => {
    if (!currentMessage.trim() || !GEMINI_API_KEY) return;

    const userMessage: Message = { role: "user", content: currentMessage };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsLoading(true);

    try {
      // Enhanced prompt with instructions for curious but concise responses
      const prompt = pdfText
        ? `You are a curious but concise research assistant. You find the content fascinating and want to help users discover interesting insights, but you always keep your responses brief and to the point.

DOCUMENT CONTENT:
${pdfText}

USER QUESTION:
${currentMessage}

INSTRUCTIONS:
1. Keep responses under 3-4 sentences when possible
2. Start with a direct answer to the question
3. Add one interesting related observation or follow-up question
4. Use simple language and avoid unnecessary details
5. Format guidelines:
   - Use plain text only
   - Short dashed lists if needed
   - Natural conversational tone
   - No special formatting or markdown

Remember: Be curious and engaging, but prioritize brevity. If the user wants more details, they'll ask.`
        : currentMessage;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = response.text || "Sorry, I couldn't generate a response.";

      // Convert markdown to plain text before displaying
      const cleanText = markdownToText(text);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanText },
      ]);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle key press in chat input
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Handle panel resize
   */
  const handlePanelResize = useCallback((sizes: number[]) => {
    setPanelSizes(sizes);
  }, []);

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="h-screen bg-neutral-900 flex flex-col md:flex-row">
      {/* Mobile Layout: Vertical Stack */}
      {isMobile ? (
        <div className="flex flex-col h-full">
          {/* PDF Viewer Section */}
          <div
            className={`flex-1 bg-neutral-800 flex flex-col ${
              !isChatCollapsed ? "hidden" : ""
            }`}
          >
            {!pdfFile && (
              <div className="p-4">
                <div
                  className="border-2 border-dashed border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500 transition-colors bg-neutral-800/50"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
                  <p className="text-neutral-300 mb-2 text-lg">
                    Tap to upload PDF
                  </p>
                  <p className="text-sm text-neutral-500">
                    Native viewer for best mobile experience
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
              </div>
            )}

            {/* Mobile Add to Chat Button */}
            {selectedText && (
              <div className="fixed top-4 right-4 z-50">
                <button
                  onClick={addToChat}
                  className="px-4 py-3 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-all duration-200 shadow-lg min-h-[44px] flex items-center"
                >
                  Add to Chat
                </button>
              </div>
            )}

            {/* PDF Viewer */}
            {pdfFile && pdfUrl && (
              <div className="flex-1 relative">
                <iframe
                  ref={pdfViewerRef}
                  src={pdfUrl}
                  className="w-full h-full border-none"
                  title="PDF Viewer"
                  onLoad={() => {
                    console.log("✅ PDF loaded in native viewer");
                  }}
                  onTouchEnd={handleTextSelection}
                  onMouseUp={handleTextSelection}
                />
              </div>
            )}

            {/* Mobile Chat Toggle - Bottom Button */}
            {pdfFile && (
              <div className="fixed bottom-4 right-4 z-50">
                <button
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  className="w-14 h-14 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-full shadow-lg transition-all duration-300 flex items-center justify-center min-h-[44px] min-w-[44px]"
                  title="Toggle Chat"
                >
                  {isChatCollapsed ? (
                    <MessageCircle className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Chat Section - Mobile */}
          <div
            className={`bg-neutral-800 flex flex-col ${
              isChatCollapsed ? "hidden" : "h-full"
            }`}
          >
            {/* Mobile Chat Header */}
            <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-100">
                Research Assistant
              </h2>
              <div className="flex items-center space-x-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      setCurrentMessage("");
                      setSelectedText("");
                    }}
                    className="px-3 py-2 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-md transition-colors min-h-[44px] flex items-center justify-center"
                    title="Clear conversation"
                  >
                    <span className="text-sm">Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setIsChatCollapsed(true)}
                  className="px-3 py-2 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-md transition-colors min-h-[44px] flex items-center justify-center"
                  title="Close Chat"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages - Mobile */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="p-4 bg-neutral-700/30 rounded-2xl mb-6">
                    <div className="p-3 bg-orange-600/10 rounded-xl mb-4">
                      <MessageCircle className="h-8 w-8 mx-auto text-orange-400" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-200 mb-2">
                      Ready to Analyze
                    </h3>
                    <p className="text-sm text-neutral-400">
                      Upload a PDF to start discussing your research paper with
                      AI assistance!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    } group`}
                  >
                    <div
                      className={`flex items-start space-x-3 max-w-[90%] ${
                        message.role === "user"
                          ? "flex-row-reverse space-x-reverse"
                          : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === "user"
                            ? "bg-orange-600"
                            : "bg-neutral-700 border border-neutral-600"
                        }`}
                      >
                        {message.role === "user" ? (
                          <span className="text-xs font-medium text-white">
                            You
                          </span>
                        ) : (
                          <Sparkles className="h-4 w-4 text-orange-400" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`p-4 rounded-2xl shadow-sm backdrop-blur-sm ${
                          message.role === "user"
                            ? "bg-orange-600/10 text-neutral-100 border border-orange-600/20"
                            : "bg-neutral-700/50 text-neutral-200 border border-neutral-600/50"
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start group">
                  <div className="flex items-start space-x-3 max-w-[90%]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="p-4 rounded-2xl shadow-sm backdrop-blur-sm bg-neutral-700/50 border border-neutral-600/50">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                        <span className="text-sm text-neutral-300">
                          Thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Mobile Message Input */}
            <div className="px-4 py-3 border-t border-neutral-700 bg-neutral-800/50">
              {selectedText && (
                <div className="mb-3 p-3 bg-gradient-to-r from-orange-600/10 to-orange-500/5 rounded-xl border border-orange-600/20 backdrop-blur-sm">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 p-1.5 bg-orange-600/20 rounded-lg">
                      <FileText className="h-3 w-3 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-orange-300 mb-1">
                        Selected Text
                      </p>
                      <p className="text-sm text-neutral-200 leading-relaxed">
                        "{selectedText.slice(0, 100)}
                        {selectedText.length > 100 ? "..." : ""}"
                      </p>
                      <button
                        onClick={() => setSelectedText("")}
                        className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors mt-1"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-end space-x-2">
                <div className="flex-1 relative">
                  <textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      pdfFile
                        ? "Ask about the paper..."
                        : "Upload a PDF to start..."
                    }
                    disabled={!pdfFile}
                    className="w-full p-3 border border-neutral-600/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 bg-neutral-700/30 text-neutral-200 placeholder-neutral-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-base"
                    rows={2}
                  />
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isLoading || !pdfFile}
                  className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title={
                    !pdfFile
                      ? "Upload a PDF first"
                      : isLoading
                      ? "Processing..."
                      : "Send message"
                  }
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Layout: Horizontal Panels */
        <PanelGroup
          direction="horizontal"
          className="flex-1"
          onLayout={handlePanelResize}
        >
          <Panel defaultSize={isChatCollapsed ? 100 : 50} minSize={25}>
            {/* PDF Viewer Side - Desktop */}
            <div
              className={`w-full h-full bg-neutral-800 flex flex-col ${
                !isChatCollapsed ? "border-r border-neutral-700" : ""
              }`}
            >
              {!pdfFile && (
                <div className="p-6">
                  <div
                    className="border-2 border-dashed border-neutral-600 rounded-xl p-6 text-center cursor-pointer hover:border-orange-500 transition-colors bg-neutral-800/50"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-10 w-10 text-neutral-400 mb-3" />
                    <p className="text-neutral-300 mb-1">
                      Drop your PDF here or click to upload
                    </p>
                    <p className="text-xs text-neutral-500">
                      Uses native browser PDF viewer for best performance
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
                </div>
              )}

              {/* Add to Chat Button - Desktop */}
              {selectedText && (
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={addToChat}
                    className="px-2.5 py-1 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700 transition-all duration-200 shadow-sm animate-in slide-in-from-right-2 hover:scale-105"
                  >
                    Add to Chat
                  </button>
                </div>
              )}

              {/* PDF Viewer - Desktop */}
              {pdfFile && pdfUrl && (
                <div className="flex-1 relative">
                  <iframe
                    ref={pdfViewerRef}
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                    onLoad={() => {
                      console.log("✅ PDF loaded in native viewer");
                    }}
                    onMouseUp={handleTextSelection}
                  />

                  {/* Show Chat Button - Desktop */}
                  {isChatCollapsed && (
                    <div className="fixed top-1/2 right-0 transform -translate-y-1/2 z-50">
                      <button
                        onClick={() => setIsChatCollapsed(false)}
                        className="group relative bg-gradient-to-l from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg transition-all duration-300 flex items-center justify-center hover:scale-105 rounded-l-xl border-l-4 border-orange-500"
                        style={{
                          width: "48px",
                          height: "80px",
                          borderTopRightRadius: "0",
                          borderBottomRightRadius: "0",
                        }}
                        title="Show Research Assistant"
                      >
                        <div className="flex flex-col items-center space-y-1">
                          <MessageCircle className="h-5 w-5 animate-pulse" />
                          <div className="text-xs font-medium opacity-90">
                            AI
                          </div>
                        </div>

                        {/* Subtle glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-l from-orange-400/20 to-transparent rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>

          {!isChatCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-neutral-700 hover:bg-orange-500 transition-colors" />
              <Panel defaultSize={50} minSize={25}>
                {/* Chat Side - Desktop */}
                <div className="w-full h-full bg-neutral-800 flex flex-col">
                  <div className="px-6 py-3 border-b border-neutral-700">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold text-neutral-100">
                        Research Assistant
                      </h2>

                      <div className="flex items-center space-x-1.5">
                        {messages.length > 0 && (
                          <button
                            onClick={() => {
                              setMessages([]);
                              setCurrentMessage("");
                              setSelectedText("");
                            }}
                            className="px-2.5 py-1.5 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-md transition-colors flex items-center justify-center min-w-[60px]"
                            title="Clear conversation"
                          >
                            <span className="text-xs">Clear</span>
                          </button>
                        )}

                        {/* Chat Collapse Toggle */}
                        <button
                          onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                          className="px-2.5 py-1.5 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-md transition-colors"
                          title="Hide Chat"
                        >
                          <Plus className="h-3.5 w-3.5 rotate-45" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Messages - Desktop */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="p-4 bg-neutral-700/30 rounded-2xl mb-6">
                          <div className="p-3 bg-orange-600/10 rounded-xl mb-4">
                            <MessageCircle className="h-8 w-8 mx-auto text-orange-400" />
                          </div>
                          <h3 className="text-lg font-medium text-neutral-200 mb-2">
                            Ready to Analyze
                          </h3>
                          <p className="text-sm text-neutral-400 max-w-sm">
                            Upload a PDF to start discussing your research paper
                            with AI assistance!
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          } group`}
                        >
                          <div
                            className={`flex items-start space-x-3 max-w-[85%] ${
                              message.role === "user"
                                ? "flex-row-reverse space-x-reverse"
                                : ""
                            }`}
                          >
                            {/* Avatar */}
                            <div
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                                message.role === "user"
                                  ? "bg-orange-600"
                                  : "bg-neutral-700 border border-neutral-600"
                              }`}
                            >
                              {message.role === "user" ? (
                                <span className="text-xs font-medium text-white">
                                  You
                                </span>
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                              )}
                            </div>

                            {/* Message Content */}
                            <div
                              className={`p-4 rounded-2xl shadow-sm backdrop-blur-sm ${
                                message.role === "user"
                                  ? "bg-orange-600/10 text-neutral-100 border border-orange-600/20"
                                  : "bg-neutral-700/50 text-neutral-200 border border-neutral-600/50"
                              }`}
                            >
                              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="flex justify-start group">
                        <div className="flex items-start space-x-3 max-w-[85%]">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                          </div>
                          <div className="p-4 rounded-2xl shadow-sm backdrop-blur-sm bg-neutral-700/50 border border-neutral-600/50">
                            <div className="flex items-center space-x-2">
                              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                              <span className="text-sm text-neutral-300">
                                Thinking...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input - Desktop */}
                  <div className="px-4 py-3 border-t border-neutral-700 bg-neutral-800/50">
                    {selectedText && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-orange-600/10 to-orange-500/5 rounded-xl border border-orange-600/20 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 p-1.5 bg-orange-600/20 rounded-lg">
                            <FileText className="h-3.5 w-3.5 text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-orange-300 mb-1">
                              Selected Text{" "}
                            </p>
                            <p className="text-sm text-neutral-200 leading-relaxed">
                              "{selectedText.slice(0, 150)}
                              {selectedText.length > 150 ? "..." : ""}"
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <button
                                onClick={() => setSelectedText("")}
                                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-end space-x-3">
                      <div className="flex-1 relative">
                        <textarea
                          value={currentMessage}
                          onChange={(e) => setCurrentMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder={
                            pdfFile
                              ? "Ask about the paper, request explanations, or discuss findings..."
                              : "Upload a PDF to start the conversation..."
                          }
                          disabled={!pdfFile}
                          className="w-full p-3 border border-neutral-600/50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 bg-neutral-700/30 text-neutral-200 placeholder-neutral-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          rows={2}
                        />
                      </div>

                      <button
                        onClick={sendMessage}
                        disabled={
                          !currentMessage.trim() || isLoading || !pdfFile
                        }
                        className="p-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          !pdfFile
                            ? "Upload a PDF first"
                            : isLoading
                            ? "Processing..."
                            : "Send message"
                        }
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      )}
    </div>
  );
};

export default ResearchBuddyNative;
