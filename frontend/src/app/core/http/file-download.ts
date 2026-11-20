const safeCsvFileName = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}\.csv$/i;

export function csvFileNameFromContentDisposition(header: string | null, fallbackFileName: string): string {
  if (!header) {
    return fallbackFileName;
  }

  const encodedMatch = /filename\*\s*=\s*(?:UTF-8'[^']*')?([^;]+)/i.exec(header);
  const plainMatch = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  let candidate = encodedMatch?.[1] ?? plainMatch?.[2] ?? plainMatch?.[1] ?? '';

  try {
    candidate = encodedMatch ? decodeURIComponent(candidate) : candidate;
  } catch {
    return fallbackFileName;
  }

  candidate = candidate.trim().replace(/^"|"$/g, '');
  return safeCsvFileName.test(candidate) && !candidate.includes('..') ? candidate : fallbackFileName;
}

export function downloadBlob(document: Document, blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl));
  }
}
