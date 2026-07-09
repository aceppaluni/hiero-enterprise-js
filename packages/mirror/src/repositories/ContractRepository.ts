import type {
    MirrorContract,
    MirrorContractDetail,
    ContractResult,
    ContractResultDetails,
    ContractLog,
    ContractStateEntry,
    ContractAction,
    OpcodeTrace,
    ContractCallRequest,
    ContractCallResult,
    ContractsQuery,
    ContractQuery,
    ContractResultsQuery,
    ContractResultQuery,
    ContractStateQuery,
    ContractLogsQuery,
    ContractActionsQuery,
    OpcodesQuery,
    Page,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for the EVM read surface — contracts, execution results,
 * event logs, storage, call traces, and read-only contract calls — the
 * read-side counterpart of core's `ContractService`.
 */
export class ContractRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /** List contract entities on the network. */
    list(options?: ContractsQuery): Promise<Page<MirrorContract>> {
        return this.mirrorNodeClient.queryContracts(options);
    }

    /**
     * Look up one contract — including its bytecode — by entity ID or EVM
     * address.
     */
    findById(
        contractIdOrAddress: string,
        options?: ContractQuery,
    ): Promise<MirrorContractDetail> {
        return this.mirrorNodeClient.queryContract(
            contractIdOrAddress,
            options,
        );
    }

    /** List one contract's function execution results. */
    findResults(
        contractIdOrAddress: string,
        options?: ContractResultsQuery,
    ): Promise<Page<ContractResult>> {
        return this.mirrorNodeClient.queryContractResults(
            contractIdOrAddress,
            options,
        );
    }

    /** List function execution results across all contracts. */
    listResults(options?: ContractResultsQuery): Promise<Page<ContractResult>> {
        return this.mirrorNodeClient.queryAllContractResults(options);
    }

    /**
     * The detailed result — logs and state changes — of the execution a
     * contract ran at a given consensus timestamp.
     */
    findResultByTimestamp(
        contractIdOrAddress: string,
        timestamp: string,
    ): Promise<ContractResultDetails> {
        return this.mirrorNodeClient.queryContractResultByTimestamp(
            contractIdOrAddress,
            timestamp,
        );
    }

    /**
     * The detailed result of an execution, by transaction ID or ethereum
     * transaction hash.
     */
    findResult(
        transactionIdOrHash: string,
        options?: ContractResultQuery,
    ): Promise<ContractResultDetails> {
        return this.mirrorNodeClient.queryContractResult(
            transactionIdOrHash,
            options,
        );
    }

    /** The call frames (internal calls) of an execution. */
    findActions(
        transactionIdOrHash: string,
        options?: ContractActionsQuery,
    ): Promise<Page<ContractAction>> {
        return this.mirrorNodeClient.queryContractActions(
            transactionIdOrHash,
            options,
        );
    }

    /**
     * Re-execute a transaction and return its full opcode trace (slow —
     * the EVM replays the transaction).
     */
    findOpcodes(
        transactionIdOrHash: string,
        options?: OpcodesQuery,
    ): Promise<OpcodeTrace> {
        return this.mirrorNodeClient.queryContractOpcodes(
            transactionIdOrHash,
            options,
        );
    }

    /** A contract's storage slots — current, or as of a point in time. */
    findState(
        contractIdOrAddress: string,
        options?: ContractStateQuery,
    ): Promise<Page<ContractStateEntry>> {
        return this.mirrorNodeClient.queryContractState(
            contractIdOrAddress,
            options,
        );
    }

    /** Search one contract's event logs. */
    findLogs(
        contractIdOrAddress: string,
        options?: ContractLogsQuery,
    ): Promise<Page<ContractLog>> {
        return this.mirrorNodeClient.queryContractLogs(
            contractIdOrAddress,
            options,
        );
    }

    /** Search event logs across all contracts. */
    listLogs(options?: ContractLogsQuery): Promise<Page<ContractLog>> {
        return this.mirrorNodeClient.queryAllContractLogs(options);
    }

    /**
     * Execute a read-only contract call, estimate gas, or simulate a
     * read-write operation without submitting a transaction.
     */
    call(request: ContractCallRequest): Promise<ContractCallResult> {
        return this.mirrorNodeClient.queryContractCall(request);
    }
}
