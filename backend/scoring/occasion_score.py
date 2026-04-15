from scoring.utils import list_tokens

def score_occasion(outfit_sections):
	top = (outfit_sections or {}).get("top")
	bottom = (outfit_sections or {}).get("bottom")

	if not top or not bottom:
		return 0, []

	top_occasions = set(list_tokens((top or {}).get("occasion")))
	bottom_occasions = set(list_tokens((bottom or {}).get("occasion")))

	if not top_occasions or not bottom_occasions:
		return 0, ["Occasion match skipped: mission data."]

	overlap = top_occasions & bottom_occasions
	if overlap:
		return 3, [f"(+3 pts) Matched style: items both work for {', '.join(overlap)}."]

	return -4, ["(-4 pts) Style clash: items are meant for different occasions."]
