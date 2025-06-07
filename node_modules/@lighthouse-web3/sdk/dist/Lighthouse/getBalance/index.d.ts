export type balanceResponse = {
    data: {
        dataLimit: number;
        dataUsed: number;
    };
};
declare const _default: (apiKey: string) => Promise<balanceResponse>;
export default _default;
