from scoring.utils import list_tokens


_OCCASION_ALIASES = {
    "athletic": "sport",
    "active": "sport",
    "activewear": "sport",
}


_OCCASION_FAMILY = {
    "casual": "casual",
    "sport": "active",
    "business": "dressy",
    "formal": "dressy",
}


def _normalize_occasion(token):
    if not token:
        return None
    token = str(token).strip().lower()
    token = _OCCASION_ALIASES.get(token, token)
    return token if token in {"casual", "sport", "business", "formal"} else token


def _occasion_set(item):
    return {_normalize_occasion(token) for token in list_tokens((item or {}).get("occasion")) if _normalize_occasion(token)}


def _family(occasion):
    return _OCCASION_FAMILY.get(occasion)


def _format_occasions(values):
    return ", ".join(sorted(values))


def _pair_bonus_for_overlap(overlap):
    if not overlap:
        return 0


    if overlap & {"business", "formal"}:
        return 4
    if overlap & {"sport"}:
        return 3
    if overlap & {"casual"}:
        return 2
    return 0


def _pair_score(left, right, pair_label, pair_weight=1.0):
    left = set(left or set())
    right = set(right or set())


    if not left or not right:
        return 0, None


    overlap = left & right
    if overlap:
        bonus = _pair_bonus_for_overlap(overlap)
        if bonus <= 0:
            return 0, None
        scaled_bonus = max(1, round(bonus * pair_weight))
        return scaled_bonus, (
            f"(+{scaled_bonus} pts) {pair_label}: shared occasion fit for {_format_occasions(overlap)}."
        )


    best_score = 0
    best_reason = None


    for occasion_a in left:
        for occasion_b in right:
            if occasion_a == occasion_b:
                continue


            family_a = _family(occasion_a)
            family_b = _family(occasion_b)


            if {occasion_a, occasion_b} == {"casual", "sport"}:
                score = 1
                reason = f"(+1 pt) {pair_label}: casual and sport can blend cleanly."
            elif family_a == family_b == "dressy":
                score = 1
                reason = f"(+1 pt) {pair_label}: business and formal lean in the same dressy direction."
            elif family_a == family_b == "active":
                score = 1
                reason = f"(+1 pt) {pair_label}: activewear and sport pieces work together."
            elif "casual" in {occasion_a, occasion_b} and family_a != family_b:
                score = -2
                reason = f"(-2 pts) {pair_label}: casual styling and dressier pieces do not fully line up."
            elif "sport" in {occasion_a, occasion_b} and "dressy" in {family_a, family_b}:
                score = -4
                reason = f"(-4 pts) {pair_label}: sport and dressy pieces clash."
            elif {family_a, family_b} == {"active", "dressy"}:
                score = -4
                reason = f"(-4 pts) {pair_label}: active and dressy pieces clash."
            elif {occasion_a, occasion_b} == {"business", "formal"}:
                score = 1
                reason = f"(+1 pt) {pair_label}: business and formal are close enough to work together."
            else:
                score = 0
                reason = None


            scaled_score = round(score * pair_weight)
            if scaled_score > best_score:
                best_score = scaled_score
                best_reason = reason.replace(f"(+{score} pt)", f"(+{scaled_score} pt)") if reason and score > 0 and scaled_score != score else reason
                if best_reason and scaled_score > 0 and "(+1 pt)" in best_reason and scaled_score != 1:
                    best_reason = best_reason.replace("(+1 pt)", f"(+{scaled_score} pts)")


    return best_score, best_reason


def score_occasion(outfit_sections):
    top = (outfit_sections or {}).get("top")
    bottom = (outfit_sections or {}).get("bottom")
    outer = (outfit_sections or {}).get("outer")


    if not top or not bottom:
        return 0, []


    top_occasions = _occasion_set(top)
    bottom_occasions = _occasion_set(bottom)
    outer_occasions = _occasion_set(outer) if outer else set()


    if not top_occasions or not bottom_occasions:
        return 0, ["Occasion match skipped: missing data."]


    reasons = []
    score = 0


    top_bottom_score, top_bottom_reason = _pair_score(top_occasions, bottom_occasions, "Top + Bottom", pair_weight=1.0)
    score += top_bottom_score
    if top_bottom_reason:
        reasons.append(top_bottom_reason)


    if outer_occasions:
        outer_top_score, outer_top_reason = _pair_score(outer_occasions, top_occasions, "Outer + Top", pair_weight=0.75)
        outer_bottom_score, outer_bottom_reason = _pair_score(outer_occasions, bottom_occasions, "Outer + Bottom", pair_weight=0.75)
        score += outer_top_score + outer_bottom_score
        if outer_top_reason:
            reasons.append(outer_top_reason)
        if outer_bottom_reason:
            reasons.append(outer_bottom_reason)


    shared_all = top_occasions & bottom_occasions & outer_occasions if outer_occasions else set()
    if shared_all:
        all_bonus = 2
        if shared_all & {"business", "formal"}:
            all_bonus = 3
        score += all_bonus
        reasons.append(f"(+{all_bonus} pts) Whole outfit: all pieces support {_format_occasions(shared_all)}.")


    if score == 0:
        return 0, ["Occasion match skipped: missing data."]


    return score, reasons
