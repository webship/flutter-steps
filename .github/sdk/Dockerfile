# The Flutter SDK the sample apps are built with: Debian (bookworm, slim) pinned by its digest, the
# official Flutter stable archive checked against the checksum of Flutter's release list, and the web
# artifacts fetched once, in one layer. Nothing for Android, iOS or the desktop. A build runs as root
# in a throwaway container and gives the files it wrote back to the host user before it ends.
FROM debian:bookworm-slim@sha256:e67eeead736ff7bbe258ef088bff683635c561b1fcfefad0806c1df4ab49ce0e

ARG FLUTTER_VERSION=3.50.1
ARG FLUTTER_SHA256=4ad17fc8462fbcef2ba19ff4a78c0a16b7147fde1add8578e267ea62cdb92678

ENV PATH="/opt/flutter/bin:${PATH}" \
    FLUTTER_SUPPRESS_ANALYTICS=true \
    PUB_CACHE=/opt/pub-cache

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /tmp/flutter.tar.xz "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
 && echo "${FLUTTER_SHA256}  /tmp/flutter.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/flutter.tar.xz -C /opt \
 && rm /tmp/flutter.tar.xz \
 && git config --system --add safe.directory '*' \
 && flutter config --no-analytics --no-cli-animations \
 && flutter precache --web --no-android --no-ios --no-linux --no-windows --no-macos --no-fuchsia \
 && flutter --version

WORKDIR /work
