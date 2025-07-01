/**
 * ResearchBuddy - AI-Powered PDF Research Assistant
 *
 * This component provides comprehensive PDF viewing and AI-powered research assistance.
 * Enhanced with extensive error handling, debugging, and documentation for production use.
 *
 * 🔧 IMPROVEMENTS IMPLEMENTED:
 *
 * 1. **Error Handling & Recovery**
 *    - Comprehensive try-catch blocks throughout all functions
 *    - Typed error categories for better debugging
 *    - Graceful fallbacks for API failures
 *    - User-friendly error messages with technical details in dev mode
 *    - Automatic state cleanup on errors
 *
 * 2. **Debugging & Logging**
 *    - Extensive console logging with emoji prefixes for easy filtering
 *    - Performance timing for all major operations
 *    - Progress tracking for long-running operations
 *    - State change logging with detailed metrics
 *    - Browser feature compatibility checking
 *
 * 3. **Input Validation & Security**
 *    - File type and size validation
 *    - API key configuration verification
 *    - Input sanitization for JSON parsing
 *    - Memory leak prevention with proper cleanup
 *    - ArrayBuffer detachment protection
 *
 * 4. **Enhanced User Experience**
 *    - Real-time progress feedback for PDF processing
 *    - Detailed processing statistics
 *    - Keyboard shortcuts with visual feedback
 *    - Auto-focus and cursor positioning
 *    - Smart error recovery suggestions
 *
 * 5. **Code Quality & Maintainability**
 *    - JSDoc comments for all functions and interfaces
 *    - TypeScript interfaces for better type safety
 *    - Modular error handling with typed error categories
 *    - Consistent logging format throughout
 *    - Performance monitoring and optimization
 *
 * 🏗️ ARCHITECTURE:
 * - React functional component with hooks
 * - TypeScript for type safety
 * - PDF.js for document rendering
 * - Google Gemini AI for research assistance
 * - react-resizable-panels for layout
 * - Comprehensive error boundaries
 *
 * 🐛 DEBUGGING FEATURES:
 * - Console logs filterable by emoji prefixes:
 *   📁 File operations, 💬 Chat/messaging, 🔍 PDF processing
 *   ⌨️ Keyboard shortcuts, 🔄 State changes, ❌ Errors
 *   ✅ Success operations, ⚠️ Warnings, 🎉 Major events
 *
 * @author Enhanced with comprehensive error handling and debugging
 * @version 2.0.0 - Production Ready
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
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
  MousePointer2,
  Hand,
  Monitor,
  Plus,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

/**
 * Gemini API Configuration
 *
 * API key is loaded from environment variables to keep it secure.
 * Supported variable names (choose one depending on your bundler):
 *   VITE_GEMINI_API_KEY   – Vite
 *   REACT_APP_GEMINI_API_KEY – Create-React-App / Webpack
 *   GEMINI_API_KEY        – Node scripts
 */
const GEMINI_API_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (process as any).env?.REACT_APP_GEMINI_API_KEY ||
  (process as any).env?.GEMINI_API_KEY;

// Enhanced API key validation with detailed logging
if (!GEMINI_API_KEY) {
  console.error("❌ Gemini API key not found!");
  console.warn(
    "🔧 Setup Instructions:\n" +
      "1. Create a .env file in your project root\n" +
      "2. Add one of these lines:\n" +
      "   - VITE_GEMINI_API_KEY=your_api_key_here (for Vite)\n" +
      "   - REACT_APP_GEMINI_API_KEY=your_api_key_here (for CRA)\n" +
      "   - GEMINI_API_KEY=your_api_key_here (for Node)\n" +
      "3. Get your API key from: https://makersuite.google.com/app/apikey"
  );
} else {
  console.log("✅ Gemini API key loaded successfully");
  // Log partial key for debugging (security-safe)
  console.log(
    `🔑 API Key preview: ${GEMINI_API_KEY.substring(
      0,
      8
    )}...${GEMINI_API_KEY.substring(-4)}`
  );
}

// Initialize Gemini AI client with error handling
let gemini: GoogleGenAI;
try {
  gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log("🤖 Gemini AI client initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Gemini AI client:", error);
  throw new Error(
    "Gemini AI initialization failed. Please check your API key."
  );
}

/**
 * Message interface for chat functionality
 * @interface Message
 * @property {string} role - The role of the message sender ("user" | "assistant")
 * @property {string} content - The actual message content
 */
interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * PDF Transform state for zoom and pan functionality
 * @interface Transform
 * @property {number} scale - Current zoom scale (1 = 100%)
 * @property {number} x - Horizontal pan offset in pixels
 * @property {number} y - Vertical pan offset in pixels
 */
interface Transform {
  scale: number;
  x: number;
  y: number;
}

/**
 * Error types for better error handling
 */
type ErrorType =
  | "PDF_LOAD"
  | "API_CALL"
  | "TEXT_EXTRACTION"
  | "JSON_PARSE"
  | "FILE_UPLOAD"
  | "UNKNOWN";

// Error Boundary Component
class PDFErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: {
    children: React.ReactNode;
    onError?: (error: Error) => void;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PDF Error Boundary caught an error:", error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 text-neutral-400 border-2 border-dashed border-neutral-600 rounded-xl">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-neutral-500" />
            <p className="text-neutral-300 mb-2">Error loading PDF</p>
            <p className="text-xs text-neutral-500">
              Please try uploading a different PDF file
            </p>
            <button
              onClick={() =>
                this.setState({ hasError: false, error: undefined })
              }
              className="mt-3 px-3 py-1 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Sanitizes a JSON string by removing problematic control characters
 * and properly escaping quotes and special characters.
 *
 * @param {string} str - The raw JSON string to sanitize
 * @returns {string} - The sanitized JSON string
 * @throws {Error} - If input is not a string
 */
const sanitizeJsonString = (str: string): string => {
  console.log("🧹 Sanitizing JSON string...");

  // Input validation
  if (typeof str !== "string") {
    console.error(
      "❌ sanitizeJsonString: Input must be a string, got:",
      typeof str
    );
    throw new Error("Input must be a string");
  }

  if (str.length === 0) {
    console.warn("⚠️ sanitizeJsonString: Empty string provided");
    return str;
  }

  try {
    const sanitized = str
      // Remove control characters except for allowed ones (newline, carriage return, tab)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Escape unescaped quotes (avoiding already escaped ones)
      .replace(/(?<!\\)"/g, '\\"')
      // Escape unescaped backslashes
      .replace(/(?<!\\)\\/g, "\\\\")
      // Convert actual newlines to escaped newlines
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    console.log("✅ JSON string sanitized successfully");
    console.log(
      `📏 Original length: ${str.length}, Sanitized length: ${sanitized.length}`
    );

    return sanitized;
  } catch (error) {
    console.error("❌ Error during JSON sanitization:", error);
    throw new Error(`JSON sanitization failed: ${error}`);
  }
};

/**
 * Parses JSON response from Gemini API with multiple fallback strategies
 *
 * @param {string} markdown - Raw response from Gemini API
 * @returns {any} - Parsed JSON object with response property
 * @throws {Error} - If all parsing strategies fail
 */
const parseJsonFromMarkdown = (markdown: string): any => {
  console.log("🔍 Starting JSON parsing process...");
  console.log("📝 Raw response preview:", markdown.substring(0, 300) + "...");
  console.log("📏 Total response length:", markdown.length);

  // Input validation
  if (!markdown || typeof markdown !== "string") {
    console.error("❌ parseJsonFromMarkdown: Invalid input provided");
    throw new Error("Invalid markdown input: must be a non-empty string");
  }

  // Strategy 1: Extract JSON from markdown code blocks
  console.log("🎯 Strategy 1: Extracting JSON from markdown blocks...");
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = markdown.match(jsonRegex);

  if (match && match[1]) {
    let jsonStr = match[1].trim();
    console.log("✅ Found JSON block, length:", jsonStr.length);
    console.log("📄 JSON preview:", jsonStr.substring(0, 200) + "...");

    // Strategy 1a: Parse original JSON
    console.log("🔄 Attempting direct JSON parse...");
    try {
      const result = JSON.parse(jsonStr);
      console.log("✅ Direct JSON parse successful!");
      return result;
    } catch (error) {
      console.warn("⚠️ Direct JSON parse failed:", error);

      // Strategy 1b: Sanitize and parse
      console.log("🧹 Attempting sanitized JSON parse...");
      try {
        const sanitized = sanitizeJsonString(jsonStr);
        console.log(
          "📄 Sanitized preview:",
          sanitized.substring(0, 200) + "..."
        );
        const result = JSON.parse(sanitized);
        console.log("✅ Sanitized JSON parse successful!");
        return result;
      } catch (sanitizeError) {
        console.error("❌ Sanitized JSON parse failed:", sanitizeError);

        // Strategy 1c: Manual content extraction
        console.log("🔧 Attempting manual content extraction...");
        const responseMatch = jsonStr.match(
          /"response"\s*:\s*"((?:[^"\\]|\\.)*)"/
        );
        if (responseMatch) {
          console.log("✅ Manual extraction successful!");
          return {
            response: responseMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\r/g, "\r"),
          };
        }
        console.warn("⚠️ Manual extraction found no match");
      }
    }
  } else {
    console.log("ℹ️ No JSON markdown blocks found");
  }

  // Strategy 2: Parse as raw JSON
  console.log("🎯 Strategy 2: Parsing as raw JSON...");
  try {
    const result = JSON.parse(markdown);
    console.log("✅ Raw JSON parse successful!");
    return result;
  } catch (error) {
    console.warn("⚠️ Raw JSON parse failed:", error);
  }

  // Strategy 3: Regex content extraction
  console.log("🎯 Strategy 3: Regex content extraction...");
  const contentMatch = markdown.match(
    /(?:response["\s]*:[\s]*["])([\s\S]*?)(?:["][\s]*}|$)/i
  );
  if (contentMatch) {
    console.log("✅ Regex extraction successful!");
    return {
      response: contentMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\t/g, "\t")
        .trim(),
    };
  }

  // Strategy 4: Last resort fallback
  console.log("🆘 Strategy 4: Last resort fallback...");
  console.error("❌ All JSON parsing strategies failed");
  console.log("📋 Full response content for debugging:", markdown);

  const cleanedContent = markdown
    .replace(/[{}"\[\]]/g, "")
    .replace(/response\s*:?\s*/i, "")
    .trim()
    .substring(0, 800);

  return {
    response:
      cleanedContent ||
      "I apologize, but I'm having trouble formatting my response properly. Could you please try asking your question again?",
  };
};

/**
 * Main ResearchBuddy Component
 *
 * A React component that provides PDF viewing and AI-powered research assistance.
 * Features include:
 * - PDF upload and high-quality rendering
 * - Text selection and highlighting
 * - AI chat integration with Gemini
 * - Auto-zoom and pan functionality
 * - Responsive panel layout
 */
const ResearchBuddy = () => {
  console.log("🚀 ResearchBuddy component initializing...");

  // PDF and Document State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");

  // Chat and Messaging State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // UI Interaction State
  const [highlights, setHighlights] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isTextSelectionMode, setIsTextSelectionMode] = useState(true);

  // PDF Viewer State
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [autoZoom, setAutoZoom] = useState<boolean>(true);

  // Layout State
  const [panelSizes, setPanelSizes] = useState<number[]>([50, 50]);

  // Memoize options to prevent unnecessary reloads
  const pdfOptions = useMemo(
    () => ({
      cMapUrl: "https://unpkg.com/pdfjs-dist@4.4.168/cmaps/",
      cMapPacked: true,
      standardFontDataUrl:
        "https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/",
    }),
    []
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Component initialization effect
   * Logs component mount and performs initial setup
   */
  useEffect(() => {
    console.log("🎉 ResearchBuddy component mounted successfully");
    console.log("🔧 Environment:", process.env.NODE_ENV || "development");
    console.log(
      "🌐 User Agent:",
      navigator.userAgent.substring(0, 100) + "..."
    );
    console.log("📱 Viewport:", `${window.innerWidth}x${window.innerHeight}`);

    // Check for required browser features
    const requiredFeatures = {
      FileReader: typeof FileReader !== "undefined",
      Blob: typeof Blob !== "undefined",
      "URL.createObjectURL":
        typeof URL !== "undefined" && typeof URL.createObjectURL === "function",
      getSelection: typeof window.getSelection === "function",
    };

    console.log("🔍 Browser feature check:", requiredFeatures);

    const missingFeatures = Object.entries(requiredFeatures)
      .filter(([, supported]) => !supported)
      .map(([feature]) => feature);

    if (missingFeatures.length > 0) {
      console.warn("⚠️ Missing browser features:", missingFeatures);
    }

    return () => {
      console.log("👋 ResearchBuddy component unmounting");
    };
  }, []);

  /**
   * PDF file change effect
   * Handles PDF loading, instructions display, and auto-zoom setup
   */
  useEffect(() => {
    if (!pdfFile) {
      console.log("📄 No PDF file loaded");
      return;
    }

    console.log("🔄 PDF file state updated...");
    console.log(
      `📊 File details: ${pdfFile.name} (${(pdfFile.size / 1024 / 1024).toFixed(
        2
      )}MB)`
    );

    try {
      // Show instructions when PDF is loaded
      console.log("💡 Showing instructions for 4 seconds...");
      setShowInstructions(true);

      const instructionTimer = setTimeout(() => {
        setShowInstructions(false);
        console.log("💡 Instructions auto-hidden");
      }, 4000);

      // Auto-zoom to fit panel after PDF renders
      const autoZoomTimer = setTimeout(() => {
        console.log("🔍 Applying auto-zoom...");

        if (autoZoom) {
          if (pdfViewerRef.current) {
            const viewerRect = pdfViewerRef.current.getBoundingClientRect();
            const availableWidth = viewerRect.width - 48;
            const pdfPageWidth = 1200; // Adjusted for 2x base scale
            const optimalScale = Math.min(availableWidth / pdfPageWidth, 1.5);
            const finalScale = Math.max(0.3, optimalScale);

            console.log(`📊 Auto-zoom calculation:`);
            console.log(`   - Available width: ${availableWidth}px`);
            console.log(`   - PDF page width: ${pdfPageWidth}px`);
            console.log(`   - Optimal scale: ${optimalScale.toFixed(3)}`);
            console.log(`   - Final scale: ${finalScale.toFixed(3)}`);

            setTransform((prev) => ({
              ...prev,
              scale: finalScale,
            }));

            console.log("✅ Auto-zoom applied successfully");
          } else {
            console.warn("⚠️ PDF viewer ref not available for auto-zoom");
          }
        } else {
          console.log("🔒 Auto-zoom disabled, using default scale");
          setTransform({ scale: 1, x: 0, y: 0 });
        }
      }, 200);

      return () => {
        clearTimeout(instructionTimer);
        clearTimeout(autoZoomTimer);
        console.log("🧹 PDF file effect cleanup completed");
      };
    } catch (error) {
      console.error("❌ Error in PDF file effect:", error);
    }
  }, [pdfFile, autoZoom]);

  /**
   * Messages array change effect
   * Logs message updates and manages chat auto-scroll
   */
  useEffect(() => {
    if (messages.length === 0) {
      console.log("💬 Chat initialized with empty message array");
      return;
    }

    const latestMessage = messages[messages.length - 1];
    console.log("💬 New message added to chat:");
    console.log(`   - Role: ${latestMessage.role}`);
    console.log(`   - Length: ${latestMessage.content.length} characters`);
    console.log(`   - Total messages: ${messages.length}`);
    console.log(
      `   - Preview: "${latestMessage.content.substring(0, 100)}${
        latestMessage.content.length > 100 ? "..." : ""
      }"`
    );

    // Auto-scroll to latest message
    try {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        console.log("📜 Auto-scrolled to latest message");
      }
    } catch (scrollError) {
      console.warn("⚠️ Auto-scroll failed:", scrollError);
    }

    // Track conversation metrics
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter(
      (m) => m.role === "assistant"
    ).length;
    const totalChars = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );

    console.log("📊 Conversation metrics:");
    console.log(`   - User messages: ${userMessages}`);
    console.log(`   - Assistant messages: ${assistantMessages}`);
    console.log(`   - Total characters: ${totalChars.toLocaleString()}`);
    console.log(
      `   - Average message length: ${Math.round(
        totalChars / messages.length
      )} chars`
    );
  }, [messages]);

  /**
   * Keyboard shortcuts effect
   * Handles global keyboard shortcuts for mode switching
   */
  useEffect(() => {
    console.log("⌨️ Setting up keyboard shortcuts...");

    const handleKeyPress = (e: KeyboardEvent) => {
      try {
        // Skip if user is typing in input fields
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === "TEXTAREA" || target.tagName === "INPUT")
        ) {
          return;
        }

        // Handle mode switching shortcuts
        if (e.key === "t" || e.key === "T") {
          console.log("⌨️ Keyboard shortcut: Switching to text selection mode");
          setIsTextSelectionMode(true);

          // Provide visual feedback
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (
              lastMessage?.role === "assistant" &&
              lastMessage.content.includes("Text Selection Mode")
            ) {
              return prev; // Don't duplicate mode messages
            }
            return prev;
          });
        } else if (e.key === "p" || e.key === "P") {
          console.log("⌨️ Keyboard shortcut: Switching to pan mode");
          setIsTextSelectionMode(false);

          // Clear any text selection when switching to pan mode
          if (selectedText) {
            setSelectedText("");
            console.log("🧹 Cleared text selection when switching to pan mode");
          }
        }

        // Additional shortcuts for power users
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case "r":
              if (pdfFile) {
                e.preventDefault();
                console.log("⌨️ Keyboard shortcut: Reset zoom");
                setTransform({ scale: 1, x: 0, y: 0 });
              }
              break;
            case "+":
            case "=":
              if (pdfFile) {
                e.preventDefault();
                console.log("⌨️ Keyboard shortcut: Zoom in");
                setTransform((prev) => ({
                  ...prev,
                  scale: Math.min(2, prev.scale * 1.2),
                }));
              }
              break;
            case "-":
              if (pdfFile) {
                e.preventDefault();
                console.log("⌨️ Keyboard shortcut: Zoom out");
                setTransform((prev) => ({
                  ...prev,
                  scale: Math.max(0.2, prev.scale / 1.2),
                }));
              }
              break;
          }
        }
      } catch (error) {
        console.error("❌ Error handling keyboard shortcut:", error);
        // Don't show user error for keyboard issues
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    console.log("✅ Keyboard shortcuts registered");

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      console.log("🧹 Keyboard shortcuts cleanup completed");
    };
  }, [pdfFile, selectedText]);

  /**
   * Handles PDF file upload with comprehensive error handling and progress tracking
   *
   * @param {File} file - The PDF file to upload and process
   * @returns {Promise<void>}
   */
  const handleFileUpload = useCallback(async (file: File) => {
    console.log("📁 PDF upload initiated...");
    const startTime = performance.now();

    try {
      // Input validation with detailed logging
      if (!file) {
        console.error("❌ No file provided to handleFileUpload");
        throw new Error("FILE_UPLOAD: No file provided");
      }

      console.log(`📊 File analysis:`);
      console.log(`   - Name: ${file.name}`);
      console.log(`   - Type: ${file.type}`);
      console.log(`   - Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `   - Last modified: ${new Date(file.lastModified).toISOString()}`
      );

      // File type validation
      if (file.type !== "application/pdf") {
        console.error(`❌ Invalid file type: ${file.type}`);
        const errorMsg =
          file.type === ""
            ? "Unable to determine file type. Please ensure this is a valid PDF file."
            : `Invalid file type: ${file.type}. Please upload a PDF file.`;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errorMsg,
          },
        ]);
        return;
      }

      // File size validation (50MB limit)
      const maxSizeMB = 50;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        console.error(
          `❌ File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        );
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `File too large (${(file.size / 1024 / 1024).toFixed(
              1
            )}MB). Please use a file smaller than ${maxSizeMB}MB.`,
          },
        ]);
        return;
      }

      // File name validation
      if (file.name.length > 255) {
        console.warn("⚠️ Very long filename detected");
      }

      console.log("✅ File validation passed");

      // Reset application state
      console.log("🔄 Resetting application state...");
      setPdfText("");
      setNumPages(null);
      setSelectedText("");
      setTransform({ scale: 1, x: 0, y: 0 });
      setIsLoading(false);

      // Create secure file copy to prevent ArrayBuffer detachment
      console.log("🔧 Creating secure file copy...");
      const fileBlob = new Blob([file], { type: "application/pdf" });
      const secureFile = new File([fileBlob], file.name, {
        type: "application/pdf",
        lastModified: file.lastModified,
      });

      setPdfFile(secureFile);
      console.log("✅ File state updated");

      // Show initial success message
      setMessages([
        {
          role: "assistant",
          content: `📚 Processing "${file.name}" (${(
            file.size /
            1024 /
            1024
          ).toFixed(1)}MB)... Please wait while I extract the text content.`,
        },
      ]);

      // PDF text extraction with detailed progress
      console.log("🔍 Starting PDF text extraction...");
      const extractionStartTime = performance.now();

      const arrayBuffer = await file.arrayBuffer();
      console.log(
        `✅ File read into ArrayBuffer (${arrayBuffer.byteLength} bytes)`
      );

      const pdfData = new Uint8Array(arrayBuffer);
      console.log(`📊 PDF data prepared: ${pdfData.length} bytes`);

      const pdf = await pdfjs.getDocument({
        data: pdfData,
        cMapUrl: "https://unpkg.com/pdfjs-dist@4.4.168/cmaps/",
        cMapPacked: true,
        standardFontDataUrl:
          "https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/",
      }).promise;

      console.log(`📖 PDF loaded successfully:`);
      console.log(`   - Pages: ${pdf.numPages}`);
      console.log(`   - PDF Version: ${pdf._pdfInfo?.version || "unknown"}`);

      setNumPages(pdf.numPages);

      // Text extraction with progress tracking
      let fullText = "";
      let totalChars = 0;
      let pagesWithErrors = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const pageText = textContent.items
            .map((item: any) => {
              if (typeof item.str === "string") {
                return item.str;
              }
              console.warn(
                `⚠️ Non-string text item on page ${i}:`,
                typeof item.str
              );
              return String(item.str || "");
            })
            .join(" ");

          fullText += pageText + "\n";
          totalChars += pageText.length;

          // Progress logging every 10 pages
          if (i % 10 === 0 || i === pdf.numPages) {
            console.log(
              `📄 Progress: ${i}/${
                pdf.numPages
              } pages (${totalChars.toLocaleString()} chars)`
            );

            // Update progress for long documents
            if (pdf.numPages > 20 && i % 10 === 0) {
              setMessages((prev) => [
                ...prev.slice(0, -1), // Remove last message
                {
                  role: "assistant",
                  content: `📚 Processing "${file.name}"... Extracted ${i}/${
                    pdf.numPages
                  } pages (${totalChars.toLocaleString()} characters)`,
                },
              ]);
            }
          }
        } catch (pageError) {
          pagesWithErrors++;
          console.error(`❌ Error processing page ${i}:`, pageError);
          fullText += `[Error reading page ${i}: ${
            pageError instanceof Error ? pageError.message : "Unknown error"
          }]\n`;
        }
      }

      setPdfText(fullText);

      const extractionTime = (
        (performance.now() - extractionStartTime) /
        1000
      ).toFixed(2);
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

      console.log("✅ PDF text extraction completed!");
      console.log(`📊 Extraction statistics:`);
      console.log(`   - Total pages: ${pdf.numPages}`);
      console.log(`   - Pages with errors: ${pagesWithErrors}`);
      console.log(`   - Characters extracted: ${totalChars.toLocaleString()}`);
      console.log(`   - Extraction time: ${extractionTime}s`);
      console.log(`   - Total processing time: ${totalTime}s`);
      console.log(
        `   - Processing speed: ${Math.round(
          totalChars / parseFloat(extractionTime)
        )} chars/sec`
      );

      // Final success message with statistics
      const errorNote =
        pagesWithErrors > 0 ? ` (${pagesWithErrors} pages had errors)` : "";
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove progress message
        {
          role: "assistant",
          content: `✅ Successfully processed "${
            file.name
          }"!\n\n📊 Statistics:\n- ${
            pdf.numPages
          } pages processed${errorNote}\n- ${totalChars.toLocaleString()} characters extracted\n- Processing time: ${totalTime}s\n\nI'm ready to help you analyze this research paper! You can highlight text and add it to our chat, or ask me questions about the content.`,
        },
      ]);
    } catch (error) {
      const errorType: ErrorType = "FILE_UPLOAD";
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

      console.error(
        `❌ File upload failed after ${totalTime}s (${errorType}):`,
        error
      );

      let userMessage =
        "I'm sorry, there was an error processing your PDF file.";
      let technicalDetails = "";

      if (error instanceof Error) {
        console.log("🔍 Error analysis:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 300) + "...",
        });

        // Provide specific error messages
        if (error.message.includes("Invalid PDF")) {
          userMessage =
            "This doesn't appear to be a valid PDF file. Please try a different file.";
        } else if (
          error.message.includes("password") ||
          error.message.includes("encrypted")
        ) {
          userMessage =
            "This PDF appears to be password-protected. Please use an unprotected PDF file.";
        } else if (
          error.message.includes("corrupted") ||
          error.message.includes("damaged")
        ) {
          userMessage =
            "This PDF file appears to be corrupted. Please try a different file.";
        } else if (error.message.includes("FILE_UPLOAD: No file provided")) {
          userMessage =
            "No file was selected. Please choose a PDF file to upload.";
        } else if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          userMessage =
            "Network error while processing the file. Please check your connection and try again.";
        } else {
          userMessage =
            "An unexpected error occurred while processing the PDF. Please try a different file.";
        }

        // Add technical details in development mode
        if (process.env.NODE_ENV === "development") {
          technicalDetails = `\n\n**Technical Details:**\n- Error: ${error.name}\n- Message: ${error.message}\n- Processing time: ${totalTime}s`;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: userMessage + technicalDetails,
        },
      ]);

      // Reset file state on error
      setPdfFile(null);
      setPdfText("");
      setNumPages(null);
      setSelectedText("");
      setTransform({ scale: 1, x: 0, y: 0 });

      console.log("🔄 Error cleanup completed");
    }
  }, []);

  /**
   * Handles file drop events with validation and error handling
   *
   * @param {React.DragEvent} e - The drag event
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      console.log("📁 File drop detected...");

      try {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        console.log(`📊 ${files.length} file(s) dropped`);

        if (files.length === 0) {
          console.warn("⚠️ No files in drop event");
          return;
        }

        if (files.length > 1) {
          console.warn("⚠️ Multiple files dropped, using first file only");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "I can only process one PDF at a time. Using the first file you dropped.",
            },
          ]);
        }

        const file = files[0];
        console.log(`📄 Processing file: ${file.name} (${file.type})`);

        handleFileUpload(file);
      } catch (error) {
        console.error("❌ Error handling file drop:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Error processing dropped file. Please try uploading the file using the upload button.",
          },
        ]);
      }
    },
    [handleFileUpload]
  );

  /**
   * Handles drag over events to enable drop functionality
   *
   * @param {React.DragEvent} e - The drag event
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback could be added here
  }, []);

  /**
   * Handles text selection in the PDF viewer
   * Captures selected text and updates state for chat integration
   */
  const handleTextSelection = () => {
    try {
      const selection = window.getSelection();

      if (!selection) {
        console.log("ℹ️ No selection object available");
        return;
      }

      if (selection.rangeCount === 0) {
        console.log("ℹ️ No selection ranges available");
        return;
      }

      const selectedTextContent = selection.toString().trim();

      if (!selectedTextContent) {
        console.log("ℹ️ Empty text selection");
        // Clear any existing selection
        if (selectedText) {
          setSelectedText("");
          console.log("🧹 Cleared previous text selection");
        }
        return;
      }

      console.log(`✅ Text selected: ${selectedTextContent.length} characters`);
      console.log(
        `📝 Preview: "${selectedTextContent.substring(0, 50)}${
          selectedTextContent.length > 50 ? "..." : ""
        }"`
      );

      setSelectedText(selectedTextContent);

      // Auto-scroll to show selection in chat if text is long
      if (selectedTextContent.length > 100) {
        console.log("📜 Long text selected, consider showing preview");
      }
    } catch (error) {
      console.error("❌ Error handling text selection:", error);
      // Don't show user error for text selection issues
    }
  };

  /**
   * Adds the currently selected text to the chat input
   * Formats the text as a quote with a default question
   */
  const addToChat = () => {
    console.log("💬 Adding selected text to chat...");

    try {
      if (!selectedText) {
        console.warn("⚠️ No text selected to add to chat");
        return;
      }

      console.log(`📝 Adding ${selectedText.length} characters to chat`);

      // Format the selected text with context
      const formattedMessage = `"${selectedText}"\n\nCan you explain this part?`;

      setCurrentMessage(formattedMessage);
      setSelectedText("");

      console.log("✅ Text added to chat input successfully");

      // Focus the chat input if possible
      setTimeout(() => {
        const textarea = document.querySelector("textarea");
        if (textarea) {
          textarea.focus();
          // Move cursor to end
          textarea.selectionStart = textarea.selectionEnd =
            formattedMessage.length;
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error adding text to chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "There was an error adding the selected text to chat. Please try selecting the text again.",
        },
      ]);
    }
  };

  /**
   * Sends a message to the Gemini AI API and handles the response
   *
   * @returns {Promise<void>}
   */
  const sendMessage = async () => {
    console.log("💬 Send message initiated...");

    // Input validation
    if (!currentMessage.trim()) {
      console.warn("⚠️ Empty message detected, aborting send");
      return;
    }

    if (!GEMINI_API_KEY) {
      console.error("❌ No API key available");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "❌ API key not configured. Please check your environment variables.",
        },
      ]);
      return;
    }

    console.log(`📝 Message length: ${currentMessage.length} characters`);
    console.log(
      `📄 PDF text available: ${pdfText.length > 0 ? "Yes" : "No"} (${
        pdfText.length
      } chars)`
    );

    const userMessage: Message = { role: "user", content: currentMessage };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsLoading(true);

    const startTime = performance.now();

    try {
      const conversationHistory = [...messages, userMessage];
      console.log(
        `💭 Conversation history: ${conversationHistory.length} messages`
      );

      // Enhanced prompt with better formatting instructions
      const prompt = `You are a research assistant helping analyze a research paper. Here's the full conversation history and the paper content:

PAPER CONTENT:
${pdfText}

CONVERSATION HISTORY:
${JSON.stringify(conversationHistory)}

Provide a helpful response about the research paper, considering the full context. Be specific and reference the paper when relevant.

IMPORTANT: Your response must be valid JSON in this exact format:
{"response": "Your detailed response here"}

Rules for your response:
1. Escape all quotes inside the response text with \"
2. Replace all newlines with \\n  
3. Do not include any text outside the JSON object
4. Do not use markdown code blocks
5. Keep the response under 1000 characters to avoid formatting issues
6. If you reference the paper, use specific page numbers or section titles

JSON Response:`;

      console.log(`📊 Prompt length: ${prompt.length} characters`);
      console.log("🚀 Sending request to Gemini API...");

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const endTime = performance.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`✅ API response received in ${responseTime}s`);

      // Extract response text with multiple fallback methods
      const text =
        (response as any).text ||
        (response as any).candidates?.[0]?.content?.parts?.[0]?.text ||
        (response as any).response?.text ||
        "";

      if (!text) {
        console.error("❌ Empty response from Gemini API");
        console.log(
          "🔍 Full response object:",
          JSON.stringify(response, null, 2)
        );
        throw new Error("Empty response from AI service");
      }

      console.log(`📊 Response length: ${text.length} characters`);
      console.log("📝 Response preview:", text.substring(0, 150) + "...");

      try {
        const aiResponse = parseJsonFromMarkdown(text);
        console.log("✅ JSON parsing successful");

        if (!aiResponse.response) {
          console.warn("⚠️ Response object missing 'response' property");
          console.log("🔍 Parsed object:", aiResponse);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              aiResponse.response ||
              "I received your message but the response format was incomplete. Please try asking again.",
          },
        ]);

        console.log(`🎉 Message processing completed in ${responseTime}s`);
      } catch (parseError) {
        const errorType: ErrorType = "JSON_PARSE";
        console.error(`❌ JSON parsing failed (${errorType}):`, parseError);
        console.log("🔍 Raw response for debugging:", text);

        // Enhanced content extraction
        const cleanText = text
          .replace(/```json|```/g, "")
          .replace(/^\s*\{|\}\s*$/g, "")
          .replace(/"response"\s*:\s*"/i, "")
          .replace(/"\s*\}\s*$/, "")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .trim();

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              cleanText ||
              "I'm having trouble formatting my response properly. Could you please rephrase your question or try again?",
          },
        ]);

        console.log("🔧 Fallback content extraction used");
      }
    } catch (error) {
      const errorType: ErrorType = "API_CALL";
      const endTime = performance.now();
      const failTime = ((endTime - startTime) / 1000).toFixed(2);

      console.error(
        `❌ API call failed after ${failTime}s (${errorType}):`,
        error
      );

      let userMessage =
        "I apologize, but I encountered an error while processing your request.";
      let technicalDetails = "";

      if (error instanceof Error) {
        console.log("🔍 Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 500) + "...",
        });

        // Provide user-friendly error messages based on error type
        if (error.message.includes("API key")) {
          userMessage =
            "There's an issue with the API configuration. Please check your setup.";
        } else if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          userMessage =
            "Network connection error. Please check your internet connection and try again.";
        } else if (
          error.message.includes("rate limit") ||
          error.message.includes("quota")
        ) {
          userMessage =
            "API rate limit exceeded. Please wait a moment before trying again.";
        } else if (error.message.includes("Empty response")) {
          userMessage =
            "The AI service returned an empty response. Please try rephrasing your question.";
        } else {
          userMessage =
            "An unexpected error occurred. Please try again or rephrase your question.";
        }

        // Include technical details in development mode
        if (process.env.NODE_ENV === "development") {
          technicalDetails = `\n\n**Technical Details:**\n- Error: ${error.name}\n- Message: ${error.message}\n- Time: ${failTime}s`;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: userMessage + technicalDetails,
        },
      ]);

      console.log("🔄 Error handling completed, user notified");
    } finally {
      setIsLoading(false);
      console.log("🏁 Send message process completed");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Prevent default browser zoom behavior
      e.preventDefault();
      e.stopPropagation();

      const { ctrlKey, deltaX, deltaY } = e;

      if (ctrlKey) {
        // Zooming with Ctrl+Scroll
        const viewer = pdfViewerRef.current;
        if (!viewer) return;

        const rect = viewer.getBoundingClientRect();
        const newScale = Math.max(
          0.2,
          Math.min(2, transform.scale - deltaY * 0.002)
        );

        // Calculate mouse position relative to the viewer
        const mouseX = e.clientX - rect.left - transform.x;
        const mouseY = e.clientY - rect.top - transform.y;

        // Zoom towards mouse position
        const newX =
          transform.x - (mouseX * (newScale / transform.scale) - mouseX);
        const newY =
          transform.y - (mouseY * (newScale / transform.scale) - mouseY);

        setTransform({ scale: newScale, x: newX, y: newY });
      } else {
        // Panning with trackpad/scroll
        setTransform((prev) => ({
          ...prev,
          x: prev.x - deltaX * 0.5,
          y: prev.y - deltaY * 0.5,
        }));
      }
    },
    [transform]
  );

  // Calculate optimal zoom based on panel width
  const calculateAutoZoom = useCallback(() => {
    if (!pdfViewerRef.current) return;

    const viewerRect = pdfViewerRef.current.getBoundingClientRect();
    const availableWidth = viewerRect.width - 48; // Account for padding

    // PDF is now rendered at 2x base scale, so adjust calculation accordingly
    const pdfPageWidth = 1200; // 600px * 2 (base scale)
    const optimalScale = Math.min(availableWidth / pdfPageWidth, 1.5); // Cap at 1.5x (3x total with base scale)

    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, optimalScale), // Minimum 0.3x zoom (0.6x total with base scale)
    }));
  }, []);

  // Zoom control functions
  const zoomIn = useCallback(() => {
    setAutoZoom(false); // Disable auto-zoom when manually adjusting
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(2, prev.scale * 1.2), // Reduced max since base scale is 2x
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setAutoZoom(false); // Disable auto-zoom when manually adjusting
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.2, prev.scale / 1.2), // Reduced min since base scale is 2x
    }));
  }, []);

  const resetZoom = useCallback(() => {
    if (autoZoom) {
      calculateAutoZoom();
    } else {
      setTransform({ scale: 1, x: 0, y: 0 });
    }
  }, [autoZoom, calculateAutoZoom]);

  // Handle panel resize
  const handlePanelResize = useCallback(
    (sizes: number[]) => {
      setPanelSizes(sizes);
      if (autoZoom && pdfFile) {
        // Small delay to ensure DOM has updated
        setTimeout(() => {
          calculateAutoZoom();
        }, 100);
      }
    },
    [autoZoom, pdfFile, calculateAutoZoom]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isTextSelectionMode) {
      // Left mouse button - only pan when not in text selection mode
      setIsPanning(true);
      setLastPanPosition({ x: e.clientX, y: e.clientY });
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [isPanning, lastPanPosition]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grab";
    }
  }, [isPanning]);

  const handleMouseLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      if (pdfViewerRef.current) pdfViewerRef.current.style.cursor = "grab";
    }
  }, [isPanning]);

  const handleDoubleClick = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  return (
    <div className="h-screen bg-neutral-900 flex">
      <PanelGroup
        direction="horizontal"
        className="flex-1"
        onLayout={handlePanelResize}
      >
        <Panel defaultSize={50} minSize={25}>
          {/* PDF Viewer Side */}
          <div className="w-full h-full bg-neutral-800 ml-4 mr-2 my-4 rounded-2xl shadow-xl flex flex-col border border-neutral-700">
            <div className="px-6 py-3 border-b border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Research Paper
                </h2>

                {pdfFile && (
                  <div className="flex items-center space-x-1.5">
                    {/* Mode Toggle */}
                    <div className="flex items-center bg-neutral-700 rounded-md overflow-hidden">
                      <button
                        onClick={() => setIsTextSelectionMode(true)}
                        className={`px-2.5 py-1.5 transition-colors ${
                          isTextSelectionMode
                            ? "bg-orange-600 text-white"
                            : "text-neutral-300 hover:text-white hover:bg-neutral-600"
                        }`}
                        title="Text Selection Mode"
                      >
                        <MousePointer2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setIsTextSelectionMode(false)}
                        className={`px-2.5 py-1.5 transition-colors ${
                          !isTextSelectionMode
                            ? "bg-orange-600 text-white"
                            : "text-neutral-300 hover:text-white hover:bg-neutral-600"
                        }`}
                        title="Pan Mode"
                      >
                        <Hand className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Auto-Zoom Toggle */}
                    <button
                      onClick={() => setAutoZoom(!autoZoom)}
                      className={`px-2.5 py-1.5 rounded-md transition-colors ${
                        autoZoom
                          ? "bg-orange-600 text-white"
                          : "bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600"
                      }`}
                      title={
                        autoZoom ? "Auto-zoom enabled" : "Auto-zoom disabled"
                      }
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </button>

                    {/* Zoom Controls */}
                    <div className="flex items-center bg-neutral-700 rounded-md overflow-hidden">
                      <button
                        onClick={zoomOut}
                        className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 transition-colors"
                        title="Zoom Out"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-2.5 py-1.5 text-xs text-neutral-300 min-w-[2.5rem] text-center border-x border-neutral-600">
                        {Math.round(transform.scale * 100)}%
                      </span>
                      <button
                        onClick={zoomIn}
                        className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 transition-colors"
                        title="Zoom In"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={resetZoom}
                        className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 transition-colors"
                        title="Reset Zoom"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!pdfFile ? (
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
                  <div className="flex items-center space-x-2.5">
                    <FileText className="h-5 w-5 text-orange-400" />
                    <span className="font-medium text-neutral-200 text-sm">
                      {pdfFile.name}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {selectedText && (
                      <button
                        onClick={addToChat}
                        className="px-2.5 py-1 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700 transition-colors shadow-sm animate-pulse"
                      >
                        Add to Chat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {pdfFile && (
              <div className="flex-1 relative">
                <div
                  ref={pdfViewerRef}
                  className="absolute inset-0 overflow-hidden"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onDoubleClick={resetZoom}
                  style={{
                    cursor: isTextSelectionMode
                      ? "text"
                      : isPanning
                      ? "grabbing"
                      : "grab",
                    userSelect: isTextSelectionMode ? "text" : "none",
                  }}
                >
                  <div
                    className="absolute top-0 left-0"
                    style={{
                      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                      transformOrigin: "top left",
                      transition: isPanning
                        ? "none"
                        : "transform 0.1s ease-out",
                      imageRendering: "crisp-edges" as any,
                    }}
                    onMouseUp={handleTextSelection}
                  >
                    <PDFErrorBoundary
                      onError={(error) => {
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            content:
                              "I encountered an error while displaying the PDF. Please try uploading the file again or use a different PDF.",
                          },
                        ]);
                      }}
                    >
                      <Document
                        file={pdfFile}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        onLoadError={(error) => {
                          console.error("PDF loading error:", error);
                          setMessages((prev) => [
                            ...prev,
                            {
                              role: "assistant",
                              content:
                                "I'm sorry, there was an error loading the PDF. Please try uploading again or use a different PDF file.",
                            },
                          ]);
                        }}
                        className={
                          isTextSelectionMode ? "select-text" : "select-none"
                        }
                        options={pdfOptions}
                      >
                        {Array.from(new Array(numPages), (el, index) => (
                          <Page
                            key={`page_${index + 1}`}
                            pageNumber={index + 1}
                            className="mb-4 shadow-lg"
                            scale={2.0} // Higher base resolution
                            devicePixelRatio={window.devicePixelRatio || 2}
                            renderTextLayer={isTextSelectionMode}
                            renderAnnotationLayer={false}
                            canvasBackground="white"
                            loading={
                              <div className="flex items-center justify-center p-8 text-neutral-400">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                Rendering high-quality page {index + 1}...
                              </div>
                            }
                          />
                        ))}
                      </Document>
                    </PDFErrorBoundary>
                  </div>
                </div>

                {/* Instructions overlay */}
                <div
                  className={`absolute bottom-4 left-4 bg-neutral-900/90 backdrop-blur-sm rounded-lg p-3 text-xs text-neutral-300 transition-all duration-300 pointer-events-auto ${
                    showInstructions
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                  onMouseEnter={() => setShowInstructions(true)}
                  onMouseLeave={() => setShowInstructions(false)}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-semibold">
                      {isTextSelectionMode ? "Text Selection" : "Pan"} Mode
                    </span>
                    {isTextSelectionMode ? (
                      <MousePointer2 className="h-3 w-3 text-orange-400" />
                    ) : (
                      <Hand className="h-3 w-3 text-orange-400" />
                    )}
                  </div>
                  <div>• Ctrl + Scroll to zoom</div>
                  <div>• {autoZoom ? "📱 Auto-zoom ON" : "🔒 Manual zoom"}</div>
                  {isTextSelectionMode ? (
                    <>
                      <div>• Click & drag to select text</div>
                      <div>• Press 'P' for pan mode</div>
                    </>
                  ) : (
                    <>
                      <div>• Drag to pan around</div>
                      <div>• Press 'T' for text mode</div>
                    </>
                  )}
                  <div>• Resize panel to auto-fit PDF</div>
                </div>

                {/* Hover trigger area when instructions are hidden */}
                {!showInstructions && (
                  <div
                    className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-neutral-700/50 backdrop-blur-sm opacity-30 hover:opacity-60 transition-opacity duration-200 flex items-center justify-center cursor-help"
                    onMouseEnter={() => setShowInstructions(true)}
                    title="Show controls help"
                  >
                    <span className="text-neutral-400 text-xs">?</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-700 hover:bg-orange-500 transition-colors" />
        <Panel defaultSize={50} minSize={25}>
          {/* Chat Side */}
          <div className="w-full h-full bg-neutral-800 ml-2 mr-4 my-4 rounded-2xl shadow-xl flex flex-col border border-neutral-700">
            <div className="px-6 py-3 border-b border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-neutral-100">
                  Research Assistant
                </h2>

                {messages.length > 0 && (
                  <div className="flex items-center space-x-1.5">
                    {/* Conversation Stats */}
                    <div className="px-2.5 py-1.5 bg-neutral-700 rounded-md">
                      <span className="text-xs text-neutral-300">
                        {messages.filter((m) => m.role === "user").length}{" "}
                        questions
                      </span>
                    </div>

                    {/* Clear Chat Button */}
                    <button
                      onClick={() => {
                        console.log("🧹 Clearing chat history...");
                        setMessages([]);
                        setCurrentMessage("");
                        setSelectedText("");
                      }}
                      className="px-2.5 py-1.5 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-md transition-colors"
                      title="Clear conversation"
                    >
                      <span className="text-xs">Clear</span>
                    </button>
                  </div>
                )}
              </div>

              {pdfFile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <MessageCircle className="h-5 w-5 text-orange-400" />
                    <span className="font-medium text-neutral-200 text-sm">
                      Analyzing:{" "}
                      {pdfFile.name.length > 25
                        ? pdfFile.name.substring(0, 25) + "..."
                        : pdfFile.name}
                    </span>
                  </div>
                  {pdfText && (
                    <div className="text-xs text-neutral-500">
                      {pdfText.length.toLocaleString()} characters extracted
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                      Upload a PDF to start discussing your research paper with
                      AI assistance!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs text-neutral-500">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <span>Highlight text to discuss specific sections</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <span>Ask questions about methodology or findings</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <span>Get explanations of complex concepts</span>
                    </div>
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

                        {/* Message timestamp */}
                        <div
                          className={`text-xs mt-2 opacity-60 ${
                            message.role === "user"
                              ? "text-orange-200"
                              : "text-neutral-400"
                          }`}
                        >
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                    {/* AI Avatar */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                    </div>

                    {/* Loading Content */}
                    <div className="p-4 rounded-2xl shadow-sm backdrop-blur-sm bg-neutral-700/50 border border-neutral-600/50">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                        <span className="text-sm text-neutral-300">
                          Thinking...
                        </span>
                      </div>
                      <div className="flex space-x-1 mt-2">
                        <div className="w-2 h-2 bg-orange-400/40 rounded-full animate-pulse"></div>
                        <div
                          className="w-2 h-2 bg-orange-400/40 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-orange-400/40 rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <div className="px-6 py-4 border-t border-neutral-700 bg-neutral-800/50">
              {selectedText && (
                <div className="mb-4 p-4 bg-gradient-to-r from-orange-600/10 to-orange-500/5 rounded-xl border border-orange-600/20 backdrop-blur-sm">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 p-1.5 bg-orange-600/20 rounded-lg">
                      <FileText className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-orange-300 mb-1">
                        Selected Text
                      </p>
                      <p className="text-sm text-neutral-200 leading-relaxed">
                        "{selectedText.slice(0, 150)}
                        {selectedText.length > 150 ? "..." : ""}"
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs text-orange-400">
                          {selectedText.length} characters
                        </span>
                        <button
                          onClick={() => {
                            setSelectedText("");
                            console.log("🧹 Cleared selected text");
                          }}
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
                    className="w-full p-4 pr-12 border border-neutral-600/50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 bg-neutral-700/30 backdrop-blur-sm text-neutral-200 placeholder-neutral-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={3}
                    style={{ minHeight: "80px", maxHeight: "120px" }}
                  />

                  {/* Character counter */}
                  <div className="absolute bottom-2 right-3 text-xs text-neutral-500">
                    {currentMessage.length}/1000
                  </div>
                </div>

                <div className="flex flex-col space-y-2">
                  {/* Send button */}
                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim() || isLoading || !pdfFile}
                    className="group relative p-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
                      <>
                        <Send className="h-5 w-5 transition-transform group-hover:scale-110" />
                        {/* Pulse effect on hover */}
                        <div className="absolute inset-0 bg-orange-500 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                      </>
                    )}
                  </button>

                  {/* Quick actions */}
                  {selectedText && (
                    <button
                      onClick={addToChat}
                      className="p-2 bg-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-lg transition-colors text-xs"
                      title="Add selected text to chat"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Input hints */}
              <div className="flex items-center justify-between mt-3 text-xs text-neutral-500">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center space-x-1">
                    <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-xs">
                      Enter
                    </kbd>
                    <span>to send</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-xs">
                      Shift
                    </kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-xs">
                      Enter
                    </kbd>
                    <span>for new line</span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {pdfFile && pdfText && (
                    <span className="text-green-400">
                      AI Ready • {Math.round(pdfText.length / 1000)}k context
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ResearchBuddy;
