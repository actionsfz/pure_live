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
COPY server server
COPY assets assets

# Debug: List directory structure
RUN echo "=== Listing /app ===" && ls -la /app && \
    echo "=== Listing /app/server ===" && ls -la /app/server && \
    echo "=== Checking for server.dart ===" && \
    if [ -f "server/server.dart" ]; then echo "Found server/server.dart"; else echo "NOT FOUND: server/server.dart"; fi

# Compile the server using dart build (native assets support)
# Output to 'build' directory to avoid deleting source 'server' directory
# This outputs to build/bin/server.exe (on Windows) or build/bin/server (on Linux)
RUN dart build cli -t server/server.dart -o build


# Build the runtime image
FROM debian:stable-slim

# Install dependencies for native libs if needed (e.g. ca-certificates, libc)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled executable and native assets
COPY --from=build /app/build/bundle/bin/server /app/server

# Copy web static files
COPY --from=build /app/server/web /app/web

# Create data directory for volume mapping
RUN mkdir -p /app/data

# Environment variables
ENV PORT=9080

# Expose port
EXPOSE 9080

# Entry point
CMD ["/app/server"]


