declare module 'pdf-parse/lib/pdf-parse.js' {
  type ParsedPdf = { numpages: number; text: string; info: Record<string, unknown>; metadata: unknown; version: string };
  function pdfParse(buffer: Buffer): Promise<ParsedPdf>;
  export = pdfParse;
}
