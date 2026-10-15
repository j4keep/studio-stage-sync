/** Extract readable text from an attached document in the browser, before it reaches YAJ. */
const MAX_CHARS = 60000;

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|log|rtf|yaml|yml)$/i;

export const YAJ_DOC_ACCEPT =
  ".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log,.yaml,.yml,application/pdf,text/*,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isSupportedYajDocument(file: File): boolean {
  return /\.(pdf|docx)$/i.test(file.name) || TEXT_EXT.test(file.name) ||
    file.type === "application/pdf" || file.type.startsWith("text/") || file.type === "application/json";
}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];
  let total = 0;
  for (let i = 1; i <= doc.numPages && total < MAX_CHARS; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
    pages.push(`[Page ${i}] ${text}`);
    total += text.length;
  }
  return pages.join("\n\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")).default as {
    extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value;
}

export async function extractYajDocumentText(file: File): Promise<{ text: string; truncated: boolean }> {
  let text = "";
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    text = await pdfText(await file.arrayBuffer());
  } else if (/\.docx$/i.test(file.name)) {
    text = await docxText(await file.arrayBuffer());
  } else if (/\.doc$/i.test(file.name)) {
    throw new Error("Old .doc files can't be read. Save it as .docx or PDF and try again.");
  } else {
    text = await file.text();
  }
  text = text.trim();
  if (!text) {
    throw new Error("No readable text was found in this file (it may be a scanned image). Try a photo of it instead.");
  }
  return { text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}
