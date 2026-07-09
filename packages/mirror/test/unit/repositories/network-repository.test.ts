import { describe, it, expect, beforeEach, vi } from "vitest";
import { NetworkRepository } from "../../../src/repositories/NetworkRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/MirrorNodeClient.js";

describe("NetworkRepository", () => {
    let repo: NetworkRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new NetworkRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findExchangeRates to queryExchangeRates", async () => {
        const spy = vi.spyOn(mockClient, "queryExchangeRates");
        await repo.findExchangeRates();
        expect(spy).toHaveBeenCalled();
    });

    it("delegates findNetworkSupplies to queryNetworkSupplies", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkSupplies");
        await repo.findNetworkSupplies();
        expect(spy).toHaveBeenCalled();
    });

    it("forwards a historical timestamp to queryNetworkSupplies", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkSupplies");
        const options = { timestamp: "1700000000.000000000" };
        await repo.findNetworkSupplies(options);
        expect(spy).toHaveBeenCalledWith(options);
    });

    it("delegates findStakingRewards to queryNetworkStake", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkStake");
        await repo.findStakingRewards();
        expect(spy).toHaveBeenCalled();
    });

    it("forwards findNodes to queryNetworkNodes with page controls", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkNodes");
        await repo.findNodes({ limit: 10 });
        expect(spy).toHaveBeenCalledWith({ limit: 10 });
    });
    it("forwards findFees to queryNetworkFees", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkFees");
        await repo.findFees({ timestamp: "1.0" });
        expect(spy).toHaveBeenCalledWith({ timestamp: "1.0" });
    });
    it("forwards estimateFees to queryFeeEstimate", async () => {
        const spy = vi.spyOn(mockClient, "queryFeeEstimate");
        const bytes = new Uint8Array([1, 2, 3]);
        await repo.estimateFees(bytes, { mode: "INTRINSIC" });
        expect(spy).toHaveBeenCalledWith(bytes, { mode: "INTRINSIC" });
    });
    it("forwards findRegisteredNodes to queryRegisteredNodes", async () => {
        const spy = vi.spyOn(mockClient, "queryRegisteredNodes");
        await repo.findRegisteredNodes({ registeredNodeId: 1 });
        expect(spy).toHaveBeenCalledWith({ registeredNodeId: 1 });
    });
});
