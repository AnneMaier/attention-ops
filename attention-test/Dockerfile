# Dockerfile
FROM python:3.9-slim

WORKDIR /app

# 필요한 패키지 설치
RUN pip install websockets

# 소스 코드 복사
COPY python_server.py .

# 포트 노출 (K6가 접근할 포트)
EXPOSE 9002

# 서버 실행 (버퍼링 없이 출력되도록 -u 옵션 사용)
CMD ["python", "-u", "python_server.py"]