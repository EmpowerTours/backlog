// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title Backlog
/// @notice A self-updating, public record of everything a builder is working on. Each address owns
///         a portfolio of projects; a project carries a completion percentage and a lifecycle status.
///         The intended writer is an automated `backlog sync` job that reads your AI build sessions +
///         git history, scores each project, and batches the result onchain on a schedule. The chain
///         is the point: a track record of your building that you can't quietly backdate.
/// @dev No admin, no upgradeability. Every address writes only its own portfolio.
contract Backlog {
    enum Status {
        Active, // being worked on
        Polishing, // essentially done, minor updates left
        Done, // shipped
        Abandoned // given up on (candidate for removal)
    }

    struct Project {
        string slug; // stable id, e.g. the repo folder name
        string name; // human label
        uint8 percent; // 0..100 completion estimate
        Status status;
        string note; // one-line summary of what's left
        uint64 updatedAt;
    }

    mapping(address => Project[]) private _projects;
    // owner => keccak(slug) => index+1 (0 means "not present")
    mapping(address => mapping(bytes32 => uint256)) private _idxPlus1;
    mapping(address => bool) private _seen;

    uint256 public totalBuilders; // distinct addresses that have tracked at least one project
    uint256 public totalUpdates; // lifetime upsert count across everyone

    event ProjectUpserted(
        address indexed owner, bytes32 indexed slugHash, string slug, uint8 percent, Status status, string note, uint64 at
    );
    event ProjectRemoved(address indexed owner, bytes32 indexed slugHash, string slug);

    function upsertProject(string calldata slug, string calldata name, uint8 percent, Status status, string calldata note)
        external
    {
        _upsert(msg.sender, slug, name, percent, status, note);
    }

    /// @notice Update the whole portfolio in one transaction — what the scheduled sync uses.
    function batchUpsert(
        string[] calldata slugs,
        string[] calldata names,
        uint8[] calldata percents,
        uint8[] calldata statuses,
        string[] calldata notes
    ) external {
        uint256 n = slugs.length;
        require(
            n == names.length && n == percents.length && n == statuses.length && n == notes.length, "length mismatch"
        );
        for (uint256 i = 0; i < n; i++) {
            require(statuses[i] <= uint8(Status.Abandoned), "bad status");
            _upsert(msg.sender, slugs[i], names[i], percents[i], Status(statuses[i]), notes[i]);
        }
    }

    /// @notice Drop a project from your portfolio entirely (e.g. one you abandoned).
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

    function _upsert(address owner, string calldata slug, string calldata name, uint8 percent, Status status, string calldata note)
        internal
    {
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
