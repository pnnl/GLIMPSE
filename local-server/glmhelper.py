from glmparser import dump as glm_dump
from glmparser import load as glm_load
from werkzeug.utils import secure_filename
import os
import zipfile
import io


class GLMHelper:
    def __init__(self):
        self.max_file_size_mb = 5

    def parse_glm(self, file_paths: list) -> dict:
        glm_dicts = {}
        for glm_path in file_paths:
            file_size_mb = os.path.getsize(glm_path) / (1024 * 1024)
            filename = os.path.basename(glm_path)

            if file_size_mb > self.max_file_size_mb:
                raise ValueError(
                    f"File {filename} is too large ({file_size_mb:.2f} MB). "
                    f"Maximum allowed size is {self.max_file_size_mb} MB."
                )

            result = glm_load(glm_path)
            glm_dicts[filename.split(".")[0] + ".json"] = result

        return glm_dicts

    @staticmethod
    def _export_filename(filename, index, taken):
        """A safe, unique .glm name for a client-supplied key.

        These keys come straight from the request body, so they are treated as
        hostile: secure_filename flattens any directory part away, which is what
        keeps the write inside tmpdir. It also strips non-ASCII entirely, so a
        name it reduces to nothing falls back to a positional one rather than
        failing the export — and names that collide after sanitizing are
        suffixed, so one can never overwrite another.
        """
        base = secure_filename(
            filename if filename.endswith(".glm") else filename.replace(".json", ".glm")
        )
        stem = base[:-4] if base.endswith(".glm") else base
        if not stem:
            stem = f"model-{index + 1}"

        candidate = f"{stem}.glm"
        suffix = 2
        while candidate in taken:
            candidate = f"{stem}-{suffix}.glm"
            suffix += 1

        taken.add(candidate)
        return candidate

    def json_to_glm(self, data, tmpdir):
        base_dir = os.path.abspath(tmpdir)
        taken = set()

        for index, filename in enumerate(data.keys()):
            glm_filename = self._export_filename(filename, index, taken)

            filepath = os.path.abspath(os.path.join(base_dir, glm_filename))
            # Belt and braces: secure_filename should already make this impossible.
            if os.path.commonpath([filepath, base_dir]) != base_dir:
                raise ValueError(f"{filename!r} resolves outside the export directory.")

            with open(filepath, "w") as glm_file:
                glm_dump(data[filename], glm_file)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename in os.listdir(tmpdir):
                filepath = os.path.join(tmpdir, filename)
                zip_file.write(filepath, arcname=filename)

        zip_buffer.seek(0)
        return zip_buffer
