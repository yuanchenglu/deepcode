#!/bin/sh
set -eu

repo="yuanchenglu/deepcode"
api="https://api.github.com/repos/$repo"
release_base="https://github.com/$repo/releases/download"
install_root="${HOME}/.deepcode"
bin_dir="$install_root/bin"
binary="$bin_dir/deepcode"
manifest="$install_root/install-manifest.json"
version="${DEEPCODE_VERSION:-}"

fail() {
  printf '%s\n' "DeepCode install failed: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"

if [ -z "$version" ]; then
  version=$(curl -fsSL -H 'Accept: application/vnd.github+json' "$api/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' \
    | head -n 1)
fi
printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$' || fail "invalid release version: $version"

case "$(uname -s)" in
  Darwin) platform="darwin"; extension="zip" ;;
  Linux) platform="linux"; extension="tar.gz" ;;
  *) fail "unsupported operating system: $(uname -s)" ;;
esac

case "$(uname -m)" in
  arm64|aarch64) architecture="arm64" ;;
  x86_64|amd64) architecture="x64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

asset="deepcode-${platform}-${architecture}.${extension}"
base="$release_base/v$version"
temporary=$(mktemp -d "${TMPDIR:-/tmp}/deepcode-install.XXXXXX")
trap 'rm -rf "$temporary"' EXIT INT TERM

if [ -x "$binary" ] && "$binary" --version 2>/dev/null | grep -Fq "$version"; then
  mkdir -p "$install_root"
  cat > "$manifest.tmp" <<EOF
{
  "schema": 1,
  "product": "deepcode",
  "version": "$version",
  "files": [
    "$binary",
    "$binary.previous",
    "$manifest"
  ]
}
EOF
  mv "$manifest.tmp" "$manifest"
  printf '%s\n' "DeepCode $version is already installed."
  exit 0
fi

curl -fsSL "$base/deepcode-manifest.json" -o "$temporary/deepcode-manifest.json" || fail "release manifest download failed"
curl -fsSL "$base/deepcode-checksums.txt" -o "$temporary/deepcode-checksums.txt" || fail "checksum file download failed"
curl -fsSL "$base/$asset" -o "$temporary/$asset" || fail "release asset download failed"

grep -Eq '"product"[[:space:]]*:[[:space:]]*"deepcode"' "$temporary/deepcode-manifest.json" \
  || fail "release manifest is not owned by DeepCode"
grep -Eq '"version"[[:space:]]*:[[:space:]]*"'"$version"'"' "$temporary/deepcode-manifest.json" \
  || fail "release manifest version mismatch"
grep -Fq '"name": "'"$asset"'"' "$temporary/deepcode-manifest.json" \
  || fail "release manifest does not contain $asset"

expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$temporary/deepcode-checksums.txt")
printf '%s' "$expected" | grep -Eq '^[a-fA-F0-9]{64}$' || fail "checksum is missing for $asset"

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$temporary/$asset" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$temporary/$asset" | awk '{ print $1 }')
else
  fail "sha256sum or shasum is required"
fi
[ "$actual" = "$expected" ] || fail "checksum mismatch for $asset"

mkdir -p "$temporary/extract"
if [ "$platform" = "linux" ]; then
  tar -xzf "$temporary/$asset" -C "$temporary/extract" || fail "archive extraction failed"
else
  command -v unzip >/dev/null 2>&1 || fail "unzip is required on macOS"
  unzip -q "$temporary/$asset" -d "$temporary/extract" || fail "archive extraction failed"
fi

candidate="$temporary/extract/deepcode"
[ -f "$candidate" ] && [ ! -L "$candidate" ] || fail "archive does not contain the native deepcode binary"
[ "$(find "$temporary/extract" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "1" ] \
  || fail "archive contains unexpected files"
chmod 755 "$candidate"
"$candidate" --version 2>/dev/null | grep -Fq "$version" || fail "binary smoke test or version verification failed"

mkdir -p "$bin_dir"
staged="$bin_dir/.deepcode.new"
backup="$binary.previous"
rm -f "$staged"
cp "$candidate" "$staged"
chmod 755 "$staged"

replaced=0
rollback() {
  if [ "$replaced" = "1" ] && [ -f "$backup" ]; then
    rm -f "$binary"
    mv "$backup" "$binary"
  fi
}
trap 'rollback; rm -rf "$temporary"' EXIT INT TERM

rm -f "$backup"
if [ -e "$binary" ]; then
  mv "$binary" "$backup"
  replaced=1
fi
mv "$staged" "$binary"
"$binary" --version 2>/dev/null | grep -Fq "$version" || fail "installed binary verification failed"

cat > "$manifest.tmp" <<EOF
{
  "schema": 1,
  "product": "deepcode",
  "version": "$version",
  "files": [
    "$binary",
    "$backup",
    "$manifest"
  ]
}
EOF
mv "$manifest.tmp" "$manifest"

shell_name=$(basename "${SHELL:-sh}")
case "$shell_name" in
  zsh) shell_config="$HOME/.zshrc" ;;
  fish) shell_config="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish" ;;
  *) shell_config="$HOME/.profile" ;;
esac
mkdir -p "$(dirname "$shell_config")"
touch "$shell_config"
if ! grep -Fq '# deepcode' "$shell_config"; then
  {
    printf '\n# deepcode\n'
    if [ "$shell_name" = "fish" ]; then
      printf 'fish_add_path $HOME/.deepcode/bin\n'
    else
      printf 'export PATH="$HOME/.deepcode/bin:$PATH"\n'
    fi
  } >> "$shell_config"
fi

replaced=0
trap 'rm -rf "$temporary"' EXIT INT TERM
printf '%s\n' "DeepCode $version installed at $binary"
