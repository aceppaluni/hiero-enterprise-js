import { describe, it, expect } from "vitest";
import {
    createMirrorRepositories,
    MIRROR_REPOSITORY_TOKENS,
} from "../../../src/repositories/factory.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";

describe("createMirrorRepositories", () => {
    const client = createMockMirrorNodeClient() as unknown as MirrorNodeClient;

    it("constructs one of every repository", () => {
        const byKey = new Map(Object.entries(createMirrorRepositories(client)));
        for (const [Repository, key] of MIRROR_REPOSITORY_TOKENS) {
            expect(byKey.get(key)).toBeInstanceOf(Repository);
        }
    });

    it("token list covers exactly the factory's properties", () => {
        const factoryKeys = Object.keys(createMirrorRepositories(client));
        const tokenKeys = MIRROR_REPOSITORY_TOKENS.map(([, key]) => key);
        expect([...tokenKeys].sort()).toEqual([...factoryKeys].sort());
    });
});
