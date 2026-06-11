import glm
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

            result = glm.load(glm_path)
            glm_dicts[filename.split(".")[0] + ".json"] = result

        return glm_dicts

    def json_to_glm(self, data, tmpdir):
        for filename in data.keys():
            glm_filename = filename if filename.endswith(".glm") else filename.replace(".json", ".glm")
            filepath = os.path.join(tmpdir, glm_filename)
            with open(filepath, "w") as glm_file:
                glm.dump(data[filename], glm_file)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename in os.listdir(tmpdir):
                filepath = os.path.join(tmpdir, filename)
                zip_file.write(filepath, arcname=filename)

        zip_buffer.seek(0)
        return zip_buffer
