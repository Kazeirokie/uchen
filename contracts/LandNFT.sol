// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract LandNFT is ERC721Enumerable, ERC721URIStorage {
    uint256 private _nextTokenId;
    address public govAddress;

    event LandPurchased(uint256 indexed tokenId, address indexed buyer);

    modifier onlyGov() {
        require(msg.sender == govAddress, "Only gov can call");
        _;
    }

    constructor() ERC721("LandNFT", "LAND") {
        govAddress   = msg.sender;
        _nextTokenId = 0;
    }

    /// @notice Gov mints a new Land token whose URI is an encrypted CID
    function mintLand(string calldata cid) external returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _safeMint(govAddress, tokenId);
        _setTokenURI(tokenId, cid);
        _nextTokenId++;
        return tokenId;
    }

    /// @notice Buyer “purchases” the land (gov → buyer)
    function purchaseLand(uint256 tokenId) external {
        require(ownerOf(tokenId) == govAddress, "Not owned by gov");
        _transfer(govAddress, msg.sender, tokenId);
        emit LandPurchased(tokenId, msg.sender);
    }

    /// @notice Gov updates the encrypted CID after re-encryption for buyer
    function updateTokenURI(uint256 tokenId, string calldata newCid) external onlyGov {
        _setTokenURI(tokenId, newCid);
    }

        /// @dev Merge the enumerable & URI‐storage interface IDs
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /// @dev tokenURI is defined in both ERC721 and ERC721URIStorage
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /// @dev _increaseBalance is defined in both ERC721 and ERC721Enumerable
    function _increaseBalance(address account, uint128 amount)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, amount);
    }

    /// @dev _update is defined in both ERC721 and ERC721Enumerable
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

}
