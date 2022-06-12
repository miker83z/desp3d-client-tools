const { getContractFromMCO } = require('mco-policy-parser');
const {
  generateSmartContractSpecification,
  OffChainStorage,
  EthereumDeployer,
  EthereumParser,
} = require('dlt-policy-manager');

const web3ProviderURLDefault = 'http://127.0.0.1:8545';
const dltNetworkIdDefault = '5778';
const ipfsProviderDefault = {
  host: '127.0.0.1',
  port: '5001',
  protocol: 'http',
};
const tokenArtifactDefault = require('./templates/contracts/NFToken.json');
const contractArtifactDefault = require('./templates/contracts/Contract.json');

class Policy {
  constructor(
    web3Provider,
    ipfsProvider,
    dltNetworkId,
    tokenArtifact,
    contractArtifact,
    verbose
  ) {
    this.verbose = verbose;
    this.web3Provider =
      web3Provider === undefined ? web3ProviderURLDefault : web3Provider;
    this.ipfs = new OffChainStorage(
      ipfsProvider === undefined ? ipfsProviderDefault : ipfsProvider,
      this.verbose
    );
    this.dltNetworkId =
      dltNetworkId === undefined ? dltNetworkIdDefault : dltNetworkId;
    this.tokenArtifact =
      tokenArtifact === undefined ? tokenArtifactDefault : tokenArtifact;
    this.contractArtifact =
      contractArtifact === undefined
        ? contractArtifactDefault
        : contractArtifact;

    this.deployedContracts = [];
  }

  getContractualObjectsFromMCO(turtleText) {
    return getContractFromMCO(turtleText);
  }

  getSmartContractSpecification(contractualObjects) {
    return generateSmartContractSpecification(contractualObjects);
  }

  async deploySmartContract(smartContractSpecification, bindings) {
    const deployer = new EthereumDeployer(
      this.web3Provider,
      this.ipfs,
      smartContractSpecification,
      bindings,
      this.dltNetworkId,
      this.tokenArtifact,
      this.verbose
    );
    await deployer.setMainAddress(0); //TODO check
    const res = await deployer.deploySmartContracts();
    this.deployedContracts.push(res);
    return res.options.address;
  }

  async parseSmartContract(smartContractAddress) {
    const parser = new EthereumParser(
      this.web3Provider,
      this.ipfs,
      smartContractAddress,
      this.dltNetworkId,
      this.contractArtifact,
      this.tokenArtifact,
      this.verbose
    );
    return await parser.parseSmartContract();
  }
}

module.exports = {
  Policy,
};
