module.exports = {
  getMetaInformation: (issuingDate, did, path, usedZencode) => {
    const zencodeCompData = usedZencode
      ? {
          '@eId': 'mkeypairsw',
          '@href': 'create-keypair.zen',
          '@name': 'create-keypair.zen',
          '@showAs': 'create-keypair 1.0 Zencode Software',
        }
      : {};
    const information = {
      identityDate: issuingDate,
      did,
      FRBRWork: {},
      FRBRExpression: {},
      FRBRManifestation: {
        componentInfo: {
          componentData: [
            {
              '@eId': 'msoftware',
              '@href': 'IntelligibleIdentity1.0.1.hashdigest.json',
              '@name': 'IntelligibleIdentity1.0.1',
              '@showAs': 'IntelligibleIdentity 1.0.1 Software',
            },
            {
              '@eId': 'msmartcontract',
              '@href': 'IntelligibleIdentity.sol',
              '@name': 'IntelligibleIdentity',
              '@showAs': 'IntelligibleIdentity Smart Contract',
            },
            zencodeCompData,
          ],
        },
      },
      additionalBody: {},
    };

    const identityReferences = {
      iid: {
        entity: `${did}`,
        href: `${path.slice(0, -1)}.akn`,
      },
      iidDIDDoc: {
        entity: 'diddoc.json',
        href: `${path}diddoc.json`,
      },
      iidIssuer: {
        entity: `${did}`,
        href: `${path.slice(0, -1)}.akn`,
      },
      eidas: {
        entity: 'EU COM/2021/281 final',
        href: `/akn/eu/doc/2021-03-06/2021_281/eng@.akn`,
      },
      iidIssuerSoftware: {
        type: 'TLCObject',
        entity: 'IntelligibleIdentity1.0.1.hashdigest.json',
        href: `${path}IntelligibleIdentity1.0.1.hashdigest.json`,
      },
      nftSmartContract: {
        type: 'TLCObject',
        entity: 'IntelligibleIdentity.sol',
        href: `${path}IntelligibleIdentity.sol`,
      },
    };

    if (usedZencode) {
      identityReferences['zencodeSoftware'] = {
        type: 'TLCObject',
        entity: 'create-keypair.zen',
        href: `${path}create-keypair.zen`,
      };
    }

    return {
      information,
      identityReferences,
    };
  },
};
