import unittest

from services import spotify_helpers


class SpotifyHelpersTests(unittest.TestCase):
    def test_spotify_embed_url_from_uri_for_spotify_uri(self):
        result = spotify_helpers.spotify_embed_url_from_uri("spotify:album:abc123")
        self.assertEqual(result, "https://open.spotify.com/embed/album/abc123")

    def test_spotify_embed_url_from_uri_for_open_url(self):
        result = spotify_helpers.spotify_embed_url_from_uri("https://open.spotify.com/track/xyz789")
        self.assertEqual(result, "https://open.spotify.com/embed/track/xyz789")

    def test_decode_spotify_error_prefers_error_description(self):
        text = '{"error": "invalid_grant", "error_description": "Token expired"}'
        result = spotify_helpers.decode_spotify_error(text, fallback="fallback")
        self.assertEqual(result, "Token expired")


if __name__ == "__main__":
    unittest.main()
