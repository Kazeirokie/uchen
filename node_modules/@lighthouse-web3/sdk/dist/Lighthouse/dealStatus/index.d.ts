type dealData = {
    chainDealID: number;
    endEpoch: number;
    publishCID: string;
    storageProvider: string;
    dealStatus: string;
    bundleId: string;
    dealUUID: string;
    startEpoch: number;
    aggregateIn: string;
    providerCollateral: string;
    pieceCID: string;
    payloadCid: string;
    pieceSize: number;
    carFileSize: number;
    lastUpdate: number;
    dealId: number;
    miner: string;
    content: number;
};
export type dealResponse = {
    data: dealData[];
};
declare const _default: (cid: string) => Promise<dealResponse>;
export default _default;
