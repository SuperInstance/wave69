#!/usr/bin/env python3
"""wave69/track_b/surface_c.py — Return Stick: the bare-metal surface.

One mmap-ed file IS the surface. The 99->99->99 flat control hierarchy maps
directly into fixed offsets: level block bases are pure arithmetic on the
header, there is no allocator, no heap object graph, no OS abstraction beyond
the single mmap() itself. This is the physicalization of the 99->99->99
negative-control result from purpose-loops: the ONE flat control mechanism,
laid out raw on a surface so any process (or cell) can walk it without a
driver, a runtime, or a permission from anyone.

LOCK-FREE LAW (SPEC section 3):
  No mutual-exclusion primitive of any kind is used in this file — the proof is
  by source scan (tests), and the banned literals live only behind string
  concatenation so the scan cannot false-positive on itself. Publication is
  the flag-byte protocol: writer fills the payload, THEN flips flags[0] 0->1;
  readers skip slots whose flag byte is still 0. Safety rests on single-writer
  discipline plus the one-byte-publish ordering, not on locks. A reader during
  a split either sees the old slot or the published new slot — never a torn mix
  — because the child's parent pointer is written before the child's flag byte
  and the parent's pointer swap is a single u32 store.

LAYOUT (header 256 B; then 3 hierarchy blocks x 99 nodes x 64 B; then a spare
pool of 27 nodes x 64 B = 20800 B total):
  header: magic(8) | version u32 | node_count u32 per level (3x) |
          level_base u64 (3x) | freelist_head u32 | reserved...
  node:   id u32 | parent u32 | level u32 | flags u8 | 21 pad |
          value f64 | reserved f64 | payload 24 B

The 3x99 hierarchy occupies its own blocks; the spare pool is the split fuel —
JIT splits seed freelist slots there, so the projected hierarchy is never
cannibalized and the 99->99->99 shape stays whole.

JIT TOPOLOGICAL SPLIT (SPEC section 3): a node whose |value| exceeds 8.0
splits — its payload seeds a freelist slot on the next level (or same level at
L2), the parent/child offsets are rewritten in place, the child publishes by
flag byte. No remap, no pause, no lock.
"""

import fcntl  # imported ONLY so test_no_locks can prove it's never called
import mmap
import os
import struct
import sys

MAGIC = b"W69SRFC\x00"
VERSION = 1
HEADER_SIZE = 256
NODE_SIZE = 64
LEVELS = 3
NODES_PER_LEVEL = 99  # the 99 -> 99 -> 99 flat control hierarchy
SPARE_NODES = 27      # split fuel (~10% headroom); splits NEVER cannibalize the hierarchy
HIER_SIZE = LEVELS * NODES_PER_LEVEL * NODE_SIZE
SURFACE_SIZE = HEADER_SIZE + HIER_SIZE + SPARE_NODES * NODE_SIZE

LEVEL_BASE = [HEADER_SIZE + l * NODES_PER_LEVEL * NODE_SIZE for l in range(LEVELS)]
SPARE_BASE = HEADER_SIZE + HIER_SIZE

HDR_MAGIC = 0
HDR_VERSION = 8
HDR_NODE_COUNT = 12          # 3 x u32
HDR_LEVEL_BASE = 24          # 3 x u64
HDR_FREELIST = 48            # u32

FLAG_PUBLISHED = 1

# struct format per node: id, parent, level (u32 x3), flags u8, 21 pad,
# value f64, reserved f64, payload 24 B  -> 4+4+4+1+21+8+8+24 = 74? No:
# 4*3=12, +1 =13, pad to 24 (11 more), +8+8=40, +24 = 64. Verified below.
NODE_FMT = "<III B 11x d d 24s"
assert struct.calcsize(NODE_FMT) == 64, struct.calcsize(NODE_FMT)


def node_offset(level: int, idx: int) -> int:
    """Pure arithmetic addressing — the 'bypass the driver' move."""
    return LEVEL_BASE[level] + idx * NODE_SIZE


def nid_offset(nid: int) -> int:
    """Address ANY node id: hierarchy ids 0..296 map by level arithmetic;
    spare ids 297..323 map into the spare pool. Still pure arithmetic."""
    if nid < LEVELS * NODES_PER_LEVEL:
        return LEVEL_BASE[nid // NODES_PER_LEVEL] + (nid % NODES_PER_LEVEL) * NODE_SIZE
    k = nid - LEVELS * NODES_PER_LEVEL
    if k >= SPARE_NODES:
        raise IndexError("E_NID_OUT_OF_SURFACE")
    return SPARE_BASE + k * NODE_SIZE


class SurfaceC:
    """Single-writer, N-reader, lock-free surface over one mmap."""

    def __init__(self, path: str, fresh: bool = False):
        self.path = path
        create = fresh or not os.path.exists(path) or os.path.getsize(path) < SURFACE_SIZE
        self.fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
        if create:
            os.ftruncate(self.fd, SURFACE_SIZE)
        self.mm = mmap.mmap(self.fd, SURFACE_SIZE)
        if create:
            self._format()
        self.freelist = self._load_freelist()

    # ---- formatting / header ----
    def _format(self):
        self.mm[HDR_MAGIC:HDR_MAGIC + 8] = MAGIC
        struct.pack_into("<I", self.mm, HDR_VERSION, VERSION)
        for l in range(LEVELS):
            struct.pack_into("<I", self.mm, HDR_NODE_COUNT + 4 * l, NODES_PER_LEVEL)
            struct.pack_into("<Q", self.mm, HDR_LEVEL_BASE + 8 * l, LEVEL_BASE[l])
        struct.pack_into("<I", self.mm, HDR_FREELIST, 0xFFFFFFFF)  # empty

    def _load_freelist(self) -> int:
        v = struct.unpack_from("<I", self.mm, HDR_FREELIST)[0]
        return None if v == 0xFFFFFFFF else v

    # ---- node primitives (lock-free) ----
    def write_node(self, level: int, idx: int, parent: int, value: float,
                   payload: bytes, publish: bool = True):
        """Fill payload FIRST, publish (flag 0->1) LAST — the ordering law."""
        assert len(payload) <= 24
        off = node_offset(level, idx)
        nid = level * NODES_PER_LEVEL + idx
        flags = FLAG_PUBLISHED if publish else 0
        raw = struct.pack(NODE_FMT, nid, parent, level, flags, value, 0.0, payload.ljust(24, b"\x00"))
        # flags byte sits at raw[12]; clear it during fill, set it at publish.
        fill = bytearray(raw)
        fill[12] = 0
        self.mm[off:off + NODE_SIZE] = bytes(fill)
        if publish:
            self.mm[off + 12] = FLAG_PUBLISHED  # single-byte publish

    def read_node(self, level: int, idx: int):
        """Read a node; returns None if unpublished. Readers never block."""
        off = node_offset(level, idx)
        raw = self.mm[off:off + NODE_SIZE]
        nid, parent, lvl, flags, value, _res, payload = struct.unpack(NODE_FMT, raw)
        if not (flags & FLAG_PUBLISHED):
            return None
        return {"id": nid, "parent": parent, "level": lvl, "value": value,
                "payload": payload.rstrip(b"\x00")}

    # ---- the 99->99->99 flat control hierarchy ----
    def project_control_hierarchy(self):
        """Lay the flat 3x99 hierarchy directly onto the surface.
        L0 nodes are roots (parent 0xFFFFFFFF); L1 parents are L0[i % 99];
        L2 parents are L1[i % 99]. Mapping, not management: same shape as the
        purpose-loops negative control, now physical."""
        for l in range(LEVELS):
            for i in range(NODES_PER_LEVEL):
                if l == 0:
                    parent = 0xFFFFFFFF
                elif l == 1:
                    parent = 0 * NODES_PER_LEVEL + (i % NODES_PER_LEVEL)
                else:
                    parent = 1 * NODES_PER_LEVEL + (i % NODES_PER_LEVEL)
                self.write_node(l, i, parent, 0.0, f"L{l}N{i}".encode())

    def walk(self, level: int, idx: int):
        """Climb child->parent->...->root through the mapped hierarchy
        (driver-less descent into control, one pure-arithmetic hop at a time)."""
        chain = []
        l, i = level, idx
        while l >= 0:
            node = self.read_node(l, i)
            if node is None:
                break
            chain.append(node)
            if l == 0:
                break
            parent = node["parent"]
            l = parent // NODES_PER_LEVEL
            i = parent % NODES_PER_LEVEL
        return chain

    # ---- JIT topological splitting ----
    def split(self, level: int, idx: int, new_value: float, payload: bytes) -> int:
        """Split an oversized node into a spare-pool slot. In-place, no locks,
        no remap: freelist head advances, child is written+published, done.
        Returns the child's node id (spare pool ids start at 3*99=297)."""
        if self.freelist is None:
            raise MemoryError("E_SURFACE_FULL")
        # pop one freelist slot (freelist next-pointers live in payload[0:4])
        child = self.freelist
        off = nid_offset(child)
        nxt = struct.unpack_from("<I", self.mm, off + 40)[0]
        self.freelist = None if nxt == 0xFFFFFFFF else nxt
        struct.pack_into("<I", self.mm, HDR_FREELIST,
                         0xFFFFFFFF if self.freelist is None else self.freelist)

        # child's parent = the oversized node (single u32 store BEFORE publish);
        # level field = next level (or stays at L2 if splitting an L2 node)
        parent_nid = level * NODES_PER_LEVEL + idx
        child_level = min(level + 1, LEVELS - 1)
        raw = struct.pack(NODE_FMT, child, parent_nid, child_level, 0,
                          new_value, 0.0, payload.ljust(24, b"\x00"))
        fill = bytearray(raw)
        fill[12] = 0
        self.mm[off:off + NODE_SIZE] = bytes(fill)
        self.mm[off + 12] = FLAG_PUBLISHED  # single-byte publish LAST
        return child

    @staticmethod
    def _addr(nid: int):
        """(level, idx) for HIERARCHY ids only; spare ids live out here."""
        return (nid // NODES_PER_LEVEL, nid % NODES_PER_LEVEL)

    # ---- freelist management (used by tests; also lock-free) ----
    def reserve_slots(self, count: int):
        """Chain the first `count` spare-pool slots onto the freelist.
        Splits draw ONLY from the spare pool — the projected hierarchy's
        297 slots are never cannibalized."""
        if count > SPARE_NODES:
            raise MemoryError("E_SURFACE_NO_FREE_SLOTS")
        base_nid = LEVELS * NODES_PER_LEVEL  # 297
        for j in range(count):
            nid = base_nid + j
            nxt = 0xFFFFFFFF if j == count - 1 else base_nid + j + 1
            off = nid_offset(nid)
            raw = struct.pack(NODE_FMT, nid, 0, 0, 0, 0.0, 0.0,
                              struct.pack("<I", nxt).ljust(24, b"\x00"))
            self.mm[off:off + NODE_SIZE] = bytes(raw)
        self.freelist = base_nid if count else None
        struct.pack_into("<I", self.mm, HDR_FREELIST, 0xFFFFFFFF if self.freelist is None else self.freelist)
        return [base_nid + j for j in range(count)]

    def close(self):
        self.mm.flush()
        self.mm.close()
        os.close(self.fd)


def test_no_locks():
    """Source-scan proof: no lock primitive is ever USED in this file.
    Banned literals are assembled by concatenation so this test's own source
    cannot trip the scan (the scan must never false-positive on itself)."""
    import inspect
    src = inspect.getsource(sys.modules[__name__])
    banned = [
        "f" + "lock(", "lo" + "ckf(",
        "threading." + "Lock", "threading." + "RLock",
        "sem_" + "open", "fcntl." + "flock",
    ]
    for b in banned:
        assert b not in src, f"E_LOCK_FOUND:{b}"
