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

  if (StrKey.isValidEd25519PublicKey(forwardRecipientStrkey)) {
    return `0x${Buffer.from(StrKey.decodeEd25519PublicKey(forwardRecipientStrkey)).toString('hex')}`;
  }
  return `0x${Buffer.from(StrKey.decodeContract(forwardRecipientStrkey)).toString('hex')}`;
}
