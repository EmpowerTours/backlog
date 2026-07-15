// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {Backlog} from "../src/Backlog.sol";

contract BacklogTest is Test {
    Backlog bl;
    uint256 scorerPk = 0x5C0; // the honest scorer's key
    address scorer;
    uint256 wrongPk = 0xBAD; // an impostor key
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        scorer = vm.addr(scorerPk);
        bl = new Backlog(scorer);
        vm.warp(1_700_000_000);
    }

    // ---- helpers ---------------------------------------------------------
    function _one(string memory slug, string memory name, uint8 pct, Backlog.Status s, string memory note)
        internal
        pure
        returns (
            string[] memory slugs,
            string[] memory names,
            uint8[] memory pcts,
            uint8[] memory st,
            string[] memory notes
        )
    {
        slugs = new string[](1);
        names = new string[](1);
        pcts = new uint8[](1);
        st = new uint8[](1);
        notes = new string[](1);
        (slugs[0], names[0], pcts[0], st[0], notes[0]) = (slug, name, pct, uint8(s), note);
    }

    function _digest(
        address owner,
        string[] memory slugs,
        string[] memory names,
        uint8[] memory pcts,
        uint8[] memory st,
        string[] memory notes,
        uint64 deadline
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(bl), owner, deadline, slugs, names, pcts, st, notes));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _write(
        uint256 signerPk,
        address owner,
        string[] memory slugs,
        string[] memory names,
        uint8[] memory pcts,
        uint8[] memory st,
        string[] memory notes,
        uint64 deadline
    ) internal {
        bytes memory sig = _sign(signerPk, _digest(owner, slugs, names, pcts, st, notes, deadline));
        vm.prank(owner);
        bl.batchUpsert(slugs, names, pcts, st, notes, deadline, sig);
    }

    /// attested single-project write, for the remove/isolation tests
    function _upOne(address who, string memory slug, string memory name, uint8 pct, Backlog.Status s, string memory note)
        internal
    {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one(slug, name, pct, s, note);
        _write(scorerPk, who, sl, nm, pc, st, nt, uint64(block.timestamp + 600));
    }

    // ---- attestation core ------------------------------------------------
    function test_scorerIsSet() public view {
        assertEq(bl.SCORER(), scorer);
    }

    function test_attestedWriteLands() public {
        _upOne(alice, "backlog", "Backlog", 72, Backlog.Status.Polishing, "attestation left");
        assertEq(bl.projectCount(alice), 1);
        assertEq(bl.totalBuilders(), 1);
        assertEq(bl.totalUpdates(), 1);
        Backlog.Project memory p = bl.getProject(alice, "backlog");
        assertEq(p.percent, 72);
        assertEq(uint256(p.status), uint256(Backlog.Status.Polishing));
        assertEq(p.updatedAt, 1_700_000_000);
    }

    function test_updatesInPlace() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("backlog", "Backlog", 40, Backlog.Status.Active, "wiring");
        _write(scorerPk, alice, sl, nm, pc, st, nt, uint64(block.timestamp + 600));
        vm.warp(1_700_000_500);
        pc[0] = 90;
        st[0] = uint8(Backlog.Status.Polishing);
        nt[0] = "just the README";
        _write(scorerPk, alice, sl, nm, pc, st, nt, uint64(block.timestamp + 600));

        assertEq(bl.projectCount(alice), 1); // not duplicated
        assertEq(bl.totalUpdates(), 2);
        Backlog.Project memory p = bl.getProject(alice, "backlog");
        assertEq(p.percent, 90);
        assertEq(p.updatedAt, 1_700_000_500);
    }

    function test_rejectsWrongSigner() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("x", "X", 99, Backlog.Status.Done, "faked");
        uint64 dl = uint64(block.timestamp + 600);
        bytes memory sig = _sign(wrongPk, _digest(alice, sl, nm, pc, st, nt, dl)); // impostor signs
        vm.prank(alice);
        vm.expectRevert("bad attestation");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    function test_rejectsTamperedScore() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("x", "X", 40, Backlog.Status.Active, "honest");
        uint64 dl = uint64(block.timestamp + 600);
        bytes memory sig = _sign(scorerPk, _digest(alice, sl, nm, pc, st, nt, dl)); // scorer signs 40%
        pc[0] = 100; // ...but alice submits 100%
        vm.prank(alice);
        vm.expectRevert("bad attestation");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    function test_rejectsReplayByOtherOwner() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("x", "X", 80, Backlog.Status.Done, "alice's");
        uint64 dl = uint64(block.timestamp + 600);
        bytes memory sig = _sign(scorerPk, _digest(alice, sl, nm, pc, st, nt, dl)); // bound to alice
        vm.prank(bob); // bob tries to reuse it
        vm.expectRevert("bad attestation");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    function test_rejectsExpired() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("x", "X", 50, Backlog.Status.Active, "stale");
        uint64 dl = uint64(block.timestamp - 1); // already expired
        bytes memory sig = _sign(scorerPk, _digest(alice, sl, nm, pc, st, nt, dl));
        vm.prank(alice);
        vm.expectRevert("attestation expired");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    function test_rejectsBadSigLength() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("x", "X", 50, Backlog.Status.Active, "n");
        uint64 dl = uint64(block.timestamp + 600);
        vm.prank(alice);
        vm.expectRevert("sig len");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, hex"1234");
    }

    // ---- shape / validation (still enforced under attestation) -----------
    function test_multiProjectBatch() public {
        string[] memory slugs = new string[](3);
        string[] memory names = new string[](3);
        uint8[] memory pcts = new uint8[](3);
        uint8[] memory st = new uint8[](3);
        string[] memory notes = new string[](3);
        (slugs[0], names[0], pcts[0], st[0], notes[0]) = ("a", "Alpha", 100, uint8(Backlog.Status.Done), "shipped");
        (slugs[1], names[1], pcts[1], st[1], notes[1]) = ("b", "Beta", 55, uint8(Backlog.Status.Active), "midway");
        (slugs[2], names[2], pcts[2], st[2], notes[2]) = ("c", "Gamma", 0, uint8(Backlog.Status.Abandoned), "dead");
        _write(scorerPk, alice, slugs, names, pcts, st, notes, uint64(block.timestamp + 600));
        assertEq(bl.projectCount(alice), 3);
        assertEq(bl.totalUpdates(), 3);
        assertEq(bl.totalBuilders(), 1);
        assertEq(bl.getProject(alice, "b").percent, 55);
    }

    function test_lengthMismatchReverts() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st,) =
            _one("x", "X", 50, Backlog.Status.Active, "n");
        string[] memory badNotes = new string[](2); // wrong length
        uint64 dl = uint64(block.timestamp + 600);
        bytes32 digest = keccak256(abi.encode(block.chainid, address(bl), alice, dl, sl, nm, pc, st, badNotes));
        bytes memory sig = _sign(scorerPk, digest);
        vm.prank(alice);
        vm.expectRevert("length mismatch");
        bl.batchUpsert(sl, nm, pc, st, badNotes, dl, sig);
    }

    function test_badStatusReverts() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("a", "Alpha", 10, Backlog.Status.Active, "");
        st[0] = 9; // invalid enum
        uint64 dl = uint64(block.timestamp + 600);
        bytes memory sig = _sign(scorerPk, _digest(alice, sl, nm, pc, st, nt, dl));
        vm.prank(alice);
        vm.expectRevert("bad status");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    function test_rejectsBadInput() public {
        (string[] memory sl, string[] memory nm, uint8[] memory pc, uint8[] memory st, string[] memory nt) =
            _one("", "n", 10, Backlog.Status.Active, "");
        uint64 dl = uint64(block.timestamp + 600);
        bytes memory sig = _sign(scorerPk, _digest(alice, sl, nm, pc, st, nt, dl));
        vm.prank(alice);
        vm.expectRevert("slug 1-60");
        bl.batchUpsert(sl, nm, pc, st, nt, dl, sig);
    }

    // ---- removal (unguarded — a deletion can't inflate) ------------------
    function test_removeStillWorksUnguarded() public {
        _upOne(alice, "dead", "Dead", 0, Backlog.Status.Abandoned, "rip");
        assertEq(bl.projectCount(alice), 1);
        vm.prank(alice);
        bl.removeProject("dead"); // no attestation needed
        assertEq(bl.projectCount(alice), 0);
        assertFalse(bl.hasProject(alice, "dead"));
    }

    function test_removeMiddleSwapPops() public {
        _upOne(alice, "a", "Alpha", 10, Backlog.Status.Active, "");
        _upOne(alice, "b", "Beta", 20, Backlog.Status.Active, "");
        _upOne(alice, "c", "Gamma", 30, Backlog.Status.Active, "");
        vm.prank(alice);
        bl.removeProject("b");
        assertEq(bl.projectCount(alice), 2);
        assertFalse(bl.hasProject(alice, "b"));
        assertTrue(bl.hasProject(alice, "c"));
        assertEq(bl.getProject(alice, "c").percent, 30);
        assertEq(bl.getProject(alice, "a").percent, 10);
    }

    function test_removeNonexistentReverts() public {
        vm.prank(alice);
        vm.expectRevert("no such project");
        bl.removeProject("nope");
    }

    function test_ownerIsolation() public {
        _upOne(alice, "a", "Alpha", 10, Backlog.Status.Active, "");
        assertEq(bl.projectCount(bob), 0);
        _upOne(bob, "a", "BobAlpha", 99, Backlog.Status.Active, "");
        assertEq(bl.totalBuilders(), 2);
        assertEq(bl.getProject(alice, "a").percent, 10);
        assertEq(bl.getProject(bob, "a").percent, 99);
    }

    function test_getProjectNonexistentReverts() public {
        vm.expectRevert("no such project");
        bl.getProject(alice, "ghost");
    }

    // ---- shipping bonds --------------------------------------------------
    function _makeDone(address who, string memory slug) internal {
        _upOne(who, slug, "Shipped", 100, Backlog.Status.Done, "live");
    }

    function _livenessSig(address builder, string memory slug, bool live, uint64 observedAt)
        internal
        view
        returns (bytes memory)
    {
        bytes32 h = keccak256(bytes(slug));
        bytes32 digest =
            keccak256(abi.encode(block.chainid, address(bl), keccak256("LIVENESS"), builder, h, live, observedAt));
        return _sign(scorerPk, digest);
    }

    function test_bondRequiresDone() public {
        _upOne(alice, "wip", "WIP", 50, Backlog.Status.Active, "not shipped");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("only Done can be bonded");
        bl.bond{value: 0.1 ether}("wip", "https://x.app");
    }

    function test_bondBelowMinReverts() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("bond < MIN_BOND");
        bl.bond{value: 0.05 ether}("app", "https://x.app");
    }

    function test_bondAndWithdraw() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        (uint128 amt, address ch,) = bl.bonds(alice, keccak256("app"));
        assertEq(amt, 0.1 ether);
        assertEq(ch, address(0));
        assertEq(bl.totalBonded(), 0.1 ether);

        vm.prank(alice);
        bl.withdrawBond("app");
        assertEq(alice.balance, 1 ether); // full refund
        assertEq(bl.totalBonded(), 0);
    }

    function test_selfChallengeReverts() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.expectRevert("self-challenge");
        bl.challenge{value: 0.1 ether}(alice, "app");
        vm.stopPrank();
    }

    function test_challengeMustMatch() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert("must match bond");
        bl.challenge{value: 0.2 ether}(alice, "app");
    }

    function test_withdrawUnderChallengeReverts() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        bl.challenge{value: 0.1 ether}(alice, "app");
        vm.prank(alice);
        vm.expectRevert("under challenge");
        bl.withdrawBond("app");
    }

    function test_resolveBeforeCureReverts() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        bl.challenge{value: 0.1 ether}(alice, "app");
        (,, uint64 cure) = bl.bonds(alice, keccak256("app"));
        bytes memory sig = _livenessSig(alice, "app", false, cure);
        vm.expectRevert("cure window open");
        bl.resolve(alice, "app", false, cure, sig);
    }

    function test_resolveLiveBuilderWins() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        bl.challenge{value: 0.1 ether}(alice, "app");
        (,, uint64 cure) = bl.bonds(alice, keccak256("app"));
        vm.warp(cure + 1);
        bytes memory sig = _livenessSig(alice, "app", true, cure); // survived: still live
        bl.resolve(alice, "app", true, cure, sig);

        assertEq(alice.balance, 1 ether + 0.1 ether); // won bob's stake
        assertEq(uint256(bl.getProject(alice, "app").status), uint256(Backlog.Status.Done)); // unchanged
        assertEq(bl.totalBonded(), 0);
    }

    function test_resolveDeadChallengerWinsAndGraveyards() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        bl.challenge{value: 0.1 ether}(alice, "app");
        (,, uint64 cure) = bl.bonds(alice, keccak256("app"));
        vm.warp(cure + 1);
        bytes memory sig = _livenessSig(alice, "app", false, cure); // dead
        bl.resolve(alice, "app", false, cure, sig);

        assertEq(bob.balance, 1 ether + 0.1 ether); // challenger took the pot
        assertEq(uint256(bl.getProject(alice, "app").status), uint256(Backlog.Status.Abandoned)); // graveyarded
        assertEq(bl.totalBonded(), 0);
    }

    function test_resolveBadOracleSigReverts() public {
        _makeDone(alice, "app");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bl.bond{value: 0.1 ether}("app", "https://x.app");
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        bl.challenge{value: 0.1 ether}(alice, "app");
        (,, uint64 cure) = bl.bonds(alice, keccak256("app"));
        vm.warp(cure + 1);
        // impostor signs the liveness verdict
        bytes32 h = keccak256("app");
        bytes32 digest =
            keccak256(abi.encode(block.chainid, address(bl), keccak256("LIVENESS"), alice, h, false, cure));
        bytes memory sig = _sign(wrongPk, digest);
        vm.expectRevert("bad oracle sig");
        bl.resolve(alice, "app", false, cure, sig);
    }
}
