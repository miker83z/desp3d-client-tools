const fs = require('fs');
const {
  IntelligibleIdentity,
  KeyDid,
  Zenroom,
} = require('intelligible-identity');
const { IPFSWrapper } = require('intelligible-storage-ipfs');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const secp256k1 = require('secp256k1');
const { getMetaInformation } = require('./templates/metaInformation');

const web3ProviderURLDefault = 'http://127.0.0.1:8545';
const dltNetworkIdDefault = '5778';
const ipfsProviderDefault = {
  host: '127.0.0.1',
  port: '5001',
  protocol: 'http',
};
const filePathsDefault = {
  iidIssuerSoftware: '/templates/IntelligibleIdentity1.0.1.hashdigest.json',
  zencodeSoftware: '/templates/zencode/create-keypair.zen',
  nftSmartContract: '/templates/contracts/IntelligibleIdentity.json',
};

class Identity {
  constructor(web3ProviderURL, ipfsProvider, filePathsDict, dltNetworkId) {
    this.web3ProviderURL =
      web3ProviderURL === undefined ? web3ProviderURLDefault : web3ProviderURL;
    this.ipfsProvider =
      ipfsProvider === undefined ? ipfsProviderDefault : ipfsProvider;
    this.filePaths =
      filePathsDict === undefined ? filePathsDefault : filePathsDict;
    this.dltNetworkId =
      dltNetworkId === undefined ? dltNetworkIdDefault : dltNetworkId;

    this.keypair = {};
    this.web3Provider = {};

    this.path = {};
    this.usedZencode = false;
    this.keyDid = {};

    this.iid = {};
    this.information = {};
    this.identityReferences = {};
  }

  async createKeypairFromZenroom(zencodePath) {
    const z = new Zenroom(zencodePath);
    this.keypair = await z.createKeypair();
    this.usedZencode = true;
  }

  createKeypairFromMnemonic(mnemonic, addressIndex) {
    if (mnemonic === undefined) {
      throw new Error('IntelligibleIdentity: mnemonic not set');
    }
    if (addressIndex === undefined) {
      addressIndex = 0;
    }
    const provider = new HDWalletProvider(mnemonic, this.web3ProviderURL);

    const accounts = Object.keys(provider.wallets);
    const publicKeyProvider = new Uint8Array(65);
    publicKeyProvider.set([4]);
    publicKeyProvider.set(
      Uint8Array.from(provider.wallets[accounts[addressIndex]].publicKey),
      1
    );
    const privateKeyProvider = Uint8Array.from(
      provider.wallets[accounts[addressIndex]].privateKey
    );
    this.keypair = {
      publicKey: secp256k1.publicKeyConvert(publicKeyProvider),
      privateKey: privateKeyProvider,
    };
    provider.engine.stop();
  }

  async createKeyDid() {
    this.keyDid = await new KeyDid(this.keypair).createDIDDocument();
  }

  setWeb3Provider(provider) {
    if (this.keypair.privateKey === undefined) {
      if (provider === undefined) {
        throw new Error('IntelligibleIdentity: keypair and provider not set');
      }
      this.web3Provider = provider;
    } else {
      this.web3Provider = new HDWalletProvider(
        '0x' + Buffer.from(this.keypair.privateKey).toString('hex'),
        this.web3ProviderURL
      );
    }
  }

  async simpleNewIdentity() {
    if (this.keypair.privateKey === undefined) {
      throw new Error('IntelligibleIdentity: keypair not set');
    }
    if (Object.keys(this.web3Provider).length === 0) {
      throw new Error('IntelligibleIdentity: web3Provider not set');
    }
    if (Object.keys(this.keyDid).length === 0) {
      throw new Error('IntelligibleIdentity: keyDid not set');
    }
    // Setup
    const todayDate = new Date().toISOString().slice(0, 10);
    const did = this.keyDid.didDocument.id;
    const path = `/akn/eu/doc/${todayDate}/${did}/eng@/`;
    const { information, identityReferences } = getMetaInformation(
      todayDate,
      did,
      path,
      this.usedZencode
    );
    this.information = information;
    this.identityReferences = identityReferences;
    // Start iid
    this.iid = new IntelligibleIdentity();
    // Reserve NFT id
    await this.iid.prepareNewIdentityWeb3(
      this.web3Provider,
      0,
      undefined,
      this.dltNetworkId
    );
    // Get CIDs for referenced files
    const ipfs = new IPFSWrapper(this.ipfsProvider);
    const files = await this.setupFilesForAKN(
      this.identityReferences,
      ipfs,
      this.filePaths
    );
    // Create main.xml and save it
    this.iid.newIdentityMeta(this.information, this.identityReferences);
    const res = await this.getFileCID(
      ipfs,
      'main.xml',
      this.iid.meta.finalize()
    );
    files.push(res.file);
    // Sign the .akn package and store the signature
    await this.iid.signIdentity(false, res.cid);
    const res2 = await this.getFileCID(
      ipfs,
      'signature.xml',
      this.iid.signature.finalize()
    );
    files.push(res2.file);
    // Store the end result in IPFS
    const resFinal = await ipfs.storeIPFSDirectory(path, files);
    // Store the reference in IPFS
    const nftCid = `${resFinal.slice(-1)[0].cid.toString()}${path}main.xml`;
    // Store into the NFT
    await this.iid.finalizeNewIdentityWeb3(nftCid);

    return this.iid;
  }

  async getFileCID(ipfs, path, content) {
    const file = { path, content };
    const cidRes = await ipfs.getCIDs(path, [file]);
    const cid = cidRes.slice(-1)[0].cid.toString();
    return { file, cid };
  }

  async setupFilesForAKN(identityReferences, ipfs, filePaths) {
    const files = [];
    for (let i = 0; i < Object.keys(identityReferences).length; i++) {
      const key = Object.keys(identityReferences)[i];
      if (
        key === 'iidDIDDoc' ||
        key === 'iidIssuerSoftware' ||
        key === 'nftSmartContract' ||
        (key === 'zencodeSoftware' && this.usedZencode)
      ) {
        let res;
        switch (key) {
          case 'iidDIDDoc':
            res = await this.getFileCID(
              ipfs,
              identityReferences[key].entity,
              JSON.stringify(this.keyDid.didDocument)
            );
            break;
          case 'iidIssuerSoftware':
            res = await this.getFileCID(
              ipfs,
              identityReferences[key].entity,
              fs.readFileSync(`${__dirname}${filePaths['iidIssuerSoftware']}`, {
                encoding: 'utf8',
                flag: 'r',
              })
            );
            break;
          case 'nftSmartContract':
            res = await this.getFileCID(
              ipfs,
              identityReferences[key].entity,
              fs.readFileSync(`${__dirname}${filePaths['nftSmartContract']}`, {
                encoding: 'utf8',
                flag: 'r',
              })
            );
            break;
          case 'zencodeSoftware':
            res = await this.getFileCID(
              ipfs,
              identityReferences[key].entity,
              fs.readFileSync(`${__dirname}${filePaths['zencodeSoftware']}`, {
                encoding: 'utf8',
                flag: 'r',
              })
            );
            break;
          default:
            break;
        }
        identityReferences[
          key
        ].href = `${res.cid}${identityReferences[key].href}`;
        files.push(res.file);
      }
    }
    return files;
  }

  async fromNFTcid(nftCid) {
    if (Object.keys(this.iid).length === 0) {
      this.iid = new IntelligibleIdentity();
    }
    // Gets the identity document from IPFS
    const ipfs = new IPFSWrapper(this.ipfsProvider);
    const resGet = await ipfs.getIPFSFile(nftCid);
    this.iid.fromStringMeta(resGet);
    // Get the signature document and save it
    const signCid = nftCid.split('/').slice(0, -1).join('/') + '/signature.xml';
    const signGet = await ipfs.getIPFSFile(signCid);
    this.iid.fromStringSignature(signGet);

    //console.log(this.iid.meta.finalize());
    //set class attributes
    this.information = this.iid.information;
    this.identityReferences = this.iid.references;
    this.usedZencode = Object.keys(this.identityReferences).includes(
      'zencodeSoftware'
    );
    this.path = this.information.FRBRWork.FRBRuri['@value'];
    this.keyDid = JSON.parse(
      await ipfs.getIPFSFile(
        nftCid.split('/').slice(0, -1).join('/') + '/diddoc.json'
      )
    );
  }

  async fromNFTdid(nftDid) {
    if (Object.keys(this.web3Provider).length === 0) {
      throw new Error('IntelligibleIdentity: web3Provider not set');
    }
    // Start iid
    this.iid = new IntelligibleIdentity();
    // Get metadata from NFT
    // Obtain the identity from the web3 address
    // (gets the last token in the contract list)
    const nftCid = await this.iid.fromNFTdid(
      this.web3Provider,
      0,
      nftDid,
      this.dltNetworkId
    );

    await this.fromNFTcid(nftCid);
  }

  async fromAddress(address) {
    if (Object.keys(this.web3Provider).length === 0) {
      throw new Error('IntelligibleIdentity: web3Provider not set');
    }
    // Start iid
    this.iid = new IntelligibleIdentity();
    // Get metadata from NFT
    // Obtain the identity from the web3 address
    // (gets the last token in the contract list)
    const nftCid = await this.iid.fromWeb3Address(
      this.web3Provider,
      0,
      address,
      this.dltNetworkId
    );

    await this.fromNFTcid(nftCid);
  }
}

module.exports = { Identity };
