"use node";

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

  let parser:
    | {
        getText: () => Promise<{ text: string; total: number }>;
        destroy?: () => Promise<void>;
      }
    | undefined;

  try {
    const { PDFParse } = (await import("pdf-parse")) as {
      PDFParse: new (options: { data: Uint8Array }) => {
        getText: () => Promise<{ text: string; total: number }>;
        destroy: () => Promise<void>;
      };
    };
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();

    return {
      text: result.text,
      pages: result.total,
    };
  } catch (error) {
    return {
      text: "",
      pages: 0,
      error: toErrorMessage(error),
    };
  } finally {
    await parser?.destroy?.();
  }
}
