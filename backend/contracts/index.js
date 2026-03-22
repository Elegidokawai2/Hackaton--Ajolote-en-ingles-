// Punto de entrada central. Re-exporta todos los módulos de contratos y helpers.
const sorobanClient = require('./soroban.client');
const sorobanHelper = require('./soroban.helper');
const scvalHelpers = require('./scval.helpers');
const walletRegistryContract = require('./wallet-registry.contract');
const reputationContract = require('./reputation.contract');
const eventContract = require('./event.contract');
const projectContract = require('./project.contract');
module.exports = {
    // --- Cliente base ---
    server: sorobanClient.server,
    NETWORK_PASSPHRASE: sorobanClient.NETWORK_PASSPHRASE,
    CONTRACT_IDS: sorobanClient.CONTRACT_IDS,
    BASE_FEE: sorobanClient.BASE_FEE,
    // --- Helpers de transacciones ---
    invokeContract: sorobanHelper.invokeContract,
    queryContract: sorobanHelper.queryContract,
    // --- Conversores ScVal ---
    ...scvalHelpers,
    // --- WalletRegistry Contract ---
    registerUser: walletRegistryContract.registerUser,
    isActiveByWallet: walletRegistryContract.isActiveByWallet,
    getRoleByWallet: walletRegistryContract.getRoleByWallet,
    updateWallet: walletRegistryContract.updateWallet,
    deactivateUser: walletRegistryContract.deactivateUser,
    activateUser: walletRegistryContract.activateUser,
    // --- Reputation Contract ---
    initializeReputation: reputationContract.initializeReputation,
    addReputation: reputationContract.addReputation,
    removeReputation: reputationContract.removeReputation,
    getReputation: reputationContract.getReputation,
    isBanned: reputationContract.isBanned,
    shadowban: reputationContract.shadowban,
    unban: reputationContract.unban,
    // --- Event Contract ---
    initializeEvent: eventContract.initializeEvent,
    createEvent: eventContract.createEvent,
    applyToEvent: eventContract.applyToEvent,
    submitEntry: eventContract.submitEntry,
    selectWinners: eventContract.selectWinners,
    timeoutDistribute: eventContract.timeoutDistribute,
    getEvent: eventContract.getEvent,
    // --- Project Contract ---
    initializeProject: projectContract.initializeProject,
    createProject: projectContract.createProject,
    acceptProject: projectContract.acceptProject,
    submitDelivery: projectContract.submitDelivery,
    approveDelivery: projectContract.approveDelivery,
    requestCorrection: projectContract.requestCorrection,
    rejectDelivery: projectContract.rejectDelivery,
    resolveDispute: projectContract.resolveDispute,
    timeoutApprove: projectContract.timeoutApprove,
    timeoutRefund: projectContract.timeoutRefund,
    getProject: projectContract.getProject,
};