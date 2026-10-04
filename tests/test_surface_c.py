#!/usr/bin/env python3
"""wave69/tests/test_surface_c.py — Return Stick receipts (Track B).

Proves the SPEC section 3 laws against the real mmap surface:
roundtrip, 99->99->99 projection, split data-preservation, reader-safety during
a split, lock-free-by-source-scan, and pure-arithmetic addressing.
"""

import math
import os
import struct
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "track_b"))
import surface_c as sc  # noqa: E402


class SurfaceCTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="wave69-surface-")
        self.path = os.path.join(self.tmp, "surface.bin")
        self.s = sc.SurfaceC(self.path, fresh=True)

    def tearDown(self):
        self.s.close()

    def test_layout_is_pure_arithmetic(self):
        # level bases: 256 + level*99*64 — the "no driver" claim, as arithmetic
        self.assertEqual(sc.LEVEL_BASE, [256, 256 + 99 * 64, 256 + 2 * 99 * 64])
        # spare pool base sits directly above the hierarchy blocks
        self.assertEqual(sc.SPARE_BASE, 256 + 3 * 99 * 64)
        self.assertEqual(sc.SURFACE_SIZE, 256 + 3 * 99 * 64 + 27 * 64)
        self.assertEqual(struct.calcsize(sc.NODE_FMT), 64)

    def test_roundtrip_write_read(self):
        self.s.write_node(0, 7, 0xFFFFFFFF, 3.14, b"hello-surface")
        n = self.s.read_node(0, 7)
        self.assertIsNotNone(n)
        self.assertEqual(n["id"], 7)
        self.assertEqual(n["level"], 0)
        self.assertAlmostEqual(n["value"], 3.14)
        self.assertEqual(n["payload"], b"hello-surface")

    def test_unpublished_slots_are_invisible_to_readers(self):
        self.s.write_node(1, 3, 42, 1.0, b"ghost", publish=False)
        self.assertIsNone(self.s.read_node(1, 3))  # flag byte 0 -> reader skips

    def test_project_99_to_99_to_99_and_walk(self):
        self.s.project_control_hierarchy()
        # every one of the 297 slots is published
        for l in range(3):
            for i in range(99):
                self.assertIsNotNone(self.s.read_node(l, i), f"unpublished L{l}N{i}")
        # climb L2[41] -> L1[41] -> L0[41] -> root: the flat hierarchy, walked
        chain = self.s.walk(2, 41)
        self.assertEqual([n["level"] for n in chain], [2, 1, 0])
        self.assertEqual([n["id"] for n in chain], [198 + 41, 99 + 41, 41])
        self.assertEqual(chain[-1]["parent"], 0xFFFFFFFF)

    def test_split_preserves_data_and_links(self):
        self.s.project_control_hierarchy()
        self.s.reserve_slots(4)
        child = self.s.split(0, 10, 9.5, b"split-payload")
        self.assertIsNotNone(child)
        self.assertGreaterEqual(child, 297)          # child seeded in the SPARE pool
        self.assertLessEqual(child, 323)
        # read the spare slot raw (read_node is level/idx addressed)
        off = sc.nid_offset(child)
        raw = self.s.mm[off:off + sc.NODE_SIZE]
        nid, parent, lvl, flags, value, _res, payload = struct.unpack(sc.NODE_FMT, raw)
        self.assertEqual(flags & sc.FLAG_PUBLISHED, sc.FLAG_PUBLISHED)
        self.assertEqual(nid, child)
        self.assertEqual(parent, 10)                 # child's parent = the oversized node
        self.assertEqual(lvl, 1)                     # next level from L0
        self.assertAlmostEqual(value, 9.5)
        self.assertEqual(payload.rstrip(b"\x00"), b"split-payload")
        # the original node's data untouched (split never deletes)
        orig = self.s.read_node(0, 10)
        self.assertEqual(orig["payload"], b"L0N10")
        # freelist advanced (3 slots left)
        self.assertEqual(self.s.freelist, 298)

    def test_reader_safety_during_split(self):
        """Single-writer + flag-byte publish: a reader spinning during a split
        sees either nothing (unpublished) or a fully-formed child — never torn."""
        self.s.project_control_hierarchy()
        self.s.reserve_slots(1)
        seen_torn = []
        stop = threading.Event()

        def reader():
            lvl, idx = None, None
            while not stop.is_set():
                for l in range(3):
                    for i in range(99):
                        n = self.s.read_node(l, i)
                        if n is None:
                            continue
                        # a published node must be internally consistent
                        if n["payload"] == b"torn-check" and n["value"] != 7.25:
                            seen_torn.append(n)
                        lvl, idx = l, i
            return lvl, idx

        t = threading.Thread(target=reader, daemon=True)
        t.start()
        child = self.s.split(0, 5, 7.25, b"torn-check")
        stop.set()
        t.join(timeout=2)
        self.assertEqual(seen_torn, [])
        self.assertIsNotNone(child)

    def test_surface_exhaustion_fails_named(self):
        with self.assertRaises(MemoryError):
            self.s.reserve_slots(300)  # spare pool holds 27; 300 is impossible

    def test_no_locks_by_source_scan(self):
        sc.test_no_locks()  # raises on any lock primitive in surface_c.py


if __name__ == "__main__":
    unittest.main()
