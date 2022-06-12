const HDWalletProvider = require('@truffle/hdwallet-provider');
const { AuthService } = require('./lib/auth');
const { BrokerService } = require('./lib/broker');
const { Web3Wrapper, artifact } = require('./lib/web3Wrapper');
const { publicKeyCreate } = require('secp256k1');
const { Identity } = require('./lib/identity');
const { Policy } = require('./lib/policy');
const tokenArtifact = require('./lib/templates/contracts/NFToken.json');
const contractArtifact = require('./lib/templates/contracts/Contract.json');
const {
  PolicyContractWrapper,
  PolicyNFTWrapper,
} = require('dlt-policy-manager');
const fs = require('fs');

const dltNetworkIdDefault = '5778';

const MNEMONIC = process.env.MNEMONIC;

const test = async () => {
  const host = 'http://127.0.0.1';
  const port = 8022;
  const auth = new AuthService(host, port);

  const plaintext = 'Hello World!';

  const alice = (await auth.requestKeypair()).data;
  const signer = (await auth.requestSigner()).data;
  const bob = (await auth.requestKeypair()).data;

  const { ciphertext, capsule } = (
    await auth.encrypt({
      plaintext,
      pk: alice.pk,
    })
  ).data;

  const { kfrags } = (
    await auth.generateKfrags({
      sender: alice,
      signer,
      receiver: bob.pk,
      threshold: 2,
      nodes_number: 3,
    })
  ).data;

  const { cfrag: cfrag1 } = (
    await auth.reencrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[0],
    })
  ).data;
  const cfrags = [cfrag1];

  const { cfrag: cfrag2 } = (
    await auth.reencrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob.pk,
      capsule,
      kfrag: kfrags[1],
    })
  ).data;
  cfrags.push(cfrag2);

  const { plaintext: dPlaintext } = (
    await auth.decrypt({
      sender: alice.pk,
      signer: signer.pk,
      receiver: bob,
      capsule,
      ciphertext,
      cfrags,
    })
  ).data;

  console.log(dPlaintext);
};

const testSignature = async () => {
  const host = 'http://127.0.0.1';
  const port = 8022;
  const auth = new AuthService(host, port);

  const data = 'Hello World 2';
  const signer = (await auth.requestSigner()).data;

  const { signature } = (
    await auth.sign({
      signer,
      data,
    })
  ).data;

  const { verified } = (
    await auth.verify({
      signature,
      data,
      pk: signer.pk,
    })
  ).data;

  console.log('Signature verified: ' + verified);
};

const testContracts = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  try {
    const deployer = new Web3Wrapper(provider);
    const accounts = await deployer.web3.eth.getAccounts();
    const owner = accounts[0];
    const alice = accounts[1];
    const bob = accounts[2];

    ///////////////////////////// Setup
    //DataOwnerContract
    const docOwner = await deployer.deployDataOwnerContract(owner);
    const docAlice = await deployer.deployDataOwnerContract(alice);
    const docBob = await deployer.deployDataOwnerContract(bob);

    console.log(docOwner.address, docAlice.address, docBob.address);

    //should grant access to alice and bob
    const dataId = deployer.web3.utils.utf8ToHex('dataId1');
    const res3 = await docOwner.grantAccess([alice, bob], dataId);
    const res4 = await docOwner.checkPermissions(alice, dataId);
    //should grant access to alice after a request
    const res5 = await docOwner.requestAccess([alice], dataId, reasons, alice);
    const reqId = res5.events.NewRequest.returnValues.requestId;
    const res6 = await docOwner.grantAccessRequest(reqId);
    // should revoke access to alice
    const res7 = await docOwner.revokeAccess([alice], dataId);
  } catch (error) {
    console.log(error);
  } finally {
    provider.engine.stop();
  }
};

const testBroker = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  try {
    const host = 'http://127.0.0.1';
    const auth = new AuthService(host, 8024);
    const broker = new BrokerService(host, 3164);
    const deployer = new Web3Wrapper(provider);

    //const accounts = await deployer.web3.eth.getAccounts();
    //console.log(provider.wallets[accounts[0]].getPrivateKeyString().slice(2));
    const accounts = Object.keys(provider.wallets);
    ////////////// Owner
    const aggregator = accounts[0];
    const aggregatorSkUint8 = new Uint8Array(
      provider.wallets[aggregator].privateKey
    );
    const aggregatorPkUint8 = publicKeyCreate(aggregatorSkUint8, true);
    const aggregatorKeypair = {
      pk: Array.from(aggregatorPkUint8),
      sk: Array.from(aggregatorSkUint8),
    };
    const { pk: aggregatorSignerPkUint8, sk: aggregatorSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const aggregatorSignerKeypair = {
      pk: Array.from(aggregatorSignerPkUint8),
      sk: Array.from(aggregatorSignerSkUint8),
    };
    const aggregatorSigner = deployer.web3.eth.accounts.privateKeyToAccount(
      '0x' + Buffer.from(aggregatorSignerSkUint8).toString('hex')
    ).address;
    ////////////// Alice
    const doAlice = accounts[1];
    const doAliceSkUint8 = new Uint8Array(provider.wallets[doAlice].privateKey);
    const doAlicePkUint8 = publicKeyCreate(doAliceSkUint8, true);
    const doAliceKeypair = {
      pk: Array.from(doAlicePkUint8),
      sk: Array.from(doAliceSkUint8),
    };
    const { pk: doAliceSignerPkUint8, sk: doAliceSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const doAliceSignerKeypair = {
      pk: Array.from(doAliceSignerPkUint8),
      sk: Array.from(doAliceSignerSkUint8),
    };
    ////////////// Bob
    const doBob = accounts[2];
    const doBobSkUint8 = new Uint8Array(provider.wallets[doBob].privateKey);
    const doBobPkUint8 = publicKeyCreate(doBobSkUint8, true);
    const doBobKeypair = {
      pk: Array.from(doBobPkUint8),
      sk: Array.from(doBobSkUint8),
    };
    const { pk: doBobSignerPkUint8, sk: doBobSignerSkUint8 } = (
      await auth.requestSigner()
    ).data;
    const doBobSignerKeypair = {
      pk: Array.from(doBobSignerPkUint8),
      sk: Array.from(doBobSignerSkUint8),
    };

    ///////////////////////////// Setup
    //DataOwnerContract
    const docOwner = await deployer.deployDataOwnerContract(aggregator);
    const docAlice = await deployer.deployDataOwnerContract(doAlice);
    const docBob = await deployer.deployDataOwnerContract(doBob);

    ///////////////////////////////////////////////////

    ///////////////////// Operations
    //aggregator should request access to doAlice and doBob
    const dataIdAlice = deployer.web3.utils.utf8ToHex('dataIdAlice');
    const dataIdBob = deployer.web3.utils.utf8ToHex('dataIdBob');

    /*const res8 = await agg.methods
      .requestAccessToData(
        [dataIdAlice, dataIdBob],
        [docAlice.address, docBob.address],
        [aggregatorSigner],
        reasons,
        parameters
      )
      .send({
        from: aggregator,
      });*/
    const res8 = await docAlice.requestAccess(
      [aggregatorSigner],
      dataIdAlice,
      reasons,
      aggregator
    );
    const reqIdAlice = res8.events.NewRequest.returnValues.requestId;
    const res85 = await docBob.requestAccess(
      [aggregatorSigner],
      dataIdBob,
      reasons,
      aggregator
    );
    const reqIdBob = res85.events.NewRequest.returnValues.requestId;
    //const reqIdAlice = res8.events.NewAggregation.returnValues.requestIds[0];
    //const reqIdBob = res8.events.NewAggregation.returnValues.requestIds[1];
    await docAlice.grantAccessRequest(reqIdAlice);
    await docBob.grantAccessRequest(reqIdBob);

    const plaintext = 'Hello World!';

    const { ciphertext, capsule } = (
      await auth.encrypt({
        plaintext,
        pk: doAliceKeypair.pk,
      })
    ).data;

    const { kfrags } = (
      await auth.generateKfrags({
        sender: doAliceKeypair,
        signer: doAliceSignerKeypair,
        receiver: aggregatorKeypair.pk,
        threshold: 1,
        nodes_number: 4,
      })
    ).data;

    await broker.storeCapsule({
      sender: doAliceKeypair.pk,
      dataId: 'dataIdAlice',
      capsule,
    });

    await broker.storeKFrag({
      sender: doAliceKeypair.pk,
      receiver: aggregatorKeypair.pk,
      kfrag: kfrags[0],
    });

    await broker.generateCFrag({
      sender: doAliceKeypair.pk,
      signer: doAliceSignerKeypair.pk,
      dataId: 'dataIdAlice',
      receiver: aggregatorKeypair.pk,
    });

    const dataToSign = 'sign this pls';

    const { signature } = (
      await auth.sign({
        signer: aggregatorSignerKeypair,
        data: dataToSign,
      })
    ).data;

    const cfrag1 = (
      await broker.getCFrag({
        address: docAlice.address,
        dataId: 'dataIdAlice',
        sender: doAliceKeypair.pk,
        signer: aggregatorSignerKeypair.pk,
        signature,
        receiver: aggregatorKeypair.pk,
      })
    ).data;

    const cfrags = [cfrag1.result];

    const { plaintext: dPlaintext } = (
      await auth.decrypt({
        sender: doAliceKeypair.pk,
        signer: doAliceSignerKeypair.pk,
        receiver: aggregatorKeypair,
        capsule,
        ciphertext,
        cfrags,
      })
    ).data;

    console.log(dPlaintext);
  } catch (error) {
    console.log(error);
  } finally {
    provider.engine.stop();
  }
};

const testIID = async () => {
  const provider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  const deployer = new Web3Wrapper(provider);

  const iid = new Identity();
  //await iid.createKeypairFromZenroom();
  await iid.createKeypairFromMnemonic(MNEMONIC, 0);
  await iid.createKeyDid();
  iid.setWeb3Provider();

  await deployer.sendEther(
    provider.getAddress(0),
    iid.web3Provider.getAddress(0),
    200000000000000000
  );

  await iid.simpleNewIdentity();

  const address = iid.web3Provider.addresses[0];
  const nftDid = await iid.iid.getNFTdid();

  const iid2 = new Identity();
  iid2.setWeb3Provider('http://127.0.0.1:8545');
  await iid2.fromAddress(address);

  const iid3 = new Identity();
  iid3.setWeb3Provider('http://127.0.0.1:8545');
  await iid3.fromNFTdid(nftDid);

  console.log(await iid3.iid.getNFTdid());

  provider.engine.stop();
  iid.web3Provider.engine.stop();
};

const testPolicy = async () => {
  const policyMaker = new Policy();
  const consent = fs.readFileSync(`./lib/templates/policies/consent1.ttl`, {
    encoding: 'utf8',
    flag: 'r',
  });
  const co = policyMaker.getContractualObjectsFromMCO(consent).contracts[0];
  const scs = policyMaker.getSmartContractSpecification(co);
  const bindings = {
    'http://mpeg.org/Catullo': '0x8023C91eF291328e7bD34f5419103c23aCc0C1f8',
    'http://mpeg.org/Susy': '0x699367D18694bb754A12B0AdF98351aC2A1ceD03',
    'http://mpeg.org/Pippo': '0xD1B1838499C42aD04756D4124204263244445AE8',
  };
  const scAddr = await policyMaker.deploySmartContract(scs, bindings);
  console.log(scAddr);
  const parsed = await policyMaker.parseSmartContract(scAddr);

  const tmp = new PolicyNFTWrapper(
    undefined,
    dltNetworkIdDefault,
    tokenArtifact
  );

  console.log(await tmp.ownerOf(13));
};

const testMainIIDMCO = async () => {
  const mainProvider = new HDWalletProvider(MNEMONIC, 'http://127.0.0.1:8545');
  const deployer = new Web3Wrapper(mainProvider);

  // catullo
  const catullo = new Identity();
  await catullo.createKeypairFromZenroom();
  await catullo.createKeyDid();
  catullo.setWeb3Provider();
  await deployer.sendEther(
    mainProvider.getAddress(0),
    catullo.web3Provider.getAddress(0),
    200000000000000000
  );
  await catullo.simpleNewIdentity();
  const catulloNFTdid = await catullo.iid.getNFTdid();
  const catulloAddr = await catullo.web3Provider.getAddress(0);

  // susy
  const susy = new Identity();
  await susy.createKeypairFromZenroom();
  await susy.createKeyDid();
  susy.setWeb3Provider();
  await deployer.sendEther(
    mainProvider.getAddress(0),
    susy.web3Provider.getAddress(0),
    200000000000000000
  );
  await susy.simpleNewIdentity();
  const susyNFTdid = await susy.iid.getNFTdid();
  const susyAddr = await susy.web3Provider.getAddress(0);

  // pippo
  const pippo = new Identity();
  await pippo.createKeypairFromZenroom();
  await pippo.createKeyDid();
  pippo.setWeb3Provider();
  await deployer.sendEther(
    mainProvider.getAddress(0),
    pippo.web3Provider.getAddress(0),
    200000000000000000
  );
  await pippo.simpleNewIdentity();
  const pippoNFTdid = await pippo.iid.getNFTdid();
  const pippoAddr = await pippo.web3Provider.getAddress(0);

  // bindings
  const bindings = {
    [catulloNFTdid]: catulloAddr,
    [susyNFTdid]: susyAddr,
    [pippoNFTdid]: pippoAddr,
  };

  console.log(catullo.iid.web3.uri);
  console.log(bindings);

  mainProvider.engine.stop();
  catullo.web3Provider.engine.stop();
  susy.web3Provider.engine.stop();
  pippo.web3Provider.engine.stop();
};

const main = async () => {
  try {
    //await test();
    //await testSignature();
    //await testContracts();
    //await testBroker();
    //await testIID();
    //await testPolicy();
    await testMainIIDMCO();
  } catch (error) {
    console.log(error);
  }
};

main();
