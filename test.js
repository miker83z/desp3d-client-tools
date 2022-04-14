const authapi = require('./index');
const poissonProcess = require('poisson-process');
const fs = require('fs');

const dirMain = 'outputDataset';
const tests_number = 3;
const cycles = 1;
const threshold = 3;
const nodes_number = 3;
const lambda = 1000; //ms

const plaintext = '0123456789';
const signatureData = 'ImBob';
let dirDate;
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
  num: 6,
  dir: '',
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
  //////////// Tests output files' setup
  if (!fs.existsSync(dirMain)) fs.mkdirSync(dirMain);
  const dirBobs = dirMain + '/' + bobs.num + '/';
  if (!fs.existsSync(dirBobs)) fs.mkdirSync(dirBobs);
  const dirThreshold = dirBobs + threshold + '/';
  if (!fs.existsSync(dirThreshold)) fs.mkdirSync(dirThreshold);
  dirDate = new Date().toISOString();
  const dir = dirThreshold + dirDate + '/';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  bobs.dir = dir;

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

    // Alice's kfrags for this Bob
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

    // File's setup
    const filepath = bobs.dir + 'bob-' + i + '.csv';
    fs.writeFile(
      filepath,
      'counter,start,storeDLT,storeKfrags,finish\n',
      (err) => {
        if (err) throw err;
      }
    );
  }
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms, false));
};

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
};

const singleBobGoesForAWalk = async (
  ibob,
  cycles,
  threshold,
  nodes_number,
  lambda
) => {
  for (let cycle = 0; cycle < cycles; cycle++) {
    let startTS = -1,
      storeDLTTS = -1,
      storeKfragsTS = -1,
      finishTS = -1;

    const promisesAlice = [];
    const promisesAliceTS = [];
    let promisesAliceErr = false;

    const promisesBob = [];
    const promisesBobTS = [];
    let promisesBobErr = false;

    const sleepingFor = poissonProcess.sample(lambda);
    console.log(
      'Bob',
      ibob,
      ', cycle',
      cycle,
      ', waiting for',
      sleepingFor,
      'ms'
    );
    await sleep(sleepingFor);

    try {
      //Start walking
      startTS = new Date().getTime();

      ///////////////////////////////////////////////////////////////////////
      //Alice stores bob's pk in the smart contract
      const randomNode = getRandomInt(0, nodes_number);
      /*
      const result = await authapi.storeDLT(
        nodes[randomNode].host,
        nodes[randomNode].port,
        {}
      );
      */
      await authapi.requestKeypair(alice.host, alice.port);
      storeDLTTS = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Alice stores bob's kfrags in each node
      for (let n = 0; n < nodes_number; n++) {
        /* TODO
        const result = await authapi.storeKfrags(
          nodes[n].host,
          nodes[n].port,
          {}
        );
        */
        promisesAlice.push(authapi.requestKeypair(alice.host, alice.port));
        // for testing promisesAlice.push(Promise.reject(new Error(2)));
      }
      await Promise.all(
        promisesAlice.map((promise) =>
          promise
            .then((res) => {
              if (res.status == 200) {
                promisesAliceTS.push(new Date().getTime());
              } else {
                promisesAliceTS.push(-1);
                promisesAliceErr = true;
              }
            })
            .catch((e) => {
              promisesAliceTS.push(-1);
              promisesAliceErr = true;
            })
        )
      );
      if (promisesAliceErr) {
        throw new Error('KFrags distribution error');
      }
      storeKfragsTS = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////////////////
      //Bob requests cfrags
      const chosenNodes = [];
      for (let k = 0; k < threshold; k++) {
        var randomNodeBob;
        do {
          randomNodeBob = getRandomInt(0, nodes_number);
        } while (chosenNodes.includes(randomNodeBob));
        chosenNodes.push(randomNodeBob);

        /* TODO
        const result = await authapi.getCfrags(
          nodes[randomNodeBob].host,
          nodes[randomNodeBob].port,
          {}
        );
        */
        promisesBob.push(authapi.requestKeypair(alice.host, alice.port));
        // for testing promisesBob.push(Promise.reject(new Error(2)));
      }
      await Promise.all(
        promisesBob.map((promise) =>
          promise
            .then((res) => {
              if (res.status == 200) {
                promisesBobTS.push(new Date().getTime());
              } else {
                promisesBobTS.push(-1);
                promisesBobErr = true;
              }
            })
            .catch((e) => {
              promisesBobTS.push(-1);
              promisesBobErr = true;
            })
        )
      );
      if (promisesBobErr) {
        throw new Error('KFrags distribution error');
      }
      finishTS = new Date().getTime();
      ///////////////////////////////////////////////////////////////////////
    } catch (error) {
      console.log('Test error: ', error);
    } finally {
      console.log(
        'Bob',
        ibob,
        'cycle',
        cycle,
        ', Results:',
        startTS,
        storeDLTTS,
        storeKfragsTS,
        promisesAliceTS,
        promisesBobTS,
        finishTS
      );
      const filepath = bobs.dir + 'bob-' + ibob + '.csv';
      fs.appendFile(
        filepath,
        cycle +
          ',' +
          startTS +
          ',' +
          storeDLTTS +
          ',' +
          storeKfragsTS +
          ',' +
          finishTS +
          '\n',
        (err) => {
          if (err) throw err;
        }
      );
    }
  }
};

const test = async (cycles, threshold, nodes_number, lambda) => {
  for (let i = 0; i < bobs.num; i++) {
    singleBobGoesForAWalk(i, cycles, threshold, nodes_number, lambda);
  }
};

const main = async () => {
  for (let i = 0; i < tests_number; i++) {
    console.log('Starting Test n.', i + 1);
    await sleep(2000);

    await preProcessing(plaintext, signatureData, threshold, nodes_number);
    console.log('Pre processing OK');

    await sleep(1000);
    await test(cycles, threshold, nodes_number, lambda);
    console.log('Finished Test n.', i + 1);
  }
};

main();
