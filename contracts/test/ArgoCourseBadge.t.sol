// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArgoCourseBadge} from "../src/ArgoCourseBadge.sol";

contract ArgoCourseBadgeTest is Test {
    ArgoCourseBadge badge;
    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address bob = address(0xCAFE);
    string constant BASE = "https://api.luminalog.com/v1/course-badge/";

    function setUp() public {
        badge = new ArgoCourseBadge("Argo Course Badge", "ARGOCB", BASE, owner);
    }

    function test_ownerMintsAndTracksClass() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 7);
        assertEq(badge.ownerOf(id), alice);
        assertEq(badge.classOf(id), 7);
        assertTrue(badge.minted(7, alice));
        assertTrue(badge.locked(id));
    }

    function test_tokenURIFormat() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 1);
        assertEq(badge.tokenURI(id), string.concat(BASE, vm.toString(id), ".json"));
    }

    function test_revertsOnSecondMintSameClass() public {
        vm.startPrank(owner);
        badge.mint(alice, 3);
        vm.expectRevert(bytes("BADGE: already minted"));
        badge.mint(alice, 3);
        vm.stopPrank();
    }

    function test_sameUserDifferentClassesOk() public {
        vm.startPrank(owner);
        uint256 a = badge.mint(alice, 1);
        uint256 b = badge.mint(alice, 2);
        vm.stopPrank();
        assertEq(badge.balanceOf(alice), 2);
        assertTrue(a != b);
    }

    function test_nonOwnerCannotMint() public {
        vm.prank(alice);
        vm.expectRevert();
        badge.mint(alice, 1);
    }

    function test_soulbound_transferReverts() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 1);
        vm.prank(alice);
        vm.expectRevert(bytes("BADGE: non-transferable"));
        badge.transferFrom(alice, bob, id);
    }

    function test_renounceReverts() public {
        vm.prank(owner);
        vm.expectRevert(bytes("BADGE: ownership required"));
        badge.renounceOwnership();
    }
}
