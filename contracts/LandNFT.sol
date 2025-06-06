// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// You still need ERC721URIStorage from OpenZeppelin
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract LandNFT is ERC721URIStorage {
    // A simple uint256 counter instead of using Counters.Counter
    uint256 private _nextTokenId = 0;

    // The government’s address (initial owner)
    address public govAddress;

    // Emitted when a Buyer calls purchaseLand
    event LandPurchased(uint256 indexed tokenId, address indexed buyer);

    modifier onlyGov() {
        require(msg.sender == govAddress, "Only gov can call");
        _;
    }

    constructor() ERC721("LandNFT", "LAND") {
        govAddress = msg.sender;
    }

    /**
     * @dev Gov calls this to mint a new Land token whose URI is an encrypted CID.
     * @param _cid  The IPFS CID (e.g. "Qm...")
     */
    function mintLand(string calldata _cid) external onlyGov returns (uint256) {
        uint256 currentId = _nextTokenId;
        _safeMint(govAddress, currentId);
        _setTokenURI(currentId, _cid);
        _nextTokenId += 1;
        return currentId;
    }

    /**
     * @dev Buyer calls this to “purchase” the land. We just transfer from gov → buyer.
     * Emits LandPurchased(tokenId, msg.sender).
     */
    function purchaseLand(uint256 tokenId) external {
        require(ownerOf(tokenId) == govAddress, "Not owned by gov anymore");
        _transfer(govAddress, msg.sender, tokenId);
        emit LandPurchased(tokenId, msg.sender);
    }

    /**
     * @dev Gov’s off‐chain script calls this AFTER sale to set the new encrypted CID (for Buyer).
     * Only Gov (owner of private key) can re-encrypt off‐chain and then update on‐chain.
     */
    function updateTokenURI(uint256 tokenId, string calldata newCid) external onlyGov {
        _setTokenURI(tokenId, newCid);
    }
}
