import redis
import os
import json
import time
import datetime  # <--- [수정 1] 누락된 import 추가
from pymongo import MongoClient, errors
import sys

# --- 환경 설정 ---
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))

MONGO_HOST = os.getenv('MONGO_HOST')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017)) # 기본값 추가 안전장치
MONGO_USER = os.getenv('MONGO_USER')
MONGO_PASSWORD = os.getenv('MONGO_PASSWORD')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME')
CHANNELS = os.getenv('REDIS_CHANNEL_NAME')

MONGO_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"

if not all([MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB_NAME]):
    print("🔴 치명적 에러: MongoDB 접속을 위한 환경 변수가 모두 설정되지 않았습니다.")
    sys.exit(1)

# --- 핵심 로직 ---
def main():
    print("--- 데이터 저장 서비스(Data Saver) 시작 ---")

    # Redis 클라이언트 생성
    try:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        redis_client.ping()
        print(f"🟢 Redis 서버에 성공적으로 연결되었습니다. ({REDIS_HOST}:{REDIS_PORT})")
    except redis.exceptions.ConnectionError as e:
        print(f"🔴 Redis 연결 실패: {e}. 5초 후 재시도합니다...")
        time.sleep(5)
        main()
        return

    # MongoDB 클라이언트 생성
    try:
        mongo_client = MongoClient(
            MONGO_URI,
            username=MONGO_USER,
            password=MONGO_PASSWORD,
            serverSelectionTimeoutMS=5000
        )
        mongo_client.admin.command('ping')
        db = mongo_client[MONGO_DB_NAME]
        collection = db['session_events']
        print(f"🟢 MongoDB에 성공적으로 연결되었습니다. ({MONGO_HOST}:{MONGO_PORT})")
    except errors.ConnectionFailure as e:
        print(f"🔴 MongoDB 연결 실패: {e}. 프로그램을 종료합니다.")
        return

    # Redis 채널 구독
    pubsub = redis_client.pubsub()
    
    # [수정 2] *CHANNELS 대신 CHANNELS 사용 (문자열이므로 unpacking 불필요)
    pubsub.subscribe(CHANNELS)
    
    print(f"📢 다음 채널을 구독합니다: {CHANNELS}")
    print("--- 데이터 수신 대기 중... ---")

    # 메시지 루프
    for message in pubsub.listen():
        if message['type'] != 'message':
            continue

        try:
            data = json.loads(message['data'])

            # [핵심] 종료 시그널 감지 및 Lag 측정용 로그
            if data.get("eventType") == "SESSION_END":
                end_time = datetime.datetime.now().strftime('%H:%M:%S.%f')
                print(f"\n🛑 [처리 완료] SESSION_END 신호 수신! ({end_time})")
                print(f"✅ 큐에 쌓인 모든 데이터 처리가 끝났습니다.\n")
                continue 
            
            # MongoDB 저장
            insert_result = collection.insert_one(data)
            
            session_id = data.get('sessionId', 'N/A')
            print(f"✅ 데이터 저장 완료 -> [Session: {session_id}, InsertedID: {insert_result.inserted_id}]")

        except json.JSONDecodeError as e:
            print(f"🔴 JSON 파싱 에러: {e}, 원본: {message['data']}")
        except Exception as e:
            print(f"🔴 에러: MongoDB 저장 중 문제 발생 -> {e}")

if __name__ == "__main__":
    main()