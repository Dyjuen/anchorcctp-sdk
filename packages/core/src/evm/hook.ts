import { StrKey } from '@stellar/stellar-sdk';

export function contractStrkeyToBytes32(strkey: string): `0x${string}` {
  if (!StrKey.isValidContract(strkey)) {
    throw new Error(`Invalid contract strkey: ${strkey}`);
  }
  return `0x${Buffer.from(StrKey.decodeContract(strkey)).toString('hex')}`;
}

export function buildCctpForwarderHookData(forwardRecipientStrkey: string): `0x${string}` {
  const isValid =
    StrKey.isValidEd25519PublicKey(forwardRecipientStrkey) ||
    StrKey.isValidContract(forwardRecipientStrkey) ||
    StrKey.isValidMed25519PublicKey(forwardRecipientStrkey);

  if (!isValid) {
    throw new Error(`Invalid forward recipient: ${forwardRecipientStrkey}`);
  }

  const payload = Buffer.from(forwardRecipientStrkey, 'utf8');
  const buf = Buffer.alloc(32 + payload.length);
  buf.writeUInt32BE(0, 24);
  buf.writeUInt32BE(payload.length, 28);
  payload.copy(buf, 32);

  return `0x${buf.toString('hex')}`;
}
