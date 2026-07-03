// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LuminaSoul} from "../src/LuminaSoul.sol";

contract LuminaSoulTest is Test {
    LuminaSoul soul;
    address owner = address(0xA11CE);
    address userA = address(0xB0B);
    address userB = address(0xCAFE);

    function setUp() public {
        soul = new LuminaSoul("LuminaLog Soul", "SOUL", "https://api.luminalog.com/v1/nft/", owner);
    }

    function test_ownerMintsOnePerUser() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        assertEq(soul.ownerOf(id), userA);
        assertEq(soul.balanceOf(userA), 1);
    }

    function test_nonOwnerCannotMint() public {
        vm.prank(userA);
        vm.expectRevert();
        soul.mint(userA);
    }

    function test_secondMintToSameUserReverts() public {
        vm.startPrank(owner);
        soul.mint(userA);
        vm.expectRevert(bytes("SOUL: already minted"));
        soul.mint(userA);
        vm.stopPrank();
    }

    function test_transferReverts_soulbound() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        vm.prank(userA);
        vm.expectRevert(bytes("SOUL: non-transferable"));
        soul.transferFrom(userA, userB, id);
    }

    function test_lockedAlwaysTrue() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        assertTrue(soul.locked(id));
    }

    function test_lockedRevertsForNonexistent() public {
        vm.expectRevert();
        soul.locked(999);
    }

    function test_safeTransferFromReverts() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        vm.prank(userA);
        vm.expectRevert(bytes("SOUL: non-transferable"));
        soul.safeTransferFrom(userA, userB, id);
    }

    function test_operatorTransferReverts() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        vm.prank(userA);
        soul.setApprovalForAll(address(0xDEAD), true);
        vm.prank(address(0xDEAD));
        vm.expectRevert(bytes("SOUL: non-transferable"));
        soul.transferFrom(userA, userB, id);
    }

    function test_approveSucceedsButTransferReverts() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        vm.prank(userA);
        soul.approve(userB, id);
        vm.prank(userB);
        vm.expectRevert(bytes("SOUL: non-transferable"));
        soul.transferFrom(userA, userB, id);
    }

    function test_mintToZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert();
        soul.mint(address(0));
    }

    function test_secondUserGetsTokenIdTwo() public {
        vm.startPrank(owner);
        soul.mint(userA);
        uint256 id2 = soul.mint(userB);
        vm.stopPrank();
        assertEq(id2, 2);
    }

    function test_tokenURIRevertsForNonexistent() public {
        vm.expectRevert();
        soul.tokenURI(999);
    }

    function test_renounceOwnershipReverts() public {
        vm.prank(owner);
        vm.expectRevert(bytes("SOUL: ownership required"));
        soul.renounceOwnership();
    }

    function test_tokenURIFormat() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA); // id == 1
        assertEq(soul.tokenURI(id), "https://api.luminalog.com/v1/nft/1.json");
    }

    function test_setBaseURI_ownerOnly() public {
        vm.prank(userA);
        vm.expectRevert();
        soul.setBaseURI("https://x/");
        vm.prank(owner);
        soul.setBaseURI("https://x/");
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        assertEq(soul.tokenURI(id), "https://x/1.json");
    }

    function test_refreshMetadata_ownerOnly_emits() public {
        vm.prank(owner);
        uint256 id = soul.mint(userA);
        vm.prank(userA);
        vm.expectRevert();
        soul.refreshMetadata(id);
        vm.prank(owner);
        soul.refreshMetadata(id); // should not revert
    }

    function test_supportsInterfaces() public view {
        assertTrue(soul.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(soul.supportsInterface(0xb45a3c0e)); // ERC-5192
        assertTrue(soul.supportsInterface(0x49064906)); // ERC-4906
    }
}
