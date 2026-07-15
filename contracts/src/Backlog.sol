// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title Backlog — the honest, attested onchain build ledger
/// @notice A public, self-updating record of everything a builder is working on. Each address owns a
///         portfolio of projects, each with a completion percentage and a lifecycle status. The novel
///         part is the attestation: every write must be signed by the off-chain SCORER, and the contract
///         REJECTS any score the honest scorer didn't produce. You cannot hand-write yourself a better
///         number — the chain won't accept it. The result is a builder track record that is public,
///         timestamped, and provably un-forged.
///
///         Builders can also put money where their mouth is: `bond()` stakes MON on a shipped project being
///         live. Anyone can `challenge()` a bond; after a 3-day cure window an oracle-signed liveness check
///         settles it. If the deployment is dead, the challenger takes the pot and the project drops to the
///         graveyard — a permissionless, escrowed market for catching abandoned "done" claims.
/// @dev No admin, no upgradeability, no owner. SCORER is fixed at deploy (it both signs score attestations
///      and, as the oracle, signs liveness observations). Every address writes only its own portfolio, and
///      only with a fresh, time-bounded scorer attestation. Bond payouts follow checks-effects-interactions.
contract Backlog {
    enum Status {
        Active, // being worked on
        Polishing, // essentially done, minor updates left
        Done, // shipped
        Abandoned // given up on (candidate for removal)
    }

    struct Project {
        string slug; // stable id, e.g. the repo name
        string name; // human label
        uint8 percent; // 0..100 completion estimate
        Status status;
        string note; // one-line summary of what's left
        uint64 updatedAt;
    }

    /// @notice The off-chain scorer whose signature authorizes writes. Set once at deploy, immutable.
    address public immutable SCORER;

    mapping(address => Project[]) private _projects;
    // owner => keccak(slug) => index+1 (0 means "not present")
    mapping(address => mapping(bytes32 => uint256)) private _idxPlus1;
    mapping(address => bool) private _seen;

    uint256 public totalBuilders; // distinct addresses that have tracked at least one project
    uint256 public totalUpdates; // lifetime upsert count across everyone

    // ---- shipping bonds: put money behind a "this is really shipped & live" claim ----
    uint256 public constant MIN_BOND = 0.1 ether; // 0.1 MON
    uint64 public constant CURE_WINDOW = 3 days; // grace period to bring a challenged deployment back up

    struct Bond {
        uint128 amount; // builder's staked amount (a challenger must match it)
        address challenger; // address(0) while unchallenged
        uint64 cureDeadline; // a challenge can only be resolved at/after this time
    }
    // builder => keccak(slug) => Bond
    mapping(address => mapping(bytes32 => Bond)) public bonds;
    // builder => keccak(slug) => the public URL the claim is about (what the oracle must check)
    mapping(address => mapping(bytes32 => string)) public bondUrl;
    uint256 public totalBonded; // MON currently escrowed across all live bonds

    event ProjectUpserted(
        address indexed owner, bytes32 indexed slugHash, string slug, uint8 percent, Status status, string note, uint64 at
    );
    event ProjectRemoved(address indexed owner, bytes32 indexed slugHash, string slug);
    event Bonded(address indexed builder, bytes32 indexed slugHash, uint256 amount, string url);
    event Challenged(address indexed builder, bytes32 indexed slugHash, address indexed challenger, uint64 cureDeadline);
    event Resolved(address indexed builder, bytes32 indexed slugHash, bool live, address winner, uint256 payout);
    event Unbonded(address indexed builder, bytes32 indexed slugHash, uint256 amount);

    constructor(address scorer) {
        require(scorer != address(0), "scorer=0");
        SCORER = scorer;
    }

    /// @notice Write your whole portfolio in one transaction — but only with a fresh scorer attestation.
    ///         The signature binds these exact scores to your address and this chain/contract, so it can't
    ///         be replayed elsewhere or reused after `deadline`.
    /// @param deadline unix time after which the attestation is void (stops hoarding a stale good score)
    /// @param signature SCORER's signature over
    ///        keccak256(chainid, address(this), msg.sender, deadline, slugs, names, percents, statuses, notes)
    function batchUpsert(
        string[] calldata slugs,
        string[] calldata names,
        uint8[] calldata percents,
        uint8[] calldata statuses,
        string[] calldata notes,
        uint64 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "attestation expired");
        uint256 n = slugs.length;
        require(
            n == names.length && n == percents.length && n == statuses.length && n == notes.length, "length mismatch"
        );
        // isolated in a helper to keep the big abi.encode off this frame's stack (stack-too-deep)
        _verifyAttestation(slugs, names, percents, statuses, notes, deadline, signature);

        for (uint256 i = 0; i < n; i++) {
            require(statuses[i] <= uint8(Status.Abandoned), "bad status");
            _upsert(msg.sender, slugs[i], names[i], percents[i], Status(statuses[i]), notes[i]);
        }
    }

    /// @dev Rebuild the signed digest from calldata and require it was signed by SCORER for this caller.
    function _verifyAttestation(
        string[] calldata slugs,
        string[] calldata names,
        uint8[] calldata percents,
        uint8[] calldata statuses,
        string[] calldata notes,
        uint64 deadline,
        bytes calldata signature
    ) internal view {
        bytes32 digest = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, deadline, slugs, names, percents, statuses, notes)
        );
        require(_recoverSigner(digest, signature) == SCORER, "bad attestation");
    }

    /// @notice Drop a project from your own portfolio (e.g. bury a dead one). No attestation required — a
    ///         deletion can only shrink your record, never inflate it.
    function removeProject(string calldata slug) external {
        bytes32 h = keccak256(bytes(slug));
        uint256 idxPlus1 = _idxPlus1[msg.sender][h];
        require(idxPlus1 != 0, "no such project");
        uint256 i = idxPlus1 - 1;

        Project[] storage list = _projects[msg.sender];
        uint256 last = list.length - 1;
        if (i != last) {
            Project storage moved = list[last];
            list[i] = moved;
            _idxPlus1[msg.sender][keccak256(bytes(moved.slug))] = i + 1;
        }
        list.pop();
        delete _idxPlus1[msg.sender][h];
        emit ProjectRemoved(msg.sender, h, slug);
    }

    // ---- shipping bonds ---------------------------------------------------

    /// @notice Stake MON behind one of your own shipped projects: "this is really live." Optional — it's a
    ///         credibility signal, not a requirement. Anyone can challenge it; if your deployment is dead,
    ///         you lose the bond and the project drops to the graveyard.
    function bond(string calldata slug, string calldata url) external payable {
        require(msg.value >= MIN_BOND, "bond < MIN_BOND");
        require(msg.value <= type(uint128).max, "bond too large");
        require(bytes(url).length > 0 && bytes(url).length <= 200, "url 1-200");
        bytes32 h = keccak256(bytes(slug));
        uint256 idxPlus1 = _idxPlus1[msg.sender][h];
        require(idxPlus1 != 0, "no such project");
        require(_projects[msg.sender][idxPlus1 - 1].status == Status.Done, "only Done can be bonded");
        require(bonds[msg.sender][h].amount == 0, "already bonded");

        bonds[msg.sender][h] = Bond({amount: uint128(msg.value), challenger: address(0), cureDeadline: 0});
        bondUrl[msg.sender][h] = url;
        totalBonded += msg.value;
        emit Bonded(msg.sender, h, msg.value, url);
    }

    /// @notice Challenge a bonded claim ("that shipped link is dead"). Match the bond; a 3-day cure window
    ///         opens. If the deployment is still dead when it closes, you take the whole pot.
    function challenge(address builder, string calldata slug) external payable {
        bytes32 h = keccak256(bytes(slug));
        Bond storage b = bonds[builder][h];
        require(b.amount != 0, "not bonded");
        require(b.challenger == address(0), "already challenged");
        require(msg.sender != builder, "self-challenge");
        require(msg.value == b.amount, "must match bond");

        b.challenger = msg.sender;
        b.cureDeadline = uint64(block.timestamp) + CURE_WINDOW;
        totalBonded += msg.value;
        emit Challenged(builder, h, msg.sender, b.cureDeadline);
    }

    /// @notice Settle a challenge after the cure window using an ORACLE-signed liveness observation taken
    ///         at/after the deadline. `live` = the deployment survived the window (builder wins); otherwise
    ///         the challenger wins the pot and the project is flipped to Abandoned onchain.
    /// @dev The oracle only attests one objectively-falsifiable fact (does the URL respond). Anyone can
    ///      re-check the same URL to confirm the oracle was honest.
    function resolve(address builder, string calldata slug, bool live, uint64 observedAt, bytes calldata signature)
        external
    {
        bytes32 h = keccak256(bytes(slug));
        Bond storage b = bonds[builder][h];
        require(b.challenger != address(0), "not challenged");
        require(block.timestamp >= b.cureDeadline, "cure window open");
        require(observedAt >= b.cureDeadline, "stale observation");

        bytes32 digest =
            keccak256(abi.encode(block.chainid, address(this), keccak256("LIVENESS"), builder, h, live, observedAt));
        require(_recoverSigner(digest, signature) == SCORER, "bad oracle sig");

        uint256 pot = uint256(b.amount) * 2;
        address winner = live ? builder : b.challenger;

        // slash a proven-dead claim: correct the record into the graveyard
        if (!live) {
            uint256 idxPlus1 = _idxPlus1[builder][h];
            if (idxPlus1 != 0) {
                Project storage p = _projects[builder][idxPlus1 - 1];
                p.status = Status.Abandoned;
                p.updatedAt = uint64(block.timestamp);
                emit ProjectUpserted(builder, h, p.slug, p.percent, Status.Abandoned, p.note, uint64(block.timestamp));
            }
        }

        // effects before interaction (CEI): clear escrow, then pay out
        delete bonds[builder][h];
        delete bondUrl[builder][h];
        totalBonded -= pot;
        emit Resolved(builder, h, live, winner, pot);
        (bool ok,) = winner.call{value: pot}("");
        require(ok, "payout failed");
    }

    /// @notice Reclaim your bond when it isn't under challenge (e.g. you're sunsetting the project).
    function withdrawBond(string calldata slug) external {
        bytes32 h = keccak256(bytes(slug));
        Bond storage b = bonds[msg.sender][h];
        require(b.amount != 0, "not bonded");
        require(b.challenger == address(0), "under challenge");

        uint256 amt = b.amount;
        delete bonds[msg.sender][h];
        delete bondUrl[msg.sender][h];
        totalBonded -= amt;
        emit Unbonded(msg.sender, h, amt);
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "withdraw failed");
    }

    function _upsert(
        address owner,
        string calldata slug,
        string calldata name,
        uint8 percent,
        Status status,
        string calldata note
    ) internal {
        require(bytes(slug).length > 0 && bytes(slug).length <= 60, "slug 1-60");
        require(bytes(name).length > 0 && bytes(name).length <= 80, "name 1-80");
        require(bytes(note).length <= 160, "note too long");
        require(percent <= 100, "percent > 100");

        bytes32 h = keccak256(bytes(slug));
        uint256 idxPlus1 = _idxPlus1[owner][h];

        if (idxPlus1 == 0) {
            if (!_seen[owner]) {
                _seen[owner] = true;
                unchecked {
                    totalBuilders++;
                }
            }
            _projects[owner].push(
                Project({slug: slug, name: name, percent: percent, status: status, note: note, updatedAt: uint64(block.timestamp)})
            );
            _idxPlus1[owner][h] = _projects[owner].length; // index+1
        } else {
            Project storage p = _projects[owner][idxPlus1 - 1];
            p.name = name;
            p.percent = percent;
            p.status = status;
            p.note = note;
            p.updatedAt = uint64(block.timestamp);
        }
        unchecked {
            totalUpdates++;
        }
        emit ProjectUpserted(owner, h, slug, percent, status, note, uint64(block.timestamp));
    }

    /// @dev Recover the signer of an EIP-191 personal_sign over `digest`. 65-byte sig, low-s enforced.
    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // reject the high-s malleable half-order
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "sig s");
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "sig v");
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address signer = ecrecover(ethHash, v, r, s);
        require(signer != address(0), "sig invalid");
        return signer;
    }

    function getProjects(address owner) external view returns (Project[] memory) {
        return _projects[owner];
    }

    function projectCount(address owner) external view returns (uint256) {
        return _projects[owner].length;
    }

    function getProject(address owner, string calldata slug) external view returns (Project memory) {
        uint256 idxPlus1 = _idxPlus1[owner][keccak256(bytes(slug))];
        require(idxPlus1 != 0, "no such project");
        return _projects[owner][idxPlus1 - 1];
    }

    function hasProject(address owner, string calldata slug) external view returns (bool) {
        return _idxPlus1[owner][keccak256(bytes(slug))] != 0;
    }
}
