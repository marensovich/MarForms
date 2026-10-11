# syntax=docker/dockerfile:1
# Backend image: build the boot jar, run it on a JRE as a non-root user.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test && cp build/libs/*-SNAPSHOT.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 marforms && mkdir -p /data/uploads && chown marforms /data/uploads
USER marforms
COPY --from=build /app.jar /app/app.jar
ENV FILES_DIR=/data/uploads \
    SPRING_DOCKER_COMPOSE_ENABLED=false
VOLUME /data/uploads
EXPOSE 8090
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
