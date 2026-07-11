"""
Generate the PINNED anchor-axis constants for the on-device constellation.

Produces, from the canonical model (distiluse-base-multilingual-cased-v2, 512-d):
  - 3 x 512 anchor axis vectors  (valence, inward, arousal)
  - per-axis GAIN so tanh(GAIN*dot) maps a typical day well inside the cube
    (target: p95(|dot|) -> tanh output ~0.7)
Emits a ready-to-paste Swift constant file.
"""
import numpy as np
from sentence_transformers import SentenceTransformer

TARGET = 0.7  # p95(|dot|) should land near this after tanh

PHRASES = {
    "valence": {
        "pos": ["joy", "happiness", "gratitude", "love", "hope", "delight", "peace", "contentment"],
        "neg": ["sadness", "grief", "fear", "anguish", "despair", "loneliness", "dread", "pain"],
    },
    "inward": {
        "pos": ["my inner feelings", "reflection", "introspection", "my thoughts",
                "self awareness", "meaning and purpose", "my soul"],
        "neg": ["work tasks", "external events", "other people", "places and things",
                "the outside world", "practical logistics", "the news"],
    },
    "arousal": {
        "pos": ["excitement", "intensity", "passion", "adventure", "energy", "thrill", "urgency"],
        "neg": ["calm", "stillness", "quiet", "rest", "serenity", "gentleness", "slowness"],
    },
}

# representative journal-day texts to estimate the dot-product distribution for gains
SAMPLE = [
    "Shipped the auth refactor today. The team pushed hard and it finally passed review.",
    "A hard argument tonight. Old wounds resurfaced and neither of us backed down.",
    "Ran my first 10k this morning. Legs burning but I crossed the line and cried a little.",
    "The dread came back tonight, tight in my chest for no reason I can name.",
    "Painted for six hours and lost all track of time. The canvas came alive.",
    "Hiked above the treeline and the whole valley opened below me. Wind, silence, vast sky.",
    "Called mom for an hour. I felt the ache of time and how much I still want to protect her.",
    "Sat in the empty church though I do not believe, just to feel the stillness.",
    "Paid off the last of the credit card debt. Years of weight lifted.",
    "The funeral was today. Grief comes in waves I cannot schedule.",
    "Landed in a city where I speak none of the language. Lost, delighted, overstimulated.",
    "Finally understood the math I struggled with for months. The concept clicked.",
    "Nothing dramatic happened and that was the gift. Coffee, sunlight, a good book.",
    "Confronted my manager about the credit he took for my work. Boundaries are a muscle.",
]

def main():
    m = SentenceTransformer("sentence-transformers/distiluse-base-multilingual-cased-v2")
    def emb(t): return m.encode(list(t), normalize_embeddings=True, show_progress_bar=False)

    axes = {}
    for name, poles in PHRASES.items():
        d = emb(poles["pos"]).mean(0) - emb(poles["neg"]).mean(0)
        axes[name] = d / (np.linalg.norm(d) + 1e-12)

    order = ["valence", "inward", "arousal"]
    A = np.stack([axes[k] for k in order])          # (3,512)

    # orthogonality report
    cos = A @ A.T
    print("axis pairwise cosine:")
    for i in range(3):
        for j in range(i + 1, 3):
            print(f"  {order[i]}.{order[j]} = {cos[i,j]:+.3f}")

    # gains from sample dot distribution (centroid = mean of L2-normed sentence chunks)
    sample_cents = []
    for s in SAMPLE:
        chunks = [c.strip() for c in s.replace("? ", ". ").replace("! ", ". ").split(". ") if c.strip()]
        sample_cents.append(emb(chunks).mean(0))
    S = np.stack(sample_cents)                       # (n,512)
    dots = S @ A.T                                    # (n,3)
    gains = []
    for k in range(3):
        p95 = np.percentile(np.abs(dots[:, k]), 95)
        g = np.arctanh(TARGET) / max(p95, 1e-6)
        gains.append(float(g))
        print(f"gain[{order[k]}] p95|dot|={p95:.4f} -> GAIN={g:.4f}")

    # emit Swift
    def swift_arr(v): return "[" + ", ".join(f"{x:.8f}" for x in v) + "]"
    lines = []
    lines.append("// AUTO-GENERATED pinned constants — DO NOT EDIT BY HAND.")
    lines.append("// Source: generate_anchor_constants.py, model distiluse-base-multilingual-cased-v2 (512-d).")
    lines.append("// Changing any value moves every existing star. These are frozen forever.")
    lines.append("enum AnchorConstants {")
    lines.append(f"    static let gains: [Double] = [{gains[0]:.8f}, {gains[1]:.8f}, {gains[2]:.8f}]  // valence, inward, arousal")
    for k, name in enumerate(order):
        lines.append(f"    static let {name}: [Double] = {swift_arr(A[k])}")
    lines.append("    static let axes: [[Double]] = [valence, inward, arousal]")
    lines.append("}")
    swift = "\n".join(lines)
    with open("AnchorConstants.swift", "w") as f:
        f.write(swift + "\n")
    # also a JSON for the golden-test fixture
    import json
    with open("anchor_constants.json", "w") as f:
        json.dump({"order": order, "gains": gains, "axes": A.tolist()}, f)
    print("\nwrote AnchorConstants.swift and anchor_constants.json")
    print(f"axes shape {A.shape}, gains {['%.4f'%g for g in gains]}")

    # golden vectors: fixed texts -> exact (x,y,z), for the Swift regression test
    golden_texts = [
        "I feel so grateful and full of joy today, at peace with everything.",
        "A day of dread and grief, I sat alone in the dark unable to move.",
        "Buried in work tasks and logistics, back to back meetings all day.",
        "Reflecting quietly on the meaning of my life and who I am becoming.",
    ]
    print("\ngolden vectors (text -> x,y,z):")
    golden = []
    for t in golden_texts:
        chunks = [c.strip() for c in t.replace("? ", ". ").replace("! ", ". ").split(". ") if c.strip()]
        cent = emb(chunks).mean(0)
        dot = cent @ A.T
        xyz = [float(np.tanh(gains[k] * dot[k])) for k in range(3)]
        golden.append({"text": t, "xyz": xyz})
        print(f"  {xyz[0]:+.4f} {xyz[1]:+.4f} {xyz[2]:+.4f}  | {t[:50]}")
    with open("golden_vectors.json", "w") as f:
        json.dump(golden, f, indent=2)
    print("wrote golden_vectors.json")

if __name__ == "__main__":
    main()
