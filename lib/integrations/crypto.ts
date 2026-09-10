const encoder = new TextEncoder();
const decoder = new TextDecoder();
const base64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
const unbase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
async function key(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function sealWithSecret(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(secret),
    encoder.encode(value),
  );
  return JSON.stringify({
    v: 1,
    iv: base64(iv),
    data: base64(new Uint8Array(ciphertext)),
  });
}

export async function openWithSecret(payload: string, secret: string) {
  const sealed = JSON.parse(payload) as {
    v: number;
    iv: string;
    data: string;
  };
  if (sealed.v !== 1 || !sealed.iv || !sealed.data)
    throw new Error('Unsupported encrypted value');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unbase64(sealed.iv) },
    await key(secret),
    unbase64(sealed.data),
  );
  return decoder.decode(plaintext);
}
