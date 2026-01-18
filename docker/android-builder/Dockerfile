# Android builder image for WebView wrapper APK builds
# Uses Gradle base image + Android SDK commandline tools.

FROM gradle:8.7-jdk17

USER root

ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget unzip \
  && rm -rf /var/lib/apt/lists/*

# Install Android command line tools
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
  && cd /tmp \
  && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip \
  && unzip -q cmdline-tools.zip \
  && mv cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
  && rm -f cmdline-tools.zip

# Accept licenses and install required SDK packages
RUN yes | sdkmanager --licenses >/dev/null \
  && sdkmanager --install \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
  && rm -rf ${ANDROID_SDK_ROOT}/.android

USER gradle

WORKDIR /work
