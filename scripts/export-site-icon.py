"""Export the generated mark as browser and header assets without changing its design."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / "docs" / "branding" / "dofus-stuffer-icon-source.png"
public = root / "apps" / "web" / "public"
brand = public / "brand"
brand.mkdir(parents=True, exist_ok=True)

with Image.open(source) as image:
    icon = image.convert("RGBA")
    if icon.width != icon.height or icon.getextrema()[3][0] != 0:
        raise ValueError("The source icon must be square and have a transparent background.")
    for size, destination in [
        (16, public / "favicon-16.png"),
        (32, public / "favicon-32.png"),
        (180, public / "apple-touch-icon.png"),
        (192, brand / "dofus-stuffer-icon-192.png"),
        (512, brand / "dofus-stuffer-icon-512.png"),
    ]:
        icon.resize((size, size), Image.Resampling.LANCZOS).save(destination, optimize=True)
    icon.save(public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("Browser icons exported with their original transparency.")
