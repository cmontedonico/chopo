const FALLBACK_METADATA_BASE_URL = "http://localhost:4000";

function normalizeMetadataBaseUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim();

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (/^(localhost|127(?:\.\d{1,3}){3})(?::\d+)?(?:\/.*)?$/i.test(trimmedUrl)) {
    return `http://${trimmedUrl}`;
  }

  return `https://${trimmedUrl}`;
}

export function createMetadataBase(rawUrl?: string | null) {
  const normalizedUrl = rawUrl?.trim()
    ? normalizeMetadataBaseUrl(rawUrl)
    : FALLBACK_METADATA_BASE_URL;

  try {
    return new URL(normalizedUrl);
  } catch {
    return new URL(FALLBACK_METADATA_BASE_URL);
  }
}
