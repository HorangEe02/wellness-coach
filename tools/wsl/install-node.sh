#!/usr/bin/env bash
# Install Node (official linux-x64 build) into ~/.local/node inside WSL. No sudo. Run once: bash tools/wsl/install-node.sh
set -euo pipefail
MAJOR=${NODE_MAJOR:-26}
base="https://nodejs.org/dist/latest-v${MAJOR}.x"
file=$(curl -fsSL "$base/SHASUMS256.txt" | awk '/linux-x64\.tar\.xz$/ {print $2}')
sum=$(curl -fsSL "$base/SHASUMS256.txt" | awk -v f="$file" '$2 == f {print $1}')
tmp=$(mktemp -d)
curl -fsSL "$base/$file" -o "$tmp/$file"
echo "$sum  $tmp/$file" | sha256sum -c -
rm -rf ~/.local/node && mkdir -p ~/.local/node
tar -xJf "$tmp/$file" -C ~/.local/node --strip-components=1
rm -rf "$tmp"
# Node needs libatomic.so.1, which minimal Ubuntu lacks. Without sudo, unpack the distro package next to node instead.
if ! ldconfig -p | grep -q libatomic.so.1; then
  if sudo -n true 2>/dev/null; then sudo apt-get install -y libatomic1
  else (cd "$(mktemp -d)" && apt-get download libatomic1 && dpkg-deb -x libatomic1_*.deb x && mkdir -p ~/.local/node/lib && cp -a x/usr/lib/x86_64-linux-gnu/libatomic.so.1* ~/.local/node/lib/)
  fi
fi
grep -q '.local/node/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.bashrc
LD_LIBRARY_PATH="$HOME/.local/node/lib" ~/.local/node/bin/node -v
