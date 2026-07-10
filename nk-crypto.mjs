// NK CRC32 + XOR encrypt/decrypt for BTDB profile.save

export function nkCRC32(message) {
  const POLY = BigInt(-613349823);
  const MASK8  = 0xFFn;
  const MASK24 = 0xFFFFFFn;
  const MASK32 = 0xFFFFFFFFn;
  let crc = 0n;
  for (let i = 0; i < message.length; i++) {
    let data = BigInt(message[i] ^ Number(crc)) & MASK8;
    for (let j = 0; j < 8; j++) {
      if (data & 1n) data ^= POLY;
      data >>= 1n;
    }
    crc = ((crc >> 8n) & MASK24) ^ data;
  }
  return Number(crc & MASK32);
}

export function xorOffset(index) {
  return Math.floor(index / 6) * 6 - (index & 0xFF) - 21;
}

export function nkDecrypt(data) {
  const headerBytes = data.slice(0, 6);
  const header = String.fromCharCode(...headerBytes);
  if (header !== "DGDATA") return null;

  const crcBytes = data.slice(6, 14);
  const expectedCRC = String.fromCharCode(...crcBytes).toLowerCase();
  const payload = new Uint8Array(data.slice(14));
  for (let i = 0; i < payload.length; i++) {
    payload[i] = (payload[i] + xorOffset(i) + 256) % 256;
  }

  const actualCRC = nkCRC32(payload).toString(16).toLowerCase().padStart(8, '0');
  if (expectedCRC !== actualCRC) return null;

  return new TextDecoder("ascii", { fatal: false }).decode(payload);
}

export function nkEncrypt(jsonStr) {
  const encoder = new TextEncoder();
  let payload = new Uint8Array(encoder.encode(jsonStr));
  const crcHex = nkCRC32(payload).toString(16).toLowerCase().padStart(8, '0');

  for (let i = 0; i < payload.length; i++) {
    payload[i] = (payload[i] - xorOffset(i) + 256) % 256;
  }

  const header = new Uint8Array(14);
  header[0] = 0x44; header[1] = 0x47; header[2] = 0x44;
  header[3] = 0x41; header[4] = 0x54; header[5] = 0x41;
  const crcBytes = new TextEncoder().encode(crcHex);
  header[6] = crcBytes[0]; header[7] = crcBytes[1];
  header[8] = crcBytes[2]; header[9] = crcBytes[3];
  header[10] = crcBytes[4]; header[11] = crcBytes[5];
  header[12] = crcBytes[6]; header[13] = crcBytes[7];

  const result = new Uint8Array(header.length + payload.length);
  result.set(header, 0);
  result.set(payload, 14);
  return result;
}
