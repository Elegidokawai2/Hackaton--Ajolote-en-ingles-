// scval.helpers.js
// Conversores de tipos nativos JS a xdr.ScVal para contratos Soroban.

const { Address, nativeToScVal, xdr } = require('@stellar/stellar-sdk');

// Address (reclutador, freelancer, admin, etc.)
const toAddress = (pubkey) => new Address(pubkey).toScVal();

// u64 (event_id, project_id, deadline, timestamps)
const toU64 = (n) => nativeToScVal(BigInt(n), { type: 'u64' });

// i128 (prize, amount, guarantee)
const toI128 = (n) => nativeToScVal(BigInt(n), { type: 'i128' });

// u32 (correction_count, delta de reputación)
const toU32 = (n) => nativeToScVal(n, { type: 'u32' });

// Symbol (category)
const toSymbol = (str) => xdr.ScVal.scvSymbol(str);

// BytesN<32> (entry_hash, delivery_hash)
const toBytes32 = (hexString) => {
  const bytes = Buffer.from(hexString, 'hex');
  if (bytes.length !== 32) throw new Error('Hash must be 32 bytes');
  return xdr.ScVal.scvBytes(bytes);
};

// bool (favor_freelancer)
const toBool = (b) => xdr.ScVal.scvBool(b);

// Vec<Address> (winners)
const toAddressVec = (pubkeys) =>
  xdr.ScVal.scvVec(pubkeys.map(pk => new Address(pk).toScVal()));

module.exports = { toAddress, toU64, toI128, toU32, toSymbol, toBytes32, toBool, toAddressVec };
