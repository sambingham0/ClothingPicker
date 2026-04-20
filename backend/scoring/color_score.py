from scoring.utils import list_tokens

CANONICAL_COLOR_MAP = {
	"grey": "gray",
	"khaki": "tan",
	"cream": "white",
	"denim": "blue",
	"burgundy": "red",
}

NEUTRAL_COLORS = {
	"black",
	"white",
	"gray",
	"navy",
	"beige",
	"tan",
	"brown",
}

COLOR_FAMILIES = {
	"black": "neutral",
	"white": "neutral",
	"gray": "neutral",
	"navy": "neutral",
	"beige": "neutral",
	"tan": "neutral",
	"brown": "neutral",
	"blue": "blue",
	"teal": "blue",
	"red": "red",
	"pink": "red",
	"orange": "orange",
	"yellow": "yellow",
	"green": "green",
	"olive": "green",
	"purple": "purple",
}

COLOR_WHEEL_INDEX = {
	"red": 0,
	"orange": 1,
	"yellow": 2,
	"green": 3,
	"blue": 4,
	"purple": 5,
}

GOOD_COLOR_PAIRS = {
	frozenset({"blue", "white"}),
	frozenset({"blue", "gray"}),
	frozenset({"blue", "tan"}),
	frozenset({"blue", "pink"}),
	frozenset({"blue", "red"}),
	frozenset({"green", "tan"}),
	frozenset({"green", "beige"}),
	frozenset({"teal", "white"}),
	frozenset({"red", "black"}),
	frozenset({"red", "white"}),
	frozenset({"pink", "white"}),
	frozenset({"purple", "gray"}),
	frozenset({"orange", "white"}),
	frozenset({"yellow", "navy"}),
}

CLASH_COLOR_PAIRS = {
	frozenset({"red", "green"}),
	frozenset({"orange", "pink"}),
	frozenset({"yellow", "orange"}),
	frozenset({"purple", "orange"}),
	frozenset({"yellow", "pink"}),
	frozenset({"yellow", "teal"}),
}


def _get_primary_color(item):
	colors = list_tokens((item or {}).get("major_colors"))
	if colors:
		return _normalize_color(colors[0])

	minor_colors = list_tokens((item or {}).get("minor_colors"))
	return _normalize_color(minor_colors[0]) if minor_colors else None


def _normalize_color(color):
	if not color:
		return None
	return CANONICAL_COLOR_MAP.get(color, color)


def _get_all_colors(item):
	item = item or {}
	all_colors = [
		_normalize_color(color)
		for color in (list_tokens(item.get("major_colors")) + list_tokens(item.get("minor_colors")))
	]
	unique = []
	seen = set()
	for color in all_colors:
		if not color:
			continue
		if color in seen:
			continue
		seen.add(color)
		unique.append(color)
	return unique


def _is_neutral(color):
	return color in NEUTRAL_COLORS


def _get_primary_colors(outfit_sections):
	primary_colors = []
	for section_id in ("outer", "top", "bottom"):
		item = (outfit_sections or {}).get(section_id)
		color = _get_primary_color(item)
		if color:
			primary_colors.append(color)
	return primary_colors


def _get_color_family(color):
	if not color:
		return None
	canonical = _normalize_color(color)
	if canonical in NEUTRAL_COLORS:
		return "neutral"
	return COLOR_FAMILIES.get(canonical, canonical)


def _has_accent_colors(item, primary_color):
	all_colors = set(_get_all_colors(item))
	return bool(all_colors - {primary_color})


def _score_color_pair(color_a, color_b, pair_label):
	if not color_a or not color_b:
		return 0, None

	color_a = _normalize_color(color_a)
	color_b = _normalize_color(color_b)

	if color_a == color_b:
		if _is_neutral(color_a):
			return 2, f"(+2 pts) {pair_label}: matching neutral tones stay clean and consistent."
		return 1, f"(+1 pt) {pair_label}: monochromatic pairing is cohesive."

	pair = frozenset({color_a, color_b})
	if pair in CLASH_COLOR_PAIRS:
		return -4, f"(-4 pts) {pair_label}: this color combo is likely to clash."

	if _is_neutral(color_a) or _is_neutral(color_b):
		return 2, f"(+2 pts) {pair_label}: a neutral anchors the stronger color."

	if pair in GOOD_COLOR_PAIRS:
		return 2, f"(+2 pts) {pair_label}: known high-compatibility color pair."

	family_a = _get_color_family(color_a)
	family_b = _get_color_family(color_b)

	if family_a == family_b:
		return 1, f"(+1 pt) {pair_label}: colors stay within one family."

	index_a = COLOR_WHEEL_INDEX.get(family_a)
	index_b = COLOR_WHEEL_INDEX.get(family_b)
	if index_a is not None and index_b is not None:
		distance = min(abs(index_a - index_b), 6 - abs(index_a - index_b))
		if distance in {1, 3}:
			return 1, f"(+1 pt) {pair_label}: color-wheel relationship is workable."
		if distance == 2:
			return 0, None

	return 0, None

def score_colors(outfit_sections):
	top = (outfit_sections or {}).get("top")
	bottom = (outfit_sections or {}).get("bottom")
	outer = (outfit_sections or {}).get("outer")

	if not top or not bottom:
		return 0, ["Color scoring skipped because top or bottom is missing."]

	top_color = _get_primary_color(top)
	bottom_color = _get_primary_color(bottom)
	outer_color = _get_primary_color(outer)

	if not top_color or not bottom_color:
		return 0, ["Color scoring skipped because color data is incomplete."]

	score = 0
	reasons = [f"Primary colors: top={top_color}, bottom={bottom_color}, outer={outer_color}."]

	pair_definitions = [
		("Top + Bottom", top_color, bottom_color),
		("Outer + Top", outer_color, top_color),
		("Outer + Bottom", outer_color, bottom_color),
	]

	for pair_label, color_a, color_b in pair_definitions:
		delta, reason = _score_color_pair(color_a, color_b, pair_label)
		if delta == 0:
			continue

		score += delta
		if reason:
			reasons.append(reason)

	if _has_accent_colors(top, top_color) or _has_accent_colors(bottom, bottom_color):
		score += 1
		reasons.append("(+1 pt) Accent colors add depth beyond the base tones.")

	primary_colors = _get_primary_colors(outfit_sections)
	all_same_major_color = len(primary_colors) >= 3 and len(set(primary_colors)) == 1

	top_palette = set(_get_all_colors(top))
	bottom_palette = set(_get_all_colors(bottom))
	if top_palette and bottom_palette and (top_palette & bottom_palette) and not all_same_major_color:
		score += 1
		reasons.append("(+1 pt) Top and bottom share at least one color across major/minor palettes.")

	primary_families = {_get_color_family(color) for color in primary_colors if color}
	non_neutral_families = {family for family in primary_families if family and family != "neutral"}
	has_neutral_anchor = any(_is_neutral(color) for color in primary_colors)

	if all_same_major_color:
		score -= 3
		reasons.append(
			"(-3 pts) All three major colors are the same; introducing one contrasting piece usually improves balance."
		)

	if outer_color and bottom_color and top_color and outer_color == bottom_color and top_color != outer_color:
		if frozenset({top_color, outer_color}) not in CLASH_COLOR_PAIRS:
			score += 1
			reasons.append(
				"(+1 pt) Sandwich palette: matching outer + bottom with a different top adds intentional contrast."
			)

	if len(primary_colors) >= 3 and len(non_neutral_families) == 1:
		score -= 1
		reasons.append("(-1 pt) All pieces lean on one strong family, which can look a little flat.")

	if len(primary_colors) >= 3 and len(non_neutral_families) >= 3 and not has_neutral_anchor:
		score -= 2
		reasons.append("(-2 pts) Too many bold families without a neutral anchor can clash.")

	return score, reasons
