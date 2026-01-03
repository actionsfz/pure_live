# Use Dart official image for building
FROM pure_live_server_build:latest AS build

RUN rm -rf /app

WORKDIR /app

# Install native build tools
RUN apt-get update && apt-get install -y clang cmake ninja-build pkg-config libgtk-3-dev && rm -rf /var/lib/apt/lists/*

# Copy server pubspec
COPY pubspec_server.yaml pubspec.yaml
# Copy local packages (shims)
COPY packages packages

RUN dart pub get

# Copy source code
COPY lib lib
COPY bin bin
COPY web web
COPY assets assets

# Compile the server using dart build (native assets support)
# This outputs to bin/server/server (on Linux)
RUN dart build cli bin/server.dart -o bin/server/server


# Build the runtime image
FROM debian:stable-slim

# Install dependencies for native libs if needed (e.g. ca-certificates, libc)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled executable and native assets
COPY --from=build /app/bin/server/server /app/bin/server

# Copy web assets
COPY --from=build /app/web /app/web

# Create data directory for volume mapping
RUN mkdir -p /app/data

# Environment variables
ENV PORT=9080

# Expose port
EXPOSE 9080

# Entry point
CMD ["/app/bin/server/bundle/bin/server"]


