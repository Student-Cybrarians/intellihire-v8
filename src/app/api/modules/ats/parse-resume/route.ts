import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { parseResumeFile, ResumeParseError, resumeParserLimits } from "@/lib/modules/ats/resumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const noStore = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) {
      return json({ error: "AUTH_REQUIRED", message: "Please sign in before uploading a resume." }, 401);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return json({ error: "INVALID_CONTENT_TYPE", message: "Upload the resume as multipart/form-data." }, 415);
    }

    const form = await request.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) {
      return json({ error: "FILE_REQUIRED", message: "Choose a resume file to upload." }, 400);
    }

    if (entry.size > resumeParserLimits.maxBytes) {
      return json({ error: "FILE_TOO_LARGE", message: "Resume files must be 8 MB or smaller." }, 413);
    }

    try {
      const parsed = await parseResumeFile(entry);
      return json({
        text: parsed.text,
        documentType: parsed.documentType,
        truncated: parsed.truncated,
        characterLimit: resumeParserLimits.maxCharacters,
      });
    } catch (error) {
      if (error instanceof ResumeParseError) {
        const status = error.code === "FILE_TOO_LARGE" ? 413 : error.code === "UNSUPPORTED_TYPE" ? 415 : 422;
        return json({ error: error.code, message: error.message }, status);
      }
      throw error;
    }
  } catch (error) {
    console.error("[module-1] resume parsing request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "RESUME_PARSE_FAILED", message: "The resume could not be processed. Please try another file." }, 500);
  }
}
