#!/usr/bin/env bash
set -euo pipefail

input_path="${1:?Eingangsbild fehlt}"
output_path="${2:?Ausgabe-PNG fehlt}"
target_bytes=614400
hard_limit_bytes=819200

command -v magick >/dev/null || {
  echo "ImageMagick (magick) fehlt." >&2
  exit 1
}
test -f "$input_path" || {
  echo "Eingangsbild fehlt: $input_path" >&2
  exit 1
}

output_dir="$(dirname "$output_path")"
mkdir -p "$output_dir"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/podcast-cover.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

selected=""
for colors in 256 192 128; do
  candidate="$work_dir/cover-${colors}.png"
  magick "$input_path" -auto-orient -resize '1024x1024^' \
    -gravity center -extent 1024x1024 -strip -colors "$colors" "PNG8:$candidate"
  size="$(stat -f '%z' "$candidate")"
  selected="$candidate"
  if [ "$size" -le "$target_bytes" ]; then
    break
  fi
done

size="$(stat -f '%z' "$selected")"
if [ "$size" -gt "$hard_limit_bytes" ]; then
  echo "Optimiertes Cover ist mit ${size} Bytes groesser als 800 KB." >&2
  exit 1
fi

dimensions="$(magick identify -format '%wx%h' "$selected")"
test "$dimensions" = "1024x1024" || {
  echo "Unerwartete Abmessungen: $dimensions" >&2
  exit 1
}

cp "$selected" "$output_path"
echo "$output_path ($dimensions, $size Bytes)"
