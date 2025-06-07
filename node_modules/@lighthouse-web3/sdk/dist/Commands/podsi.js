"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kleur_1 = require("kleur");
const util_1 = require("../Lighthouse/utils/util");
const podsi_1 = __importDefault(require("../Lighthouse/podsi"));
async function default_1(cid, options) {
    if (JSON.stringify(cid) === '{}') {
        options.help();
    }
    else {
        try {
            if (!(0, util_1.isCID)(cid)) {
                throw new Error('Invalid CID');
            }
            const { data } = await (0, podsi_1.default)(cid);
            console.log((0, kleur_1.bold)().cyan('Piece Info:'));
            console.log((0, kleur_1.green)('Piece CID:'), data.pieceCID);
            console.log('\n' + (0, kleur_1.bold)().cyan('Proof Data:'));
            console.log('\n' + (0, kleur_1.bold)().cyan('Inclusion Proof:'));
            console.log((0, kleur_1.green)('Proof Index:'), data.dealInfo[0].proof.inclusionProof.proofIndex.index);
            console.log((0, kleur_1.green)('Proof Paths:'));
            data.dealInfo[0].proof.inclusionProof.proofIndex.path.forEach((path) => {
                console.log((0, kleur_1.yellow)('  -'), path);
            });
            console.log('\n' + (0, kleur_1.bold)().cyan('Proof Subtree:'));
            console.log((0, kleur_1.green)('Index:'), data.dealInfo[0].proof.inclusionProof.proofSubtree.index);
            console.log((0, kleur_1.green)('Paths:'));
            data.dealInfo[0].proof.inclusionProof.proofSubtree.path.forEach((path) => {
                console.log((0, kleur_1.yellow)('  -'), path);
            });
            console.log('\n' + (0, kleur_1.bold)().cyan('Deal Info:'));
            data.dealInfo.forEach((deal) => {
                console.log((0, kleur_1.green)('Deal ID:'), deal.dealId);
                console.log((0, kleur_1.green)('Storage Provider:'), deal.storageProvider);
            });
        }
        catch (error) {
            console.log((0, kleur_1.red)(error.message));
            process.exit(0);
        }
    }
}
exports.default = default_1;
