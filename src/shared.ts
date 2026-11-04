export function safeName(value: string): string {
  return value.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'untitled';
}
export function imageExtension(bytes: Uint8Array): string {
  if (bytes[0] === 137 && bytes[1] === 80) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216) return 'jpg';
  if (bytes[0] === 82 && bytes[8] === 87) return 'webp';
  if (bytes[0] === 71 && bytes[1] === 73) return 'gif';
  return 'bin';
}
