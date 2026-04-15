from scoring.utils import list_tokens

NEUTRAL_COLORS = {"black", "white", "gray", "grey", "navy", "beige", "tan"}
COLOR_FAMILIES = {
	"blue": {"blue", "navy"},
	"red": {"red", "pink"},
	"green": {"green", "olive"},
	"brown": {"brown", "beige", "tan"},
}
GOOD_COLOR_PAIRS = {
	frozenset({"blue", "white"}),
	frozenset({"blue", "gray"}),
	frozenset({"navy", "white"}),
	frozenset({"navy", "tan"}),
	frozenset({"green", "tan"}),
	frozenset({"green", "beige"}),
	frozenset({"red", "black"}),
	frozenset({"red", "white"}),
	frozenset({"pink", "white"}),
	frozenset({"brown", "beige"}),
}
CLASH_COLOR_PAIRS = {
	frozenset({"red", "green"}),
	frozenset({"orange", "pink"}),
	frozenset({"yellow", "orange"}),
	frozenset({"purple", "orange"}),
}


def _get_primary_color(item):
	colors = list_tokens((item or {}).get("major_colors"))
	if colors:
		return colors[0]

	minor_colors = list_tokens((item or {}).get("minor_colors"))
	return minor_colors[0] if minor_colors else None


def _get_all_colors(item):
	item = item or {}
	all_colors = list_tokens(item.get("major_colors")) + list_tokens(item.get("minor_colors"))
	unique = []
	seen = set()
	for color in all_colors:
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
	if color in {"blue", "navy"}:
		return "blue"
	if color in {"red", "pink"}:
		return "red"
	if color in {"green", "olive"}:
		return "green"
	if color in {"brown", "beige", "tan"}:
		return "brown"
	if color in NEUTRAL_COLORS:
		return "neutral"
	return color


def _has_accent_colors(item, primary_color):
	all_colors = set(_get_all_colors(item))
	return bool(all_colors - {primary_color})

def score_colors(outfit_sections):
	top = (outfit_sections or {}).get("top")
	bottom = (outfit_sections or {}).get("bottom")

	if not top or not bottom:
		return 0, ["Color scoring skipped because top or bottom is missing."]

	top_color = _get_primary_color(top)
	bottom_color = _get_primary_color(bottom)
	same_primary_color = top_color == bottom_color

	if not top_color or not bottom_color:
		return 0, ["Color scoring skipped because color data is incomplete."]

	score = 0
	reasons = [f"Primary colors: top={top_color}, bottom={bottom_color}."]

	if same_primary_color:
		score += 2
		reasons.append("(+2 pts) Top and bottom share the same major color.")

		if _has_accent_colors(top, top_color) or _has_accent_colors(bottom, bottom_color):
			score += 1
			reasons.append("(+1 pt) Accent colors add a little variety to the shared color scheme.")

	top_neutral = _is_neutral(top_color)
	bottom_neutral = _is_neutral(bottom_color)
	if not same_primary_color:
		if top_neutral and bottom_neutral:
			score += 2
			reasons.append("(+2 pts) Both items are neutral colors.")
		elif top_neutral or bottom_neutral:
			score += 1
			reasons.append("(+1 pt) One neutral + one stronger color gets a styling bonus.")

	pair = frozenset({top_color, bottom_color})
	if not same_primary_color:
		if pair in GOOD_COLOR_PAIRS:
			score += 2
			reasons.append("(+2 pts) Top and bottom color pair is in the compatibility map.")
		elif pair in CLASH_COLOR_PAIRS:
			score -= 4
			reasons.append("(-4 pts) Top and bottom colors are in a simple clash list.")
		elif not (top_neutral or bottom_neutral):
			# Two strong colors that aren't a known good pair or clash—usually risky.
			score -= 3
			reasons.append("(-3 pts) Two bold colors without a neutral can be risky.")

	top_palette = set(_get_all_colors(top))
	bottom_palette = set(_get_all_colors(bottom))
	if not same_primary_color and top_palette and bottom_palette and (top_palette & bottom_palette):
		score += 1
		reasons.append("(+1 pt) Top and bottom share at least one color across major/minor palettes.")

	primary_colors = _get_primary_colors(outfit_sections)
	primary_families = {_get_color_family(color) for color in primary_colors if color}
	if len(primary_colors) >= 3 and len(primary_families) == 1:
		family = next(iter(primary_families))
		if family != "neutral":
			score -= 3
		reasons.append("(-3 pts) The outfit stays in one strong color family across all pieces.")

	return score, reasons
