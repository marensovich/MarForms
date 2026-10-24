# syntax=docker/dockerfile:1
# MarForms in one image: the SPA is built and served by the backend itself,
# so the site and the API share one origin and one port (8090).
#   docker build -t marforms .
#   docker run -p 8090:8090 --env-file .env -v marforms_uploads:/data/uploads marforms
# Postgres runs apart (docker-compose.prod.yml), never inside this image.

FROM node:25-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty: the API is on the same origin as the page.
ENV VITE_API_URL=""
RUN npm run build

FROM eclipse-temurin:25-jdk AS backend
WORKDIR /src
COPY backend/gradlew backend/settings.gradle backend/build.gradle ./
COPY backend/gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null
COPY backend/src src
COPY --from=frontend /src/dist src/main/resources/static
# The commit for «О системе» (#147): there is no .git in the build context.
ARG GIT_COMMIT=""
RUN GIT_COMMIT=$GIT_COMMIT ./gradlew --no-daemon bootJar -x test && cp build/libs/backend-*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 marforms && mkdir -p /data/uploads && chown marforms /data/uploads
USER marforms
COPY --from=backend /app.jar /app/app.jar
# Behind a TLS proxy the visitor's scheme and address come in X-Forwarded-*;
# Tomcat trusts them only from private networks.
ENV FILES_DIR=/data/uploads \
    SPRING_DOCKER_COMPOSE_ENABLED=false \
    SERVER_FORWARD_HEADERS_STRATEGY=native \
    FRONTEND_URL=http://localhost:8090
VOLUME /data/uploads
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8090 && printf "GET /api/health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && head -1 <&3 | grep -q " 200 "'
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
