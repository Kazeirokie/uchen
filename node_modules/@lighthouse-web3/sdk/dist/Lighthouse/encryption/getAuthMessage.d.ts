export type authMessageResponse = {
    data: {
        message: string | null;
    };
};
declare const _default: (publicKey: string) => Promise<authMessageResponse>;
export default _default;
