import unittest

from outfit_generation import dedupe_ranked_candidates, select_diverse_top_candidates


def _item(item_id, item_type):
    return {"id": item_id, "type": item_type}


def _sections(outer_id, top_id, bottom_id):
    return {
        "outer": _item(outer_id, "layer") if outer_id is not None else None,
        "top": _item(top_id, "top") if top_id is not None else None,
        "bottom": _item(bottom_id, "bottom") if bottom_id is not None else None,
    }


class OutfitGenerationDiversityTests(unittest.TestCase):
    def test_dedupe_ranked_candidates_keeps_highest_scoring_duplicate(self):
        ranked_candidates = [
            (12, _sections(101, 201, 301)),
            (11, _sections(101, 201, 301)),
            (10, _sections(102, 202, 302)),
        ]

        deduped = dedupe_ranked_candidates(ranked_candidates)

        self.assertEqual(len(deduped), 2)
        self.assertEqual(deduped[0][0], 12)
        self.assertEqual(deduped[1][0], 10)

    def test_select_diverse_top_candidates_caps_heavy_item_reuse_when_possible(self):
        ranked_candidates = [
            (40, _sections(101, 201, 301)),
            (39, _sections(102, 201, 302)),
            (38, _sections(103, 201, 303)),
            (37, _sections(104, 202, 304)),
            (36, _sections(105, 202, 305)),
            (35, _sections(106, 203, 306)),
        ]

        selected = select_diverse_top_candidates(ranked_candidates, 5)
        selected_top_ids = [candidate_sections["top"]["id"] for _, candidate_sections in selected]

        self.assertEqual(len(selected), 5)
        self.assertLessEqual(selected_top_ids.count(201), 2)

    def test_select_diverse_top_candidates_relaxes_cap_to_fill_requested_count(self):
        ranked_candidates = [
            (30, _sections(101, 201, 301)),
            (29, _sections(102, 201, 302)),
            (28, _sections(103, 201, 303)),
        ]

        selected = select_diverse_top_candidates(ranked_candidates, 3)

        self.assertEqual(len(selected), 3)

    def test_select_diverse_top_candidates_applies_caps_to_all_sections(self):
        ranked_candidates = [
            (50, _sections(101, 201, 301)),
            (49, _sections(101, 202, 302)),
            (48, _sections(101, 203, 303)),
            (47, _sections(102, 204, 304)),
            (46, _sections(103, 205, 305)),
            (45, _sections(104, 206, 306)),
        ]

        selected = select_diverse_top_candidates(ranked_candidates, 5)
        selected_outer_ids = [candidate_sections["outer"]["id"] for _, candidate_sections in selected]

        self.assertEqual(len(selected), 5)
        self.assertLessEqual(selected_outer_ids.count(101), 2)


if __name__ == "__main__":
    unittest.main()