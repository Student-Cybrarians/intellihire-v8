import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 30_000;

export type ResumeDocumentType = "pdf" | "doc" | "docx" | "text" | "rtf" | "html";

export type ResumeParseResult = {
  text: string;
  documentType: ResumeDocumentType;
  truncated: boolean;
};

export class ResumeParseError extends Error {
  code: "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" | "INVALID_FILE" | "NO_TEXT" | "PARSE_FAILED";

  constructor(message: string, code: ResumeParseError["code"]) {
    super(message);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

function extensionOf(name: string): string {
  const normalized = name.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot + 1) : "";
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function detectType(file: File, buffer: Buffer): ResumeDocumentType {
  const extension = extensionOf(file.name);
  const mime = file.type.toLowerCase();

  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  if (startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) return "docx";

  if (extension === "pdf" || mime === "application/pdf") return "pdf";
  if (extension === "doc" || mime === "application/msword") return "doc";
  if (extension === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (extension === "rtf" || mime === "application/rtf" || mime === "text/rtf") return "rtf";
  if (extension === "html" || extension === "htm" || mime === "text/html") return "html";
  if (["txt", "md", "markdown", "csv", "json"].includes(extension) || mime.startsWith("text/")) return "text";

  throw new ResumeParseError(
    "Unsupported resume format. Upload PDF, DOC, DOCX, TXT, RTF, HTML, Markdown, CSV, or JSON.",
    "UNSUPPORTED_TYPE",
  );
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0))
    .join("\n")
    .trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripRtf(value: string): string {
  return value
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractWord(buffer: Buffer): Promise<string> {
  const WordExtractor = require("word-extractor") as new () => {
    extract(input: Buffer): Promise<{
      getBody(): string;
      getFooters(): string;
      getTextboxes(options?: { includeHeadersAndFooters?: boolean; includeBody?: boolean }): string;
    }>;
  };

  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return [document.getBody(), document.getFooters(), document.getTextboxes({ includeHeadersAndFooters: true, includeBody: false })]
    .filter(Boolean)
    .join("\n");
}

export async function parseResumeFile(file: File): Promise<ResumeParseResult> {
  if (file.size <= 0) throw new ResumeParseError("The uploaded file is empty.", "INVALID_FILE");
  if (file.size > MAX_RESUME_BYTES) throw new ResumeParseError("Resume files must be 8 MB or smaller.", "FILE_TOO_LARGE");

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentType = detectType(file, buffer);

  try {
    let extracted: string;
    switch (documentType) {
      case "pdf": extracted = await extractPdf(buffer); break;
      case "doc":
      case "docx": extracted = await extractWord(buffer); break;
      case "rtf": extracted = stripRtf(buffer.toString("utf8")); break;
      case "html": extracted = stripHtml(buffer.toString("utf8")); break;
      case "text": extracted = buffer.toString("utf8"); break;
    }

    const text = normalizeText(extracted);
    if (text.length < 20) {
      throw new ResumeParseError(
        "The file was opened, but no readable resume text was found. If this is a scanned PDF/image, paste the text or provide a text-based PDF/DOC/DOCX.",
        "NO_TEXT",
      );
    }

    const truncated = text.length > MAX_EXTRACTED_CHARS;
    return { text: truncated ? text.slice(0, MAX_EXTRACTED_CHARS).trimEnd() : text, documentType, truncated };
  } catch (error) {
    if (error instanceof ResumeParseError) throw error;
    throw new ResumeParseError(
      `Could not extract text from this ${documentType.toUpperCase()} file. Please try another copy or paste the resume text manually.`,
      "PARSE_FAILED",
    );
  }
}

export const resumeParserLimits = { maxBytes: MAX_RESUME_BYTES, maxCharacters: MAX_EXTRACTED_CHARS };
