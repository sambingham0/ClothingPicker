def normalize_token(value):
	if value is None:
		return ""

	return str(value).strip().lower()


def list_tokens(value):
	if value is None:
		return []

	if isinstance(value, list):
		values = value
	elif isinstance(value, str):
		values = value.split(",")
	else:
		values = [value]

	return [token for token in (normalize_token(part) for part in values) if token]


def to_float(value):
	try:
		return float(value)
	except (TypeError, ValueError):
		return None


def split_csv_field(value):
	return list_tokens(value)