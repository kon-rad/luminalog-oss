// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @dev ERC-5192 minimal soulbound interface.
interface IERC5192 {
    event Locked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

/// One non-transferable "Soul" per user. Metadata is dynamic and hosted off-chain
/// (tokenURI = baseURI + tokenId + ".json"), so badge updates cost no gas.
contract LuminaSoul is ERC721, Ownable2Step, IERC4906, IERC5192 {
    using Strings for uint256;

    string private _base;
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_, string memory baseURI_, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
    {
        _base = baseURI_;
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        require(balanceOf(to) == 0, "SOUL: already minted");
        tokenId = _nextId++;
        _mint(to, tokenId);
        emit Locked(tokenId);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// Block renounce so an immutable contract can never lose its admin.
    function renounceOwnership() public view override onlyOwner {
        revert("SOUL: ownership required");
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
    }

    /// Nudge marketplaces to re-fetch one token's metadata (ERC-4906).
    function refreshMetadata(uint256 tokenId) external onlyOwner {
        _requireOwned(tokenId);
        emit MetadataUpdate(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_base, tokenId.toString(), ".json"));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, IERC165) returns (bool) {
        return id == 0xb45a3c0e /* ERC-5192 */ || id == 0x49064906 /* ERC-4906 */ || super.supportsInterface(id);
    }

    /// Soulbound: allow mint (from == 0), block every transfer.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0), "SOUL: non-transferable");
        return super._update(to, tokenId, auth);
    }
}
