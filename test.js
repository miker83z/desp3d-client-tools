const authapi = require('./index');

const plaintext = '0123456789';
const signatureData = 'ImBob';
let alice = {
  host: 'http://127.0.0.1',
  port: 8022,
  keypair: {},
  signer: {},
  ciphertext: '',
  capsule: {},
};

let bobs = {
  host: 'http://127.0.0.1',
  port: 8022,
  num: 3,
  keypair: [],
  signer: [],
  signature: [],
  kfrags: [],
};

let nodes = [
  {
    host: 'http://127.0.0.1',
    port: 8022,
  },
  {
    host: 'http://127.0.0.1',
    port: 8022,
  },
  {
    host: 'http://127.0.0.1',
    port: 8022,
  },
];

const preProcessing = async (
  plaintext,
  signatureData,
  threshold,
  nodes_number
) => {
  //////////// Alice's setup
  alice.keypair = (await authapi.requestKeypair(alice.host, alice.port)).data;
  alice.signer = (await authapi.requestSigner(alice.host, alice.port)).data;
  // Get and send Capsule
  const { ciphertext, capsule } = (
    await authapi.encrypt(alice.host, alice.port, {
      plaintext,
      pk: alice.keypair.pk,
    })
  ).data;
  alice.ciphertext = ciphertext;
  alice.capsule = capsule;
  // TODO

  //////////// Bobs' setup
  for (let i = 0; i < bobs.num; i++) {
    // Single bob setup
    bobs.keypair.push(
      (await authapi.requestKeypair(bobs.host, bobs.port)).data
    );
    bobs.signer.push((await authapi.requestSigner(bobs.host, bobs.port)).data);
    // This Bob signs
    const { signature } = (
      await authapi.sign(bobs.host, bobs.port, {
        signer: bobs.signer[i],
        data: signatureData,
      })
    ).data;
    bobs.signature.push(signature);
    //Alice's kfrags for this Bob
    const { kfrags } = (
      await authapi.generateKfrags(alice.host, alice.port, {
        sender: alice.keypair,
        signer: alice.signer,
        receiver: bobs.keypair[i].pk,
        threshold,
        nodes_number,
      })
    ).data;
    bobs.kfrags.push(kfrags);
  }
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms, false));
};

const singleBobGoesForAWalk = async (ibob, cycles, threshold, nodes_number) => {
  for (let cicle = 0; cicle < cycles; cicle++) {
    console.log('Cycle ', cicle, ', waiting Bob ', ibob, ' for ', 1000, 'ms');
    await sleep(1000); //TODO random sleeping (Poisson?)

    let startTS = -1,
      storeDLTTS = -1,
      storeKfragsTS = -1,
      finishTS = -1;

    ///////////////Start walking
    startTS = new Date().getTime();
    //Alice stores bob's pk in the smart contract
    const randomNode = 0; //TODO get random num for choosing node
    const result = await authapi.storeDLT(
      nodes[randomNode].host,
      nodes[randomNode].port,
      {}
    );
    storeDLTTS = new Date().getTime();
    //Alice stores bob's kfrags in each node
    //TODO asynchronous for
    for (let n = 0; n < nodes_number; n++) {
      const result = await authapi.storeKfrags(
        nodes[n].host,
        nodes[n].port,
        {}
      );
    }
    storeKfragsTS = new Date().getTime();
    //Bob requests cfrags
    for (let k = 0; k < threshold; k++) {
      const randomNode = 0; //TODO get random num (without repetition) for choosing node
      const result = await authapi.getCfrags(
        nodes[randomNode].host,
        nodes[randomNode].port,
        {}
      );
    }
    //await sleep(5000);
    finishTS = new Date().getTime();

    //TODO print in a file
  }

  console.log(ibob, ') Mira, un perro!');
};

const test = async (cycles, threshold, nodes_number) => {
  for (let i = 0; i < bobs.num; i++) {
    singleBobGoesForAWalk(i, cycles, threshold, nodes_number);
    console.log(bobs.keypair[i].pk);
  }
};

const main = async () => {
  await preProcessing(plaintext, signatureData, 3, 3);
  console.log('Pre processing OK');

  await sleep(1000);

  test(2, 3, 3);
};

main();
