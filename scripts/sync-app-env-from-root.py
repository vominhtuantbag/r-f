from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def main() -> None:
    root = parse_env(ROOT / ".env")
    url = root.get("EXPO_PUBLIC_SUPABASE_URL", "")
    key = root.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
    maps = root.get("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", "")

    for variant in ("rider", "driver", "partner"):
        path = ROOT / "apps" / variant / ".env"
        text = f"""EXPO_PUBLIC_APP_VARIANT={variant}
EXPO_PUBLIC_MOCK_MODE=false
EXPO_PUBLIC_SUPABASE_URL={url}
EXPO_PUBLIC_SUPABASE_ANON_KEY={key}
EXPO_PUBLIC_REALTIME_DRIVER=supabase
EXPO_PUBLIC_TRACKING_WEB_BASE_URL=http://localhost:3000/track
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY={maps}
EXPO_PUBLIC_BRAND_PRIMARY=#24B8C4
EXPO_PUBLIC_BRAND_SECONDARY=#1BA8B5
EXPO_PUBLIC_BRAND_NAME=GOXE
EXPO_PUBLIC_DEFAULT_LOCALE=vi
EXPO_PUBLIC_DEFAULT_CURRENCY=VND
"""
        path.write_text(text, encoding="utf-8")
        print(
            f"updated {path} mock=false has_url={bool(url)} key_prefix={key[:18] if key else 'EMPTY'}"
        )


if __name__ == "__main__":
    main()
