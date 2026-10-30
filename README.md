# QKYC

QKYC is a live production post quantum customer onboarding and identity verification record tool for banks and identity companies on the Quantova network. It proves the open, assessment, screening, refresh and close of a know your customer case, and it lets any third party confirm that history without trusting the party that created it.

QKYC proves records without disclosing them. Customer identities, documents and case detail stay private on the systems of the party that holds them. Only a salted cryptographic commitment is written to the chain, and no personal detail is ever published. A customer is named only by a chain address.

## What it records

Each record is a signed envelope of one of five types.

1. open, an officer opens a case under a programme for a named customer.
2. assess, the officer records the assurance level and result of the identity assessment.
3. screen, the officer records the outcome of a sanctions and watch list screening.
4. refresh, the officer records a periodic review of the case.
5. close, the officer closes the case and states why.

Every record is signed with ML-DSA-65 under FIPS 204 by the officer of the institution, and each later record links to the one before it so the whole life of a case forms a chain.

## Proving the time

A record on its own carries only the claim of its signer. Anchoring a record on the Quantova network through Qstamp adds a post quantum evidence anchor that fixes the latest moment the record existed, provable against the record and the signer by anyone, without claiming a regulated timestamp status that Quantova Inc does not hold.

## Install

```
npm install @quantovainc/qkyc
```

## Use

```js
const qkyc = require('@quantovainc/qkyc');

const officer = qkyc.generateKey();
const customer = qkyc.generateKey();
const kyc = qkyc.open({
  key: officer,
  programme: 'individual',
  caseNo: 'KYC 2026 0001',
  subject: qkyc.keyId(customer),
  officerLabel: 'Onboarding Desk',
});

const anchored = await qkyc.anchor(kyc, { seed, index: 0, network: 'testnet' });
const result = await qkyc.verify(anchored[0], { type: 'open', network: 'testnet' });
```

## What a record does not establish

1. It does not show that the stated facts are true. It shows only that the signer stated them and that the statement existed unchanged at a point in time.
2. It does not identify a natural or legal person. The customer and the officer are chain addresses, and linking an address to a person is a separate attestation held off the chain.
3. The labels are text written by the signer, they are not a verified identity.

## License

Apache-2.0 OR MIT
