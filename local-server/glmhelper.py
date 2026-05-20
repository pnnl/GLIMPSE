import glm
import os
import gc
import time
import sys
import zipfile
import io


class GLMHelper:
    def __init__(self):
        self.max_file_size_mb = 5  # Prevent loading files larger than 5 MB

    def hard_reset_glm_module(self):
        """
        Force a hard reset of the GLM module by removing it from sys.modules
        and re-importing. This is necessary to clear accumulated state in the
        compiled Nim .pyd module that can cause segfaults on subsequent calls.
        """
        try:
            print("[GLM] Performing hard reset of GLM module...")

            # Remove glm from sys.modules to force a fresh import
            if "glm" in sys.modules:
                del sys.modules["glm"]
                print("[GLM] Removed glm from sys.modules")

            # Import fresh
            global glm
            import glm as glm_fresh

            glm = glm_fresh

            gc.collect()
            time.sleep(0.2)
            print("[GLM] Hard reset completed successfully")
            return True
        except Exception as e:
            print(f"[GLM] ERROR: Failed to hard reset GLM module: {e}")
            return False

    def parse_glm(self, file_paths: list) -> dict:
        glm_dicts = {}

        # Perform hard reset before processing to clear any accumulated state
        if not self.hard_reset_glm_module():
            raise RuntimeError(
                "Failed to reset GLM module - refusing to proceed to avoid segfault"
            )

        try:
            for i, glm_path in enumerate(file_paths):
                # Check file size before loading
                file_size_mb = os.path.getsize(glm_path) / (1024 * 1024)
                filename = os.path.basename(glm_path)
                print(
                    f"[GLM] Loading file {i+1}/{len(file_paths)}: {filename} ({file_size_mb:.2f} MB)..."
                )

                if file_size_mb > self.max_file_size_mb:
                    raise ValueError(
                        f"File {filename} is too large ({file_size_mb:.2f} MB). "
                        f"Maximum allowed size is {self.max_file_size_mb} MB."
                    )

                try:
                    result = glm.load(glm_path)
                    glm_dicts[os.path.basename(glm_path).split(".")[0] + ".json"] = (
                        result
                    )
                    print(f"[GLM] Successfully loaded {filename}")
                except Exception as load_error:
                    print(f"[GLM] Error loading {filename}: {load_error}")
                    raise

                # Force cleanup after each file to prevent memory accumulation
                gc.collect()
                time.sleep(0.05)

        finally:
            # Force garbage collection multiple times to ensure cleanup
            print("[GLM] Starting final cleanup...")
            for i in range(3):
                gc.collect()
                time.sleep(0.1)
            print("[GLM] Final cleanup complete")

        return glm_dicts

    def json_to_glm(self, data, tmpdir):
        # Convert JSON to GLM files in the temp directory
        for filename in data.keys():
            # Ensure the filename ends with .glm
            glm_filename = filename if filename.endswith(".glm") else filename.replace(".json", ".glm")
            filepath = os.path.join(tmpdir, glm_filename)
            with open(filepath, "w") as glm_file:
                glm.dump(data[filename], glm_file)

        # Create a zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename in os.listdir(tmpdir):
                filepath = os.path.join(tmpdir, filename)
                zip_file.write(filepath, arcname=filename)

        zip_buffer.seek(0)

        return zip_buffer
