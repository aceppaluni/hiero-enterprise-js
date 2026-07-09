import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContractRepository } from "../../../src/repositories/ContractRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/MirrorNodeClient.js";

describe("ContractRepository", () => {
    let repo: ContractRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new ContractRepository(
            mockClient as unknown as MirrorNodeClient,
        );
    });

    it("forwards list to queryContracts", async () => {
        const spy = vi.spyOn(mockClient, "queryContracts");
        await repo.list({ contractId: "0.0.5001" });
        expect(spy).toHaveBeenCalledWith({ contractId: "0.0.5001" });
    });

    it("forwards findById to queryContract", async () => {
        const spy = vi.spyOn(mockClient, "queryContract");
        await repo.findById("0.0.5001", { timestamp: "1.0" });
        expect(spy).toHaveBeenCalledWith("0.0.5001", { timestamp: "1.0" });
    });

    it("forwards findResults to queryContractResults", async () => {
        const spy = vi.spyOn(mockClient, "queryContractResults");
        await repo.findResults("0.0.5001", { internal: true });
        expect(spy).toHaveBeenCalledWith("0.0.5001", { internal: true });
    });

    it("forwards listResults to queryAllContractResults", async () => {
        const spy = vi.spyOn(mockClient, "queryAllContractResults");
        await repo.listResults({ limit: 1 });
        expect(spy).toHaveBeenCalledWith({ limit: 1 });
    });

    it("forwards findResultByTimestamp to queryContractResultByTimestamp", async () => {
        const spy = vi.spyOn(mockClient, "queryContractResultByTimestamp");
        await repo.findResultByTimestamp("0.0.5001", "12.0");
        expect(spy).toHaveBeenCalledWith("0.0.5001", "12.0");
    });

    it("forwards findResult to queryContractResult", async () => {
        const spy = vi.spyOn(mockClient, "queryContractResult");
        await repo.findResult("0xfebbaa", { nonce: 1 });
        expect(spy).toHaveBeenCalledWith("0xfebbaa", { nonce: 1 });
    });

    it("forwards findActions to queryContractActions", async () => {
        const spy = vi.spyOn(mockClient, "queryContractActions");
        await repo.findActions("0xfebbaa", { limit: 5 });
        expect(spy).toHaveBeenCalledWith("0xfebbaa", { limit: 5 });
    });

    it("forwards findOpcodes to queryContractOpcodes", async () => {
        const spy = vi.spyOn(mockClient, "queryContractOpcodes");
        await repo.findOpcodes("0xfebbaa", { memory: true });
        expect(spy).toHaveBeenCalledWith("0xfebbaa", { memory: true });
    });

    it("forwards findState to queryContractState", async () => {
        const spy = vi.spyOn(mockClient, "queryContractState");
        await repo.findState("0.0.5001", { slot: "0x00fa" });
        expect(spy).toHaveBeenCalledWith("0.0.5001", { slot: "0x00fa" });
    });

    it("forwards findLogs to queryContractLogs", async () => {
        const spy = vi.spyOn(mockClient, "queryContractLogs");
        await repo.findLogs("0.0.5001", { topic0: "0xf475" });
        expect(spy).toHaveBeenCalledWith("0.0.5001", { topic0: "0xf475" });
    });

    it("forwards listLogs to queryAllContractLogs", async () => {
        const spy = vi.spyOn(mockClient, "queryAllContractLogs");
        await repo.listLogs({ transactionHash: "0x397022" });
        expect(spy).toHaveBeenCalledWith({ transactionHash: "0x397022" });
    });

    it("forwards call to queryContractCall", async () => {
        const spy = vi.spyOn(mockClient, "queryContractCall");
        await repo.call({ to: "0xd9d0", estimate: true });
        expect(spy).toHaveBeenCalledWith({ to: "0xd9d0", estimate: true });
    });
});
