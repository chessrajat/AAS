import importlib
import tempfile
from pathlib import Path

from django.test import Client, SimpleTestCase, override_settings
from django.urls import clear_url_caches


class MediaServingTests(SimpleTestCase):
    def test_serve_media_files_setting_exposes_media_urls_when_debug_is_false(self):
        with tempfile.TemporaryDirectory() as media_root:
            Path(media_root, 'example.txt').write_text('media file', encoding='utf-8')

            with override_settings(
                DEBUG=False,
                SERVE_MEDIA_FILES=True,
                MEDIA_ROOT=media_root,
                MEDIA_URL='/media/',
                ROOT_URLCONF='aas.urls',
            ):
                import aas.urls

                clear_url_caches()
                importlib.reload(aas.urls)
                try:
                    response = Client().get('/media/example.txt')
                finally:
                    clear_url_caches()
                    importlib.reload(aas.urls)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), b'media file')
