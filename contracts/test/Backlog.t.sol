// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {Backlog} from "../src/Backlog.sol";

contract BacklogTest is Test {
    Backlog bl;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        bl = new Backlog();
        vm.warp(1_700_000_000);
    }

    function _up(address who, string memory slug, string memory name, uint8 pct, Backlog.Status s, string memory note)
        internal
    {
        vm.prank(who);
        bl.upsertProject(slug, name, pct, s, note);
    }

    function test_upsertNew() public {
        _up(alice, "backlog", "Backlog", 40, Backlog.Status.Active, "wiring the CLI");
        assertEq(bl.projectCount(alice), 1);
        assertEq(bl.totalBuilders(), 1);
        assertEq(bl.totalUpdates(), 1);
        Backlog.Project memory p = bl.getProject(alice, "backlog");
        assertEq(p.name, "Backlog");
        assertEq(p.percent, 40);
        assertEq(uint256(p.status), uint256(Backlog.Status.Active));
        assertEq(p.updatedAt, 1_700_000_000);
    }

    function test_upsertUpdatesInPlace() public {
        _up(alice, "backlog", "Backlog", 40, Backlog.Status.Active, "wiring");
        vm.warp(1_700_000_500);
        _up(alice, "backlog", "Backlog", 90, Backlog.Status.Polishing, "just the README");
        assertEq(bl.projectCount(alice), 1); // not duplicated
        assertEq(bl.totalUpdates(), 2);
        assertEq(bl.totalBuilders(), 1);
        Backlog.Project memory p = bl.getProject(alice, "backlog");
        assertEq(p.percent, 90);
        assertEq(uint256(p.status), uint256(Backlog.Status.Polishing));
        assertEq(p.updatedAt, 1_700_000_500);
    }

    function test_batchUpsert() public {
        string[] memory slugs = new string[](3);
        string[] memory names = new string[](3);
        uint8[] memory pcts = new uint8[](3);
        uint8[] memory st = new uint8[](3);
        string[] memory notes = new string[](3);
        (slugs[0], names[0], pcts[0], st[0], notes[0]) = ("a", "Alpha", 100, uint8(Backlog.Status.Done), "shipped");
        (slugs[1], names[1], pcts[1], st[1], notes[1]) = ("b", "Beta", 55, uint8(Backlog.Status.Active), "midway");
        (slugs[2], names[2], pcts[2], st[2], notes[2]) = ("c", "Gamma", 0, uint8(Backlog.Status.Abandoned), "dead");
        vm.prank(alice);
        bl.batchUpsert(slugs, names, pcts, st, notes);
        assertEq(bl.projectCount(alice), 3);
        assertEq(bl.totalUpdates(), 3);
        assertEq(bl.totalBuilders(), 1);
        assertEq(bl.getProject(alice, "b").percent, 55);
    }

    function test_batchLengthMismatchReverts() public {
        string[] memory slugs = new string[](2);
        string[] memory names = new string[](1);
        uint8[] memory pcts = new uint8[](2);
        uint8[] memory st = new uint8[](2);
        string[] memory notes = new string[](2);
        vm.prank(alice);
        vm.expectRevert("length mismatch");
        bl.batchUpsert(slugs, names, pcts, st, notes);
    }

    function test_batchBadStatusReverts() public {
        string[] memory slugs = new string[](1);
        string[] memory names = new string[](1);
        uint8[] memory pcts = new uint8[](1);
        uint8[] memory st = new uint8[](1);
        string[] memory notes = new string[](1);
        (slugs[0], names[0], pcts[0], st[0], notes[0]) = ("a", "Alpha", 10, 9, "");
        vm.prank(alice);
        vm.expectRevert("bad status");
        bl.batchUpsert(slugs, names, pcts, st, notes);
    }

    function test_removeMiddleSwapPops() public {
        _up(alice, "a", "Alpha", 10, Backlog.Status.Active, "");
        _up(alice, "b", "Beta", 20, Backlog.Status.Active, "");
        _up(alice, "c", "Gamma", 30, Backlog.Status.Active, "");
        vm.prank(alice);
        bl.removeProject("b");

        assertEq(bl.projectCount(alice), 2);
        assertFalse(bl.hasProject(alice, "b"));
        // c must still be reachable and correct after being swapped into b's slot
        assertTrue(bl.hasProject(alice, "c"));
        assertEq(bl.getProject(alice, "c").percent, 30);
        assertEq(bl.getProject(alice, "a").percent, 10);
    }

    function test_removeThenReAdd() public {
        _up(alice, "a", "Alpha", 10, Backlog.Status.Active, "");
        vm.prank(alice);
        bl.removeProject("a");
        assertFalse(bl.hasProject(alice, "a"));
        _up(alice, "a", "Alpha2", 50, Backlog.Status.Active, "");
        assertTrue(bl.hasProject(alice, "a"));
        assertEq(bl.getProject(alice, "a").name, "Alpha2");
        assertEq(bl.projectCount(alice), 1);
    }

    function test_removeNonexistentReverts() public {
        vm.prank(alice);
        vm.expectRevert("no such project");
        bl.removeProject("nope");
    }

    function test_rejectsBadInput() public {
        vm.startPrank(alice);
        vm.expectRevert("slug 1-60");
        bl.upsertProject("", "n", 10, Backlog.Status.Active, "");
        vm.expectRevert("name 1-80");
        bl.upsertProject("s", "", 10, Backlog.Status.Active, "");
        vm.expectRevert("percent > 100");
        bl.upsertProject("s", "n", 101, Backlog.Status.Active, "");
        vm.stopPrank();
    }

    function test_ownerIsolation() public {
        _up(alice, "a", "Alpha", 10, Backlog.Status.Active, "");
        assertEq(bl.projectCount(bob), 0);
        assertFalse(bl.hasProject(bob, "a"));
        _up(bob, "a", "BobAlpha", 99, Backlog.Status.Active, "");
        assertEq(bl.totalBuilders(), 2);
        assertEq(bl.getProject(alice, "a").percent, 10);
        assertEq(bl.getProject(bob, "a").percent, 99);
    }

    function test_getProjectNonexistentReverts() public {
        vm.expectRevert("no such project");
        bl.getProject(alice, "ghost");
    }
}
