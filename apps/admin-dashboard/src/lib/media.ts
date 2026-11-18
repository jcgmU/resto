export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
  return `${base}${url}`;
}
