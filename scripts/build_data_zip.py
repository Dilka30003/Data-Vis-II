"""Package active clean tables and map geometry, excluding retired tile data."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "data/manifest.json").read_text())
files = [root / "data" / e["file"] for e in manifest["files"]]
files += [root / "data" / name for name in [
    "manifest.json", "australian_states.geojson", "map_methods.json",
    "victoria_hexbins_2026.geojson"]]
files += [root / name for name in ["DATA_GUIDE.md", "ADVANCED_IDIOMS.md", "MAP_IDIOMS.md"]]
with ZipFile(root / "australian-smartphone-clean-data.zip", "w", ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.relative_to(root))
print(f"Packaged {len(manifest['files'])} active CSV files and supporting geography/methods.")
