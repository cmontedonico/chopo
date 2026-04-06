"use node";

import { extractText, getDocumentProxy } from "unpdf";

export type PdfExtractionResult = {
  text: string;
  pages: number;
  error?: string;
};

const EMPTY_PDF_ERROR = "PDF vacío";
const UNREADABLE_PDF_ERROR = "No se pudo leer el PDF";
const PASSWORD_PROTECTED_PDF_ERROR = "PDF protegido con contraseña";

function toErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return UNREADABLE_PDF_ERROR;
  }

  const message = error.message.toLowerCase();

  if (message.includes("password")) {
    return PASSWORD_PROTECTED_PDF_ERROR;
  }

  return UNREADABLE_PDF_ERROR;
}

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<PdfExtractionResult> {
  if (buffer.byteLength === 0) {
    return {
      text: "",
      pages: 0,
      error: EMPTY_PDF_ERROR,
    };
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    await pdf.destroy();

    const extractedText = Array.isArray(text) ? text.join("\n\n") : text;

    if (!extractedText.trim()) {
      return {
        text: "",
        pages: totalPages,
        error: EMPTY_PDF_ERROR,
      };
    }

    return {
      text: extractedText,
      pages: totalPages,
    };
  } catch (error) {
    return {
      text: "",
      pages: 0,
      error: toErrorMessage(error),
    };
  }
}
