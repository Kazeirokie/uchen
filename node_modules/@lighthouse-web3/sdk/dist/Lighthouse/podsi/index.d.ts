type Proof = {
    verifierData: {
        commPc: string;
        sizePc: string;
    };
    inclusionProof: {
        proofIndex: {
            index: string;
            path: string[];
        };
        proofSubtree: {
            index: string;
            path: string[];
        };
        indexRecord: {
            checksum: string;
            proofIndex: string;
            proofSubtree: number;
            size: number;
        };
    };
};
type DealInfo = {
    dealId: number;
    storageProvider: string;
    proof: Proof;
};
type PODSIData = {
    pieceCID: string;
    dealInfo: DealInfo[];
};
declare const _default: (cid: string) => Promise<{
    data: PODSIData;
}>;
export default _default;
