// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {LuminaSoul} from "../src/LuminaSoul.sol";

/// Reads config from env — NO secrets committed. Run against Base Sepolia first.
///   PRIVATE_KEY   deployer/owner key (also the minter)
///   BASE_URI      e.g. https://api.luminalog.com/v1/nft/
contract DeployLuminaSoul is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory baseURI = vm.envString("BASE_URI");
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);
        new LuminaSoul("LuminaLog Soul", "SOUL", baseURI, owner);
        vm.stopBroadcast();
    }
}
